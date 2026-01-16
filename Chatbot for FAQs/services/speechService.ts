
import { GoogleGenAI, Modality } from "@google/genai";

// Safe access to process.env in browser environment
const getApiKey = () => (window as any).process?.env?.API_KEY || '';

class SpeechService {
  private client: GoogleGenAI | null = null;
  private audioContext: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private isStopped = false;

  constructor() {
    const apiKey = getApiKey();
    if (apiKey) {
      this.client = new GoogleGenAI({ apiKey });
    }
  }

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      // Try to match Gemini's native 24kHz to avoid resampling artifacts if possible, 
      // though browsers often enforce hardware sample rate (e.g. 44.1/48kHz)
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    return this.audioContext;
  }

  /**
   * Strips markdown and cleans text for better speech synthesis.
   */
  private cleanTextForSpeech(text: string): string {
    if (!text) return "";
    return text
      .replace(/[*#_`]/g, '') // Remove markdown symbols
      .replace(/\[.*?\]\(.*?\)/g, '') // Remove links
      .replace(/\n+/g, '. ') // Replace newlines with pauses
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim();
  }

  /**
   * Splits text into manageable chunks (sentences) to allow for pipelined playback.
   * optimized for low latency (Time-To-First-Audio).
   */
  private splitTextIntoChunks(text: string): string[] {
     // Split by sentence delimiters (. ! ? : ;), keeping the delimiter
     // We also split by newline to ensure lists are read as chunks
     const rawChunks = text.match(/[^.!?:\n]+[.!?:\n]+|[^.!?:\n]+$/g) || [text];
     
     const mergedChunks: string[] = [];
     let currentChunk = "";
     
     for (let i = 0; i < rawChunks.length; i++) {
         const chunk = rawChunks[i].trim();
         if (!chunk) continue;

         // Dynamic Chunk Sizing Strategy:
         // 1. First Chunk: Keep it small (~60 chars). This ensures the first API call finishes fast 
         //    so the user hears audio almost immediately.
         // 2. Subsequent Chunks: Larger (~250 chars). This reduces the total number of API calls 
         //    and improves prosody/flow for the rest of the message.
         
         const isFirstBatch = mergedChunks.length === 0;
         const maxLen = isFirstBatch ? 60 : 250;

         // Logic: Add to current chunk if it fits. 
         // If currentChunk is empty, we must add it regardless of size to avoid dropping content.
         if (!currentChunk || (currentChunk.length + chunk.length + 1) < maxLen) {
             currentChunk += (currentChunk ? " " : "") + chunk;
         } else {
             mergedChunks.push(currentChunk);
             currentChunk = chunk;
         }
     }
     
     if (currentChunk) mergedChunks.push(currentChunk);
     
     // Limit to 25 chunks to prevent extremely long reads or memory issues
     return mergedChunks.slice(0, 25);
  }

  private decodeBase64(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  private async decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext
  ): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    // Mono channel (1) for TTS output from Gemini
    const numChannels = 1;
    const frameCount = dataInt16.length;
    
    // Create buffer at Gemini's native rate (24kHz)
    const buffer = ctx.createBuffer(numChannels, frameCount, 24000); 
    
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
  }

  /**
   * Generates audio for a single text chunk.
   */
  private async generateAudioChunk(text: string): Promise<AudioBuffer | null> {
      if (!this.client) {
           const apiKey = getApiKey();
           if (apiKey) this.client = new GoogleGenAI({ apiKey });
           else return null;
      }
      
      try {
          const response = await this.client!.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text }] }],
            config: {
              responseModalities: ['AUDIO' as Modality],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
            },
          });

          const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (!base64Audio) return null;

          const ctx = this.getAudioContext();
          if (ctx.state === 'suspended') await ctx.resume();
          
          return await this.decodeAudioData(this.decodeBase64(base64Audio), ctx);
      } catch (e) {
          console.error("TTS Chunk Generation Error", e);
          return null;
      }
  }

  /**
   * Plays a specific audio buffer and resolves when it finishes.
   */
  private playBuffer(buffer: AudioBuffer): Promise<void> {
      return new Promise((resolve) => {
          if (this.isStopped) { resolve(); return; }
          const ctx = this.getAudioContext();
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          
          source.onended = () => {
              if (this.currentSource === source) {
                  this.currentSource = null;
              }
              resolve();
          };
          
          this.currentSource = source;
          source.start();
      });
  }

  stop() {
    this.isStopped = true;
    if (this.currentSource) {
      try { this.currentSource.stop(); } catch (e) {}
      this.currentSource = null;
    }
  }

  /**
   * Generates and plays speech using a pipelined approach for lower latency.
   */
  async speak(text: string, onEnded?: () => void): Promise<void> {
    this.stop();
    this.isStopped = false;

    const clean = this.cleanTextForSpeech(text);
    if (!clean) { onEnded?.(); return; }

    const chunks = this.splitTextIntoChunks(clean);
    
    try {
        // Pipelining Strategy:
        // Start fetching Chunk 0 immediately.
        let nextChunkPromise = this.generateAudioChunk(chunks[0]);
        
        for (let i = 0; i < chunks.length; i++) {
            if (this.isStopped) break;

            // Optimistically start fetching Chunk i+1 while we wait for/play Chunk i
            let upcomingChunkPromise: Promise<AudioBuffer|null> | null = null;
            if (i + 1 < chunks.length) {
                upcomingChunkPromise = this.generateAudioChunk(chunks[i+1]);
            }

            // Wait for current chunk to be ready
            const buffer = await nextChunkPromise;
            
            if (this.isStopped) break;

            if (buffer) {
                // Play it (blocks loop until onended)
                await this.playBuffer(buffer);
            }

            // Move pointer to the next promise we started earlier
            if (upcomingChunkPromise) {
                nextChunkPromise = upcomingChunkPromise;
            }
        }
    } catch (e) {
        console.error("Speech playback error", e);
    } finally {
        if (!this.isStopped && onEnded) onEnded();
    }
  }
}

export const speechService = new SpeechService();
