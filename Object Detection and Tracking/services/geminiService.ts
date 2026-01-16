import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';

// Initialize client only if key exists (handled in component)
const getClient = () => new GoogleGenAI({ apiKey });

export const analyzeFrame = async (base64Image: string, detections: string[]) => {
  if (!apiKey) throw new Error("API Key missing");
  
  const client = getClient();
  
  // Clean base64 string
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

  const detectionSummary = detections.length > 0 
    ? `The object detection system identified: ${detections.join(', ')}.` 
    : "No specific objects were automatically detected.";

  const prompt = `Analyze this video frame. ${detectionSummary}
  
  Provide a tactical assessment in the following JSON format:
  {
    "summary": "A brief 1-sentence summary of the scene.",
    "threatLevel": "Low | Medium | High",
    "details": "Detailed description of what is happening, potential hazards, or interesting observations.",
    "recommendation": "Actionable advice based on the visual data."
  }
  Do not include markdown code blocks. Just the raw JSON.`;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash-image', // Using the latest vision model
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64
            }
          },
          {
            text: prompt
          }
        ]
      }
    });

    const text = response.text || "{}";
    // Attempt to parse JSON cleanly, handling potential markdown wrappers
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return {
      summary: text,
      threatLevel: "Unknown",
      details: "Could not parse structured data.",
      recommendation: "Review raw output."
    };

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};
