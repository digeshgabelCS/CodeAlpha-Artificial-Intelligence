import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { ObjectTracker, TrackedObject } from '../services/tracker';
import { VideoSourceType, TrackerAnalysis } from '../types';
import { Camera, Upload, Play, Pause, Activity, Cpu, Aperture, Eye, Video, Filter, CheckCircle2, Circle, Target, Ghost, Zap, Settings, ZoomIn, ScanEye, X, Sun, Sliders, Palette, Flashlight, Power, PowerOff } from 'lucide-react';
import { analyzeFrame } from '../services/geminiService';
import AnalysisPanel from './AnalysisPanel';

interface ObjectDetectionSystemProps {
  onError: (msg: string) => void;
}

const COMMON_CLASSES = [
  'person', 'car', 'bicycle', 'motorcycle', 
  'bus', 'truck', 'cat', 'dog', 
  'backpack', 'cell phone', 'laptop'
];

interface GhostParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
}

interface GhostEntity {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  opacity: number;
  pulseSpeed: number;
  label: string;
  particles: GhostParticle[];
  glitchX: number;
}

const ObjectDetectionSystem: React.FC<ObjectDetectionSystemProps> = ({ onError }) => {
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const trackerRef = useRef<ObjectTracker>(new ObjectTracker());
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  
  // Ghost Refs
  const ghostsRef = useRef<GhostEntity[]>([]);
  const lastGhostSpawnRef = useRef<number>(0);

  // State
  const [loadingModel, setLoadingModel] = useState(true);
  const [sourceType, setSourceType] = useState<VideoSourceType>('webcam');
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFps] = useState(0);
  const [objectCount, setObjectCount] = useState(0);
  const [activeTracks, setActiveTracks] = useState<TrackedObject[]>([]);
  
  // Camera Capabilities State
  const [camCaps, setCamCaps] = useState<{
    zoom: { min: number, max: number, step: number } | null;
    focus: { min: number, max: number, step: number } | null;
    brightness: { min: number, max: number, step: number } | null;
    contrast: { min: number, max: number, step: number } | null;
    saturation: { min: number, max: number, step: number } | null;
    torch: boolean;
  }>({ zoom: null, focus: null, brightness: null, contrast: null, saturation: null, torch: false });
  
  const [camSettings, setCamSettings] = useState({ 
    zoom: 1, 
    focus: 0, 
    brightness: 100, 
    contrast: 100, 
    saturation: 100, 
    torch: false 
  });
  
  const [showSettings, setShowSettings] = useState(false);

  // Filtering & Modes State
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [ghostMode, setGhostMode] = useState(false);
  const [emfLevel, setEmfLevel] = useState(0); // Simulated EMF for ghost mode
  
  // Analysis State
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<TrackerAnalysis | null>(null);

  // Initialize TF.js and Model
  useEffect(() => {
    const loadModel = async () => {
      try {
        await tf.ready();
        const model = await cocoSsd.load();
        modelRef.current = model;
        setLoadingModel(false);
        console.log("Model loaded");
      } catch (err) {
        console.error(err);
        onError("Failed to load TensorFlow model. Check your connection.");
      }
    };
    loadModel();
  }, [onError]);

  // Helper to stop camera streams properly
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    videoTrackRef.current = null;
    // Reset capabilities when camera stops
    setCamCaps({ zoom: null, focus: null, brightness: null, contrast: null, saturation: null, torch: false });
  };

  // Handle Video Source Change
  const handleSourceChange = async (type: VideoSourceType) => {
    stopCamera(); // Stop any existing streams first
    
    setSourceType(type);
    setIsVideoReady(false);
    setIsPlaying(false);
    setAnalysisResult(null);
    trackerRef.current.reset();
    ghostsRef.current = [];
    
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = "";
    }

    if (type === 'webcam') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'environment',
            // @ts-ignore - TS doesn't fully know modern constraints yet
            zoom: true 
          },
          audio: false 
        });

        // Extract track and capabilities
        const track = stream.getVideoTracks()[0];
        videoTrackRef.current = track;

        // Get Capabilities if supported
        // @ts-ignore
        const capabilities: any = (track.getCapabilities && track.getCapabilities()) || {};
        // @ts-ignore
        const settings: any = (track.getSettings && track.getSettings()) || {};

        const getRange = (name: string) => capabilities[name] ? { min: capabilities[name].min, max: capabilities[name].max, step: capabilities[name].step } : null;

        setCamCaps({
          zoom: getRange('zoom'),
          focus: getRange('focusDistance'),
          brightness: getRange('brightness'),
          contrast: getRange('contrast'),
          saturation: getRange('saturation'),
          torch: !!capabilities.torch
        });

        setCamSettings({
          zoom: settings.zoom || getRange('zoom')?.min || 1,
          focus: settings.focusDistance || getRange('focusDistance')?.min || 0,
          brightness: settings.brightness || getRange('brightness')?.min || 100,
          contrast: settings.contrast || getRange('contrast')?.min || 100,
          saturation: settings.saturation || getRange('saturation')?.min || 100,
          torch: settings.torch || false
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setIsVideoReady(true);
            setIsPlaying(true);
          };
        }
      } catch (err) {
        onError("Camera access denied or unavailable.");
      }
    }
  };

  const toggleCameraPower = () => {
    if (sourceType === 'webcam' && isVideoReady) {
      // Turn Off
      stopCamera();
      setIsVideoReady(false);
      setIsPlaying(false);
    } else {
      // Turn On (Switch to webcam if needed, or just restart stream)
      handleSourceChange('webcam');
    }
  };

  // Adjust Camera Settings
  const handleCamSetting = async (setting: string, value: number | boolean) => {
    if (!videoTrackRef.current) return;
    
    // Update UI immediately
    setCamSettings(prev => ({ ...prev, [setting]: value }));

    try {
      const constraints: any = { advanced: [] };
      const constraintSet: any = {};
      
      if (setting === 'focus') {
        constraintSet.focusMode = 'manual';
        constraintSet.focusDistance = value;
      } else {
        constraintSet[setting] = value;
      }
      
      constraints.advanced.push(constraintSet);
      await videoTrackRef.current.applyConstraints(constraints);
    } catch (e) {
      console.error("Camera constraint error:", e);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && videoRef.current) {
      stopCamera(); // Stop webcam if active
      const url = URL.createObjectURL(file);
      videoRef.current.src = url;
      videoRef.current.onloadedmetadata = () => {
        setIsVideoReady(true);
        // Don't auto play file, let user click play
      };
      setSourceType('file');
      trackerRef.current.reset();
      ghostsRef.current = [];
    }
  };

  // Toggle Filter
  const toggleFilter = (cls: string) => {
    setActiveFilters(prev => 
      prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]
    );
  };

  // Update Ghost Logic
  const updateGhosts = (width: number, height: number) => {
    const now = Date.now();
    const ghosts = ghostsRef.current;

    // Spawn new ghosts randomly (low probability)
    if (ghosts.length < 3 && now - lastGhostSpawnRef.current > 2000) {
      if (Math.random() < 0.01) { // 1% chance per frame if cooldown passed
        lastGhostSpawnRef.current = now;
        ghosts.push({
          id: Math.floor(Math.random() * 10000),
          x: Math.random() * (width - 100),
          y: Math.random() * (height - 100),
          w: 50 + Math.random() * 100,
          h: 100 + Math.random() * 150,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          opacity: 0,
          pulseSpeed: 0.02 + Math.random() * 0.05,
          label: Math.random() > 0.5 ? 'SPECTRAL_ANOMALY' : 'UNKNOWN_ENTITY',
          particles: [],
          glitchX: 0
        });
      }
    }

    // Update existing ghosts
    const activeGhosts: GhostEntity[] = [];
    let maxEmf = 0;

    ghosts.forEach(g => {
      // Move
      g.x += g.vx;
      g.y += g.vy;
      
      // Bounce off walls
      if (g.x < 0 || g.x + g.w > width) g.vx *= -1;
      if (g.y < 0 || g.y + g.h > height) g.vy *= -1;

      // Pulse opacity
      g.opacity += g.pulseSpeed;
      if (g.opacity > 0.8 || g.opacity < 0.1) g.pulseSpeed *= -1;

      // Random jitter
      g.x += (Math.random() - 0.5) * 4;
      g.y += (Math.random() - 0.5) * 4;

      // Glitch effect randomization
      if (Math.random() > 0.85) {
        g.glitchX = (Math.random() - 0.5) * 15;
      } else {
        g.glitchX = 0;
      }

      // Particle System (Ectoplasm) - Enhanced
      if (g.opacity > 0.2) {
        // Emit multiple particles per frame for density
        const particleCount = 2; 
        for(let i=0; i<particleCount; i++) {
           // Spawn area: slightly dispersed around the center
           const spawnX = g.x + g.w / 2 + (Math.random() - 0.5) * g.w * 0.5;
           const spawnY = g.y + g.h / 2 + (Math.random() - 0.5) * g.h * 0.5;

           g.particles.push({
             x: spawnX,
             y: spawnY,
             // Velocity: Opposes ghost movement (Trail) + Upward Drift + Random spread
             vx: -g.vx * 0.4 + (Math.random() - 0.5),
             vy: -g.vy * 0.4 - 1.5 + (Math.random() - 0.5), 
             life: 1.0,
             size: Math.random() * 5 + 2
           });
        }
      }

      // Update particles
      g.particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.95; // Atmospheric drag
        p.vy *= 0.95; // Atmospheric drag
        p.life -= 0.015; // Fade out rate
        p.size *= 0.96; // Shrink over time
      });
      g.particles = g.particles.filter(p => p.life > 0);

      // Calculate "EMF" based on size and opacity
      const emf = (g.w * g.h) / 1000 * g.opacity;
      if (emf > maxEmf) maxEmf = emf;

      // Lifespan logic: randomly remove occasionally to simulate disappearing
      if (Math.random() > 0.995) {
         // Vanish
      } else {
        activeGhosts.push(g);
      }
    });

    ghostsRef.current = activeGhosts;
    
    // Smooth EMF reading
    setEmfLevel(prev => prev * 0.9 + (maxEmf > 0 ? 3 + Math.random() * 2 : 0.2 + Math.random() * 0.5) * 0.1);
  };

  // Detection Loop
  const detectFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !modelRef.current || !isPlaying) return;
    
    const start = performance.now();
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (video.readyState !== 4) {
      requestRef.current = requestAnimationFrame(detectFrame);
      return;
    }

    // Match canvas size
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    // 1. Standard Object Detection
    const predictions = await modelRef.current.detect(video);
    
    const detections = predictions.map(p => ({
      bbox: p.bbox,
      class: p.class,
      score: p.score
    }));
    
    const trackedObjects = trackerRef.current.update(detections);
    setActiveTracks(trackedObjects);

    const visibleObjects = activeFilters.length > 0 
      ? trackedObjects.filter(obj => activeFilters.includes(obj.class))
      : trackedObjects;
      
    setObjectCount(visibleObjects.length);

    // 2. Ghost Simulation Updates
    if (ghostMode) {
      updateGhosts(canvas.width, canvas.height);
    } else {
      ghostsRef.current = [];
      setEmfLevel(0);
    }

    // 3. Rendering
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw Real Objects
      visibleObjects.forEach(obj => {
        const [x, y, w, h] = obj.bbox;
        const isTarget = activeFilters.length > 0;
        const color = isTarget ? '#ff2a6d' : obj.color; 

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);

        const cornerLen = Math.min(w, h) * 0.2;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x, y + cornerLen);
        ctx.lineTo(x, y);
        ctx.lineTo(x + cornerLen, y);
        ctx.moveTo(x + w, y + h - cornerLen);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x + w - cornerLen, y + h);
        ctx.stroke();

        if (isTarget) {
          ctx.beginPath();
          ctx.moveTo(x + w/2, y);
          ctx.lineTo(x + w/2, y + 10);
          ctx.moveTo(x + w/2, y + h);
          ctx.lineTo(x + w/2, y + h - 10);
          ctx.moveTo(x, y + h/2);
          ctx.lineTo(x + 10, y + h/2);
          ctx.moveTo(x + w, y + h/2);
          ctx.lineTo(x + w - 10, y + h/2);
          ctx.stroke();
        }

        ctx.fillStyle = color;
        ctx.globalAlpha = 0.8;
        const labelText = isTarget ? `TARGET: ${obj.class.toUpperCase()}` : `${obj.class} ${Math.round(obj.score * 100)}%`;
        const idText = `ID:${obj.id}`;
        const fullText = `${idText} | ${labelText}`;
        
        ctx.font = "12px monospace";
        const textWidth = ctx.measureText(fullText).width;
        ctx.fillRect(x, y - 24, textWidth + 12, 24);

        ctx.globalAlpha = 1.0;
        ctx.fillStyle = isTarget ? "#fff" : "#000";
        ctx.font = "bold 12px monospace";
        ctx.fillText(fullText, x + 6, y - 8);
        
        if (Math.abs(obj.velocity[0]) > 0.5 || Math.abs(obj.velocity[1]) > 0.5) {
             ctx.beginPath();
             ctx.strokeStyle = isTarget ? '#fff' : color;
             ctx.lineWidth = 1;
             ctx.moveTo(x + w/2, y + h/2);
             ctx.lineTo(x + w/2 + obj.velocity[0] * 5, y + h/2 + obj.velocity[1] * 5);
             ctx.stroke();
        }
      });

      // Draw Ghosts
      if (ghostMode) {
        ghostsRef.current.forEach(g => {
          const ghostColor = `rgba(180, 100, 255, ${g.opacity})`;
          
          // Render Particles (Ectoplasm) with Dynamic Color & Fade
          g.particles.forEach(p => {
             const lifeOpacity = p.life * g.opacity * 0.8;
             
             // Dynamic Color Gradient based on Life
             // Life 1.0 (Fresh) -> White/Cyan
             // Life 0.0 (Old) -> Purple/Dark Blue
             const r = Math.floor(100 + (1 - p.life) * 80);
             const gVal = Math.floor(50 + p.life * 205);
             const b = 255;
             
             ctx.fillStyle = `rgba(${r}, ${gVal}, ${b}, ${lifeOpacity})`;
             ctx.beginPath();
             ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
             ctx.fill();
          });

          // Ghost Box with Glitch Effect
          ctx.save();
          
          // Chromatic Aberration (RGB Split) if glitching
          if (Math.abs(g.glitchX) > 0) {
            // Magenta Offset
            ctx.strokeStyle = `rgba(255, 0, 255, ${g.opacity * 0.7})`;
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(g.x + g.glitchX, g.y, g.w, g.h);

            // Cyan Offset
            ctx.strokeStyle = `rgba(0, 255, 255, ${g.opacity * 0.7})`;
            ctx.strokeRect(g.x - g.glitchX, g.y, g.w, g.h);
          } else {
            // Normal Ghost Appearance
            ctx.strokeStyle = ghostColor;
            ctx.shadowBlur = 15;
            ctx.shadowColor = `rgba(200, 200, 255, ${g.opacity * 0.5})`;
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(g.x, g.y, g.w, g.h);
          }
          
          // Crosshairs
          ctx.beginPath();
          ctx.strokeStyle = ghostColor;
          ctx.setLineDash([]);
          ctx.moveTo(g.x + g.w/2 - 10, g.y + g.h/2);
          ctx.lineTo(g.x + g.w/2 + 10, g.y + g.h/2);
          ctx.moveTo(g.x + g.w/2, g.y + g.h/2 - 10);
          ctx.lineTo(g.x + g.w/2, g.y + g.h/2 + 10);
          ctx.stroke();

          // Label
          ctx.fillStyle = ghostColor;
          ctx.font = "bold 12px monospace";
          ctx.fillText(`⚠ ${g.label}`, g.x, g.y - 10);
          
          // Data
          ctx.font = "10px monospace";
          ctx.fillText(`EMF: ${(g.opacity * 5).toFixed(1)} mG`, g.x, g.y + g.h + 15);
          
          ctx.restore();
        });
      }
    }

    const end = performance.now();
    const frameTime = end - start;
    setFps(prev => Math.round(prev * 0.9 + (1000/Math.max(frameTime, 1)) * 0.1));

    requestRef.current = requestAnimationFrame(detectFrame);
  }, [isPlaying, activeFilters, ghostMode]);

  useEffect(() => {
    if (isPlaying && isVideoReady) {
      requestRef.current = requestAnimationFrame(detectFrame);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, isVideoReady, detectFrame, activeFilters, ghostMode]);

  const handleAnalyze = async () => {
    if (!videoRef.current) return;
    setAnalyzing(true);
    
    const wasPlaying = isPlaying;
    setIsPlaying(false);
    videoRef.current.pause();

    try {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = videoRef.current.videoWidth;
      tempCanvas.height = videoRef.current.videoHeight;
      const ctx = tempCanvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0);
      const base64 = tempCanvas.toDataURL('image/jpeg', 0.8);

      // Include ghosts in context if mode is active
      const currentClasses = activeTracks.map(t => t.class);
      if (ghostMode && ghostsRef.current.length > 0) {
        currentClasses.push("Spectral Anomaly");
      }
      
      const uniqueClasses = Array.from(new Set(currentClasses)) as string[];

      const result = await analyzeFrame(base64, uniqueClasses);
      setAnalysisResult(result);
    } catch (e) {
      console.error(e);
      onError("Analysis failed. Check API Key or Internet.");
    } finally {
      setAnalyzing(false);
    }
  };

  const renderSlider = (
    label: string, 
    icon: React.ReactNode, 
    cap: { min: number, max: number, step: number } | null, 
    value: number, 
    settingKey: string, 
    unit: string = ''
  ) => {
    if (!cap) return null;
    return (
      <div className="space-y-1">
         <div className="flex justify-between text-xs font-mono text-gray-400">
           <span className="flex items-center gap-1">{icon} {label}</span>
           <span>{value.toFixed(unit ? 2 : 0)}{unit}</span>
         </div>
         <input 
           type="range" 
           min={cap.min} 
           max={cap.max} 
           step={cap.step}
           value={value}
           onChange={(e) => handleCamSetting(settingKey, parseFloat(e.target.value))}
           className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-hud-teal"
         />
      </div>
    );
  };

  const hasAnyControls = camCaps.zoom || camCaps.focus || camCaps.brightness || camCaps.contrast || camCaps.saturation || camCaps.torch;

  return (
    <div className="relative w-full h-full flex flex-col bg-hud-black overflow-hidden">
      {/* HUD Header */}
      <div className="flex justify-between items-center p-4 border-b border-hud-gray bg-hud-dark/80 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <Aperture className={`text-hud-teal w-6 h-6 ${ghostMode ? 'animate-pulse text-purple-400' : 'animate-spin-slow'}`} />
          <h1 className="text-xl font-mono font-bold tracking-wider text-hud-teal">
            VISION<span className="text-white">TRACK</span> 
            {ghostMode ? 
              <span className="text-xs bg-purple-500/20 px-2 py-0.5 rounded text-purple-400 ml-2 border border-purple-500/50">PARANORMAL MODE</span> : 
              <span className="text-xs bg-hud-teal/20 px-2 py-0.5 rounded text-hud-teal ml-2">v2.1</span>
            }
          </h1>
        </div>
        
        {/* Alerts / Info */}
        <div className="flex gap-4">
          {ghostMode && emfLevel > 2 && (
             <div className="hidden md:flex items-center gap-2 animate-bounce">
                <Zap className="w-4 h-4 text-purple-400" />
                <span className="font-mono text-sm text-purple-400 font-bold">HIGH EMF DETECTED</span>
             </div>
          )}
          {activeFilters.length > 0 && objectCount > 0 && !ghostMode && (
             <div className="hidden md:flex items-center gap-2 animate-pulse">
                <Target className="w-4 h-4 text-hud-red" />
                <span className="font-mono text-sm text-hud-red font-bold">TARGET ACQUIRED</span>
             </div>
          )}
          <div className="hidden md:flex items-center gap-2">
            <Cpu className="w-4 h-4 text-hud-red" />
            <span className="font-mono text-sm text-hud-red">{loadingModel ? 'LOADING MODEL...' : 'MODEL READY'}</span>
          </div>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
        
        {!isVideoReady && !loadingModel && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-hud-gray z-0">
             <Video className="w-16 h-16 mb-4 opacity-20" />
             <p className="font-mono text-sm opacity-50">NO SIGNAL INPUT</p>
          </div>
        )}

        <video
          ref={videoRef}
          className={`absolute inset-0 w-full h-full object-contain ${ghostMode ? 'sepia-[.3] contrast-125 brightness-90 saturate-50' : ''}`}
          playsInline
          muted
          loop={sourceType === 'file'} // Auto loop files
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        />

        {/* Ghost Mode Vignette */}
        {ghostMode && (
          <div className="absolute inset-0 pointer-events-none z-0" 
               style={{
                 background: 'radial-gradient(circle, transparent 60%, rgba(20, 0, 40, 0.6) 100%)',
                 boxShadow: 'inset 0 0 50px rgba(100, 0, 255, 0.1)'
               }}>
          </div>
        )}

        {loadingModel && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
             <div className="text-center">
                <div className="w-16 h-16 border-4 border-hud-teal border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <div className="font-mono text-hud-teal animate-pulse">INITIALIZING NEURAL NETWORK...</div>
             </div>
          </div>
        )}

        {/* AI Analysis Overlay */}
        <AnalysisPanel 
          analysis={analysisResult} 
          loading={analyzing} 
          onClose={() => setAnalysisResult(null)} 
        />
        
        {/* Filter Menu Overlay */}
        {showFilterMenu && (
          <div className="absolute bottom-24 left-4 z-40 bg-hud-dark/95 border border-hud-gray p-4 rounded-lg shadow-xl backdrop-blur-md w-64 max-h-[50%] overflow-y-auto">
             <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-700">
               <h3 className="text-hud-teal font-mono text-sm font-bold flex items-center gap-2">
                 <Filter className="w-3 h-3" /> OBJECT FILTERS
               </h3>
               <button onClick={() => setShowFilterMenu(false)} className="text-gray-500 hover:text-white"><X className="w-3 h-3" /></button>
             </div>
             <div className="space-y-2">
               {COMMON_CLASSES.map(cls => (
                 <button
                   key={cls}
                   onClick={() => toggleFilter(cls)}
                   className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-mono transition-all ${
                     activeFilters.includes(cls) 
                       ? 'bg-hud-teal/20 text-hud-teal border border-hud-teal/50' 
                       : 'bg-black/40 text-gray-400 hover:bg-gray-800 border border-transparent'
                   }`}
                 >
                   <span className="capitalize">{cls}</span>
                   {activeFilters.includes(cls) ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                 </button>
               ))}
               <button 
                 onClick={() => setActiveFilters([])}
                 className="text-xs text-gray-400 hover:text-white underline w-full text-center mt-2"
               >
                 RESET FILTERS
               </button>
             </div>
          </div>
        )}

        {/* Camera Settings Overlay */}
        {showSettings && (
           <div className="absolute bottom-24 right-4 z-40 bg-hud-dark/95 border border-hud-gray p-4 rounded-lg shadow-xl backdrop-blur-md w-72 max-h-[60%] overflow-y-auto">
             <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-700">
               <h3 className="text-hud-teal font-mono text-sm font-bold flex items-center gap-2">
                 <Settings className="w-3 h-3" /> HARDWARE CONTROL
               </h3>
               <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-white"><X className="w-3 h-3" /></button>
             </div>
             
             {sourceType !== 'webcam' ? (
               <div className="text-center text-gray-500 text-xs py-4">
                 Controls unavailable for file inputs
               </div>
             ) : (!hasAnyControls) ? (
               <div className="text-center text-gray-500 text-xs py-4">
                 No adjustable hardware features detected on this camera.
               </div>
             ) : (
               <div className="space-y-6">
                 {/* Optics Section */}
                 {(camCaps.zoom || camCaps.focus) && (
                   <div className="space-y-4">
                     <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider border-b border-gray-800 pb-1">OPTICS</div>
                     {renderSlider("ZOOM", <ZoomIn className="w-3 h-3" />, camCaps.zoom, camSettings.zoom, 'zoom', 'x')}
                     {renderSlider("FOCUS", <ScanEye className="w-3 h-3" />, camCaps.focus, camSettings.focus, 'focus', 'm')}
                   </div>
                 )}

                 {/* Image Section */}
                 {(camCaps.brightness || camCaps.contrast || camCaps.saturation) && (
                   <div className="space-y-4">
                     <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider border-b border-gray-800 pb-1">IMAGE</div>
                     {renderSlider("BRIGHTNESS", <Sun className="w-3 h-3" />, camCaps.brightness, camSettings.brightness, 'brightness')}
                     {renderSlider("CONTRAST", <Sliders className="w-3 h-3" />, camCaps.contrast, camSettings.contrast, 'contrast')}
                     {renderSlider("SATURATION", <Palette className="w-3 h-3" />, camCaps.saturation, camSettings.saturation, 'saturation')}
                   </div>
                 )}
                 
                 {/* Torch Toggle */}
                 {camCaps.torch && (
                    <div className="flex items-center justify-between py-2 border-t border-gray-800 mt-2">
                       <span className="flex items-center gap-2 text-xs font-mono text-gray-300">
                         <Flashlight className="w-3 h-3" /> FLASHLIGHT
                       </span>
                       <button
                         onClick={() => handleCamSetting('torch', !camSettings.torch)}
                         className={`w-10 h-5 rounded-full relative transition-colors ${camSettings.torch ? 'bg-hud-teal' : 'bg-gray-700'}`}
                       >
                         <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${camSettings.torch ? 'left-6' : 'left-1'}`} />
                       </button>
                    </div>
                 )}
               </div>
             )}
           </div>
        )}

      </div>

      {/* Control Deck */}
      <div className="h-auto md:h-24 bg-hud-dark border-t border-hud-gray p-4 flex flex-col md:flex-row gap-6 items-center justify-between z-10">
        
        {/* Source Controls */}
        <div className="flex gap-2">
          {/* Power Button */}
          <button
            onClick={toggleCameraPower}
            className={`p-2 rounded font-mono text-sm transition-all ${
              sourceType === 'webcam' && isVideoReady
                ? 'bg-red-500/20 text-red-500 border border-red-500/50 shadow-[0_0_10px_rgba(255,42,109,0.2)]' 
                : 'bg-hud-gray text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
            title={sourceType === 'webcam' && isVideoReady ? "Turn Camera Off" : "Turn Camera On"}
          >
            {sourceType === 'webcam' && isVideoReady ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
          </button>

          <button
            onClick={() => handleSourceChange('webcam')}
            className={`flex items-center gap-2 px-4 py-2 rounded font-mono text-sm transition-all ${
              sourceType === 'webcam' 
                ? 'bg-hud-teal text-black shadow-[0_0_10px_rgba(0,240,255,0.4)]' 
                : 'bg-hud-gray text-gray-300 hover:bg-gray-700'
            }`}
          >
            <Camera className="w-4 h-4" /> WEBCAM
          </button>
          <label className={`flex items-center gap-2 px-4 py-2 rounded font-mono text-sm transition-all cursor-pointer ${
              sourceType === 'file' 
                ? 'bg-hud-teal text-black shadow-[0_0_10px_rgba(0,240,255,0.4)]' 
                : 'bg-hud-gray text-gray-300 hover:bg-gray-700'
            }`}>
            <Upload className="w-4 h-4" /> UPLOAD VIDEO
            <input type="file" accept="video/*" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-4">
           {isVideoReady && (
             <button
               onClick={() => {
                 if (isPlaying) {
                   videoRef.current?.pause();
                   setIsPlaying(false);
                 } else {
                   videoRef.current?.play();
                   setIsPlaying(true);
                 }
               }}
               className="p-3 rounded-full bg-hud-gray hover:bg-white text-black transition-colors"
             >
               {isPlaying ? <Pause className="fill-current" /> : <Play className="fill-current" />}
             </button>
           )}
           
           <button
             onClick={handleAnalyze}
             disabled={!isVideoReady || analyzing}
             className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
           >
             <Eye className="w-4 h-4" /> 
             {analyzing ? 'ANALYZING...' : 'AI SCAN'}
           </button>
        </div>

        {/* Toggles */}
        <div className="flex gap-2">
          {/* Ghost Mode Toggle */}
          <button
            onClick={() => setGhostMode(!ghostMode)}
            className={`flex items-center gap-2 px-3 py-2 rounded font-mono text-sm transition-all ${
              ghostMode 
                ? 'bg-purple-900/50 text-purple-400 border border-purple-500 shadow-[0_0_15px_rgba(147,51,234,0.3)]' 
                : 'bg-hud-gray text-gray-400 hover:bg-gray-700'
            }`}
            title="Toggle Paranormal Scanner"
          >
            <Ghost className="w-4 h-4" />
          </button>
          
          <button
             onClick={() => { setShowFilterMenu(!showFilterMenu); setShowSettings(false); }}
             className={`flex items-center gap-2 px-3 py-2 rounded font-mono text-sm transition-all ${showFilterMenu ? 'bg-hud-teal text-black' : 'bg-hud-gray text-gray-400 hover:bg-gray-700'}`}
             title="Object Filters"
          >
            <Filter className="w-4 h-4" />
          </button>

          <button
             onClick={() => { setShowSettings(!showSettings); setShowFilterMenu(false); }}
             className={`flex items-center gap-2 px-3 py-2 rounded font-mono text-sm transition-all ${showSettings ? 'bg-hud-teal text-black' : 'bg-hud-gray text-gray-400 hover:bg-gray-700'}`}
             title="Hardware Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Stats */}
        <div className="flex gap-4 md:gap-6 font-mono text-sm w-full md:w-auto justify-between md:justify-end">
          
          {ghostMode && (
            <div className="flex flex-col items-center animate-pulse">
              <span className="text-purple-400 text-xs">EMF LEVEL</span>
              <span className="text-purple-300 text-xl font-bold flex items-center gap-1">
                {emfLevel.toFixed(1)} <span className="text-xs">mG</span>
              </span>
            </div>
          )}

          {!ghostMode && (
            <>
              <div className="flex flex-col items-center">
                <span className="text-gray-500 text-xs">FPS</span>
                <span className="text-hud-teal text-xl font-bold">{fps}</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-gray-500 text-xs">OBJECTS</span>
                <span className={`${activeFilters.length > 0 ? 'text-hud-red' : 'text-hud-teal'} text-xl font-bold`}>
                  {objectCount}
                </span>
              </div>
            </>
          )}

          <div className="flex flex-col items-center">
             <span className="text-gray-500 text-xs">STATUS</span>
             {isPlaying ? 
               <span className={`${ghostMode ? 'text-purple-400' : 'text-green-500'} flex items-center gap-1`}>
                 <Activity className="w-3 h-3" /> {ghostMode ? 'SCANNING' : 'LIVE'}
               </span> : 
               <span className="text-yellow-500">PAUSED</span>
             }
          </div>
        </div>

      </div>
    </div>
  );
};

export default ObjectDetectionSystem;