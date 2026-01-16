
import { GoogleGenAI, Type } from "@google/genai";
import { FAQItem, ChatMessage, Intent } from "../types";

// Safe access to process.env in browser environment
const getApiKey = () => (window as any).process?.env?.API_KEY || '';

interface CachedResponse {
  text: string;
  suggestions: string[];
  groundingChunks?: any[];
  image?: string;
  timestamp: number;
}

class GeminiService {
  private client: GoogleGenAI | null = null;
  private cache: Map<string, CachedResponse> = new Map();
  private CACHE_TTL = 1000 * 60 * 10; // Increased to 10 minutes cache

  constructor() {
    const apiKey = getApiKey();
    if (apiKey) {
      this.client = new GoogleGenAI({ apiKey });
    }
  }

  async getConversationalResponse(
    userQuery: string, 
    chatHistory: ChatMessage[],
    faqs: FAQItem[],
    intent: Intent = 'NONE',
    imageBase64?: string,
    fileAttachment?: { name: string; mimeType: string; data: string }
  ): Promise<{ text: string; suggestions: string[]; groundingChunks?: any[]; image?: string }> {
    if (!this.client) {
      // Retry initialization if key wasn't available at startup
      const apiKey = getApiKey();
      if (apiKey) {
          this.client = new GoogleGenAI({ apiKey });
      } else {
          throw new Error("GEMINI_API_KEY_MISSING");
      }
    }

    // --- IMAGE GENERATION (TEXT-TO-IMAGE) PATH ---
    if (intent === 'IMAGE_GENERATION' && !imageBase64) {
        // 1. Analyze query for Aspect Ratio preferences
        let aspectRatio = "1:1";
        const lowerQuery = userQuery.toLowerCase();
        
        if (lowerQuery.match(/landscape|wide|16:9/)) {
            aspectRatio = "16:9";
        } else if (lowerQuery.match(/portrait|tall|9:16/)) {
            aspectRatio = "9:16";
        } else if (lowerQuery.match(/4:3/)) {
            aspectRatio = "4:3";
        } else if (lowerQuery.match(/3:4/)) {
            aspectRatio = "3:4";
        }

        // 2. Refine Prompt Engineering
        const hasStyle = lowerQuery.match(/style|realistic|cartoon|sketch|painting|drawing|illustration|render|anime|photo|cyberpunk|watercolor|oil|pixel/);
        
        let qualitySuffix = "";
        if (!hasStyle) {
            qualitySuffix = "Photorealistic, cinematic lighting, 8k resolution, highly detailed texture, professional photography, depth of field.";
        } else {
            qualitySuffix = "High quality, 8k resolution, masterpiece, intricate details, sharp focus, compositionally balanced.";
        }
        
        const enhancedPrompt = `${userQuery}. ${qualitySuffix}`;

        const response = await this.client.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: enhancedPrompt,
            config: {
                imageConfig: { 
                    aspectRatio: aspectRatio as any 
                }
            }
        });

        let imageUri: string | undefined;
        let responseText = "Here is the visual concept I've generated for you.";
        const parts = response.candidates?.[0]?.content?.parts || [];
        
        for (const part of parts) {
            if (part.inlineData) {
                imageUri = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            } else if (part.text) {
                responseText = part.text;
            }
        }

        if (imageUri) {
             return {
                 text: responseText,
                 suggestions: [
                     "Regenerate as a Watercolor Painting", 
                     "Change to Wide 16:9 Aspect Ratio", 
                     "Make it a Cyberpunk 3D Render", 
                     "Add a dramatic sunset background"
                 ],
                 image: imageUri
             };
        } else {
             return {
                 text: responseText || "I was unable to generate an image for that request due to safety policies.",
                 suggestions: ["Try a different prompt", "Describe it differently"]
             };
        }
    }

    // --- IMAGE EDITING (IMAGE-TO-IMAGE) PATH ---
    if (intent === 'IMAGE_GENERATION' && imageBase64) {
        const base64Data = imageBase64.split(',')[1];
        const mimeType = imageBase64.split(';')[0].split(':')[1];

        const response = await this.client.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: base64Data,
                            mimeType: mimeType
                        }
                    },
                    { text: userQuery }
                ]
            }
        });

        let imageUri: string | undefined;
        let responseText = "Here is your edited image.";
        const parts = response.candidates?.[0]?.content?.parts || [];

        for (const part of parts) {
            if (part.inlineData) {
                imageUri = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            } else if (part.text) {
                responseText = part.text;
            }
        }

        if (imageUri) {
             return {
                 text: responseText,
                 suggestions: [
                     "Try a different style",
                     "Make it black and white",
                     "Add more detail"
                 ],
                 image: imageUri
             };
        } else {
             return {
                 text: responseText || "I was unable to edit the image as requested.",
                 suggestions: ["Try a simpler request"]
             };
        }
    }

    // --- STANDARD TEXT OR MULTIMODAL CHAT PATH ---

    const kbString = faqs.map(f => `[Category: ${f.category}]\nQ: ${f.question}\nA: ${f.answer}`).join('\n\n');
    
    // Performance: Only use the last 2 messages for CACHE KEY generation.
    const recentHistoryForKey = chatHistory.slice(-2).map(msg => `${msg.role}:${msg.content}`).join('|');
    const cacheKey = `${intent}|${userQuery.trim()}|${recentHistoryForKey}`;
    
    // Check Cache (only if no image involved and NOT deep research which needs fresh live data)
    if (!imageBase64 && !fileAttachment && intent !== 'DEEP_RESEARCH') {
        const cached = this.cache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL)) {
            return {
                text: cached.text,
                suggestions: cached.suggestions,
                groundingChunks: cached.groundingChunks,
                image: cached.image
            };
        }
    }

    // Prepare full history for the actual API call
    const recentHistory = chatHistory.slice(-6).map(msg => {
      return `${msg.role === 'user' ? 'User' : 'Nexora'}: ${msg.content}`;
    }).join('\n');

    const isAnalysis = intent === 'IMAGE_ANALYSIS' || !!imageBase64 || !!fileAttachment;
    const isDeepResearch = intent === 'DEEP_RESEARCH';
    
    // Configure Thinking Budget based on task complexity
    let thinkingBudget = 2048; // Default reasoning budget
    if (isDeepResearch) {
        thinkingBudget = 8192; // Higher budget for deep research
    }

    const systemInstruction = `You are **Nexora**, the advanced AI pilot for **NebulaFlow**.

**Persona:**
- **Tone:** Professional yet enthusiastic, futuristic, and helpful. 
- **Style:** Concise, witty, and engaging.
- **Quirks:** You occasionally use subtle space/cosmic metaphors (e.g., "launching a project," "navigating," "in orbit," "stellar") to align with the NebulaFlow brand, but keep it natural.
- **Constraint:** Keep responses efficient (under 150 words) unless asked for a deep dive or Deep Research is requested.

**Capabilities:**
1. **NebulaFlow Command**: You are the expert on NebulaFlow (pricing, features, troubleshooting).
2. **Visual Intelligence**: You can analyze images with high precision.
3. **Deep Research**: When requested, perform comprehensive research using your tools and reasoning capabilities. Provide detailed, well-structured reports.
4. **General Knowledge**: You are well-versed in tech, productivity, and general facts.

**Context:**
Detected Intent: ${intent}
${isAnalysis ? `NOTE: The user has provided an attachment (Image or File). Analyze it if requested.` : ''}
${isDeepResearch ? `NOTE: The user has requested DEEP RESEARCH. Use Google Search extensively. Provide a comprehensive answer with citations. Ignore the word count constraint.` : ''}

**Guidelines:**
- **Knowledge Base (KB)**: Always prioritize the provided KB for product questions.
- **Search**: Use Google Search for real-time external facts.
- **Formatting**: Use Markdown (bold, lists) to make text "flow" visually.

**Output Format (JSON ONLY):**
- \`answer\`: The response text (Markdown).
- \`suggestions\`: 2-3 forward-thinking follow-up questions.
`;

    const textPrompt = `
**Knowledge Base:**
---
${kbString}
---

**History:**
---
${recentHistory}
---

**Query:**
"${userQuery}"

**Response (JSON):**
`;

    let contents: any = textPrompt;
    
    if (imageBase64) {
        const base64Data = imageBase64.split(',')[1];
        const mimeType = imageBase64.split(';')[0].split(':')[1];

        contents = {
            parts: [
                { text: textPrompt },
                {
                    inlineData: {
                        mimeType: mimeType,
                        data: base64Data
                    }
                }
            ]
        };
    } else if (fileAttachment) {
        // Remove base64 header if present (e.g. data:application/pdf;base64,...)
        const base64Data = fileAttachment.data.includes('base64,') 
            ? fileAttachment.data.split('base64,')[1] 
            : fileAttachment.data;
            
        contents = {
            parts: [
                { text: textPrompt },
                {
                    inlineData: {
                        mimeType: fileAttachment.mimeType,
                        data: base64Data
                    }
                }
            ]
        }
    }

    const response = await this.client.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: contents,
      config: {
          systemInstruction: systemInstruction,
          temperature: 0.4,
          maxOutputTokens: 8192,
          thinkingConfig: { thinkingBudget: thinkingBudget },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              answer: { type: Type.STRING },
              suggestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            }
          },
          tools: [{ googleSearch: {} }],
      }
    });

    let parsedResponse = { answer: '', suggestions: [] as string[] };
    
    try {
      if (response.text) {
        parsedResponse = JSON.parse(response.text);
      }
    } catch (e) {
      console.error("Failed to parse Gemini JSON:", e);
      const rawText = response.text || "";
      if (rawText.trim().startsWith('{')) {
           parsedResponse.answer = "My navigation systems encountered a small glitch processing that. Could you try asking again?";
      } else {
           parsedResponse.answer = rawText || "I'm having trouble connecting to the main frame right now.";
      }
    }
    
    const finalResult = {
      text: parsedResponse.answer,
      suggestions: parsedResponse.suggestions || [],
      groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks
    };

    if (!imageBase64 && !fileAttachment && !isDeepResearch) {
        this.cache.set(cacheKey, {
            ...finalResult,
            timestamp: Date.now()
        });

        if (this.cache.size > 50) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) this.cache.delete(firstKey);
        }
    }
    
    return finalResult;
  }
}

export const geminiService = new GeminiService();
