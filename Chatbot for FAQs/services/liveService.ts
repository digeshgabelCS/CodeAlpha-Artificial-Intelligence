
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

// Constants for Audio
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;

// Safe access to process.env in browser environment
const getApiKey = () => (window as any).process?.env?.API_KEY || '';

export interface LiveConfig {
  onClose?: () => void;
  onVolumeChange?: (userVolume: number, aiVolume: number) => void;
}

class LiveService {
  private client: GoogleGenAI | null = null;
  private audioContext: AudioContext | null = null;
  private inputContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private activeSession: any = null;
  public isConnected = false;

  // Analysers for visualization
  private inputAnalyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private volumeCallback: ((u: number, a: number) => void) | null = null;
  private volumeInterval: any = null;

  constructor() {
    // Client is initialized in startSession
  }

  private createPcmBlob(data: Float32Array): { data: string; mimeType: string } {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        let s = Math.max(-1, Math.min(1, data[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    let binary = '';
    const bytes = new Uint8Array(int16.buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    
    return {
      data: btoa(binary),
      mimeType: 'audio/pcm;rate=16000',
    };
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
    ctx: AudioContext,
    sampleRate: number = OUTPUT_SAMPLE_RATE,
    numChannels: number = 1
  ): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  }

  private getVolume(analyser: AnalyserNode): number {
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      // Calculate RMS roughly
      for(let i=0; i < dataArray.length; i++) {
          sum += dataArray[i];
      }
      return (sum / dataArray.length) / 255; // Normalize 0-1
  }

  /**
   * Send a video frame (base64) to the model so it can "see".
   */
  sendVideoFrame(base64Image: string) {
      if (!this.activeSession || !this.isConnected) return;
      
      // Remove header if present (data:image/jpeg;base64,...)
      const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

      // Send as realtime input
      try {
        this.activeSession.sendRealtimeInput({
            media: {
                mimeType: 'image/jpeg',
                data: cleanBase64
            }
        });
      } catch (e) {
          console.error("Failed to send video frame", e);
      }
  }

  async startSession(config: LiveConfig) {
    const apiKey = getApiKey();
    if (!apiKey) {
      console.error("API Key missing for Live Service");
      if (config.onClose) config.onClose();
      return;
    }

    this.volumeCallback = config.onVolumeChange || null;
    
    this.disconnect();

    this.client = new GoogleGenAI({ apiKey });

    // Initialize Audio Contexts
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioContextClass({ sampleRate: OUTPUT_SAMPLE_RATE });
    this.inputContext = new AudioContextClass({ sampleRate: INPUT_SAMPLE_RATE });

    // Setup Output Analyser (AI Voice)
    this.outputAnalyser = this.audioContext.createAnalyser();
    this.outputAnalyser.fftSize = 256;
    this.outputAnalyser.smoothingTimeConstant = 0.1;

    try {
        this.stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                channelCount: 1,
                sampleRate: INPUT_SAMPLE_RATE,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            } 
        });
    } catch (e) {
        console.error("Microphone permission failed", e);
        if (config.onClose) config.onClose();
        return;
    }
    
    this.isConnected = true;

    // Start Volume Reporting Loop
    this.volumeInterval = setInterval(() => {
        let uVol = 0;
        let aVol = 0;
        if (this.inputAnalyser) uVol = this.getVolume(this.inputAnalyser);
        if (this.outputAnalyser) aVol = this.getVolume(this.outputAnalyser);
        
        if (this.volumeCallback) this.volumeCallback(uVol, aVol);
    }, 50);

    console.log("Connecting to Gemini Live...");
    
    try {
        const sessionPromise = this.client.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-12-2025',
          callbacks: {
            onopen: () => {
              console.log("Gemini Live Session Opened");
              if (this.isConnected) {
                  this.startAudioInput(sessionPromise);
              }
            },
            onmessage: async (message: LiveServerMessage) => {
              this.handleServerMessage(message);
            },
            onclose: (e) => {
                console.log("Gemini Live Session Closed", e);
                if (this.isConnected) {
                    this.disconnect();
                    if (config.onClose) config.onClose();
                }
            },
            onerror: (e) => {
                console.error("Gemini Live Error", e);
                this.disconnect();
                if (config.onClose) config.onClose();
            }
          },
          config: {
            responseModalities: ['AUDIO' as Modality], // Use string 'AUDIO' for robustness
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
            },
            systemInstruction: "You are Nexora. You are helpful, concise, and friendly. If I show you something, describe it.",
          },
        });
        
        this.activeSession = await sessionPromise;
    } catch (e) {
        console.error("Failed to connect to Gemini Live", e);
        this.disconnect();
        if (config.onClose) config.onClose();
    }
  }

  private startAudioInput(sessionPromise: Promise<any>) {
    if (!this.inputContext || !this.stream) return;

    this.source = this.inputContext.createMediaStreamSource(this.stream);
    this.inputAnalyser = this.inputContext.createAnalyser();
    this.inputAnalyser.fftSize = 256;

    this.processor = this.inputContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (!this.isConnected) return; 
      
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = this.createPcmBlob(inputData);
      
      sessionPromise.then((session) => {
         if (this.isConnected) {
            session.sendRealtimeInput({ media: pcmBlob });
         }
      });
    };

    // Graph: Source -> Analyser -> Processor -> Destination
    this.source.connect(this.inputAnalyser);
    this.inputAnalyser.connect(this.processor);
    this.processor.connect(this.inputContext.destination);
  }

  private async handleServerMessage(message: LiveServerMessage) {
    if (!this.audioContext || !this.isConnected) return;

    const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    
    if (base64Audio) {
      if (this.audioContext.state === 'suspended') {
         await this.audioContext.resume();
      }

      this.nextStartTime = Math.max(this.nextStartTime, this.audioContext.currentTime);

      try {
          const audioBytes = this.decodeBase64(base64Audio);
          const audioBuffer = await this.decodeAudioData(audioBytes, this.audioContext);
          
          const source = this.audioContext.createBufferSource();
          source.buffer = audioBuffer;
          
          // Connect to Analyser for visualization, then to destination
          if (this.outputAnalyser) {
              source.connect(this.outputAnalyser);
              this.outputAnalyser.connect(this.audioContext.destination);
          } else {
              source.connect(this.audioContext.destination);
          }
          
          source.onended = () => {
            this.sources.delete(source);
          };

          source.start(this.nextStartTime);
          this.nextStartTime += audioBuffer.duration;
          this.sources.add(source);
      } catch (err) {
          console.debug("Error playing audio", err);
      }
    }

    if (message.serverContent?.interrupted) {
      console.log("Model interrupted");
      this.sources.forEach(src => {
          try { src.stop(); } catch(e) {}
      });
      this.sources.clear();
      this.nextStartTime = 0;
    }
  }

  disconnect() {
    this.isConnected = false;
    if (this.volumeInterval) clearInterval(this.volumeInterval);
    
    if (this.activeSession) {
        try { 
            if (this.activeSession.close) this.activeSession.close();
        } catch(e) {
            console.warn("Error closing session", e);
        }
        this.activeSession = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.source) {
      try { this.source.disconnect(); } catch(e) {}
      this.source = null;
    }
    if (this.processor) {
      try { this.processor.disconnect(); } catch(e) {}
      this.processor = null;
    }
    if (this.inputContext) {
      try { this.inputContext.close(); } catch(e) {}
      this.inputContext = null;
    }

    this.sources.forEach(src => {
        try { src.stop(); } catch(e) {}
    });
    this.sources.clear();
    this.nextStartTime = 0;
    
    if (this.audioContext) {
      try { this.audioContext.close(); } catch(e) {}
      this.audioContext = null;
    }

    this.inputAnalyser = null;
    this.outputAnalyser = null;
  }
}

export const liveService = new LiveService();
