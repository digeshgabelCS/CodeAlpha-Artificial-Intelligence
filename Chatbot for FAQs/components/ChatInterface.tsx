
import React, { useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { ChatMessage } from '../types';
import { speechService } from '../services/speechService';
import { liveService } from '../services/liveService';
import { ChatInput } from './ChatInput';
import { Menu, Loader2, Copy, Check, X, Volume2, Square, Radio, AudioLines, Sparkles, Download, Zap, BrainCircuit, Image as ImageIcon, PenTool, Sun, Moon, PanelLeft, Wand2, RotateCcw, RotateCw, RefreshCcw, AlertTriangle, PhoneOff, Mic, MicOff, Video, VideoOff, FileText } from 'lucide-react';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  inputValue: string;
  onInputChange: (val: string) => void;
  onSend: () => void;
  isTyping: boolean;
  typingStatus?: 'matching' | 'searching' | 'idle';
  onMobileMenuToggle?: () => void;
  onSuggestionClick: (text: string) => void;
  onImageSelect: (file: File | string) => void;
  selectedImage: string | null;
  onClearImage: () => void;
  // File props
  onFileSelect: (file: File) => void;
  selectedFile: { name: string; type: string; data: string } | null;
  onClearFile: () => void;
  
  theme: 'light' | 'dark';
  onThemeToggle: () => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

const WELCOME_SUGGESTIONS = [
    { 
        icon: <Zap className="w-5 h-5 text-yellow-500" />, 
        label: 'Product Info',
        text: 'What are the pricing tiers for NebulaFlow?' 
    },
    { 
        icon: <ImageIcon className="w-5 h-5 text-purple-500" />, 
        label: 'Image Generation',
        text: 'Generate a futuristic concept art of a nebula' 
    },
    { 
        icon: <BrainCircuit className="w-5 h-5 text-pink-500" />, 
        label: 'Tricky Questions',
        text: 'Solve this riddle: The more you take, the more you leave behind. What am I?' 
    },
    { 
        icon: <PenTool className="w-5 h-5 text-green-500" />, 
        label: 'Creative Writing',
        text: 'Draft a professional email about project delays' 
    },
];

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  inputValue,
  onInputChange,
  onSend,
  isTyping,
  typingStatus = 'searching',
  onMobileMenuToggle,
  onSuggestionClick,
  onImageSelect,
  selectedImage,
  onClearImage,
  onFileSelect,
  selectedFile,
  onClearFile,
  theme,
  onThemeToggle,
  isSidebarOpen,
  onToggleSidebar
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  
  // Voice Input State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const baseInputRef = useRef<string>('');
  
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Audio/TTS State
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isLoadingAudioId, setIsLoadingAudioId] = useState<string | null>(null);

  // Live Mode State
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [liveStatus, setLiveStatus] = useState<'idle' | 'connecting' | 'active' | 'error'>('idle');
  const [aiVolume, setAiVolume] = useState(0);
  const [userVolume, setUserVolume] = useState(0);
  const [isLiveCameraOn, setIsLiveCameraOn] = useState(false);
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const liveVideoCanvasRef = useRef<HTMLCanvasElement>(null);

  // Image Upload Animation State
  const [uploadProgress, setUploadProgress] = useState(0);

  // Image History State for Undo/Redo
  const [imageHistory, setImageHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isInternalUpdate = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, selectedImage, selectedFile]);
  
  // Manage Image History
  useEffect(() => {
    if (selectedImage) {
        if (!isInternalUpdate.current) {
            setImageHistory(prev => [...prev.slice(0, historyIndex + 1), selectedImage]);
            setHistoryIndex(prev => prev + 1);
        }
        isInternalUpdate.current = false;

        setUploadProgress(0);
        const interval = setInterval(() => {
            setUploadProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    return 100;
                }
                return prev + 25;
            });
        }, 80);
        return () => clearInterval(interval);
    } else {
        setUploadProgress(0);
        if (!isInternalUpdate.current && historyIndex >= 0) {
             setImageHistory([]);
             setHistoryIndex(-1);
        }
        isInternalUpdate.current = false;
    }
  }, [selectedImage]);

  const handleUndo = () => {
      if (historyIndex > 0) {
          isInternalUpdate.current = true;
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          onImageSelect(imageHistory[newIndex]);
      }
  };

  const handleRedo = () => {
      if (historyIndex < imageHistory.length - 1) {
          isInternalUpdate.current = true;
          const newIndex = historyIndex + 1;
          setHistoryIndex(newIndex);
          onImageSelect(imageHistory[newIndex]);
      }
  };

  const handleResetImage = () => {
      onClearImage();
  };

  useEffect(() => {
    return () => {
      speechService.stop();
      liveService.disconnect();
      if (recognitionRef.current) recognitionRef.current.abort();
    };
  }, []);

  // Handle Live Mode Video Stream
  useEffect(() => {
      if (isLiveMode && isLiveCameraOn && liveVideoRef.current) {
         navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: 640 } }).then(stream => {
             if (liveVideoRef.current) {
                 liveVideoRef.current.srcObject = stream;
                 liveVideoRef.current.play();
             }
         }).catch(err => {
             console.error("Live camera failed", err);
             setIsLiveCameraOn(false);
         });
      } else if (!isLiveCameraOn && liveVideoRef.current) {
          const stream = liveVideoRef.current.srcObject as MediaStream;
          if (stream) stream.getTracks().forEach(t => t.stop());
          liveVideoRef.current.srcObject = null;
      }
  }, [isLiveMode, isLiveCameraOn]);

  // Video Frame Loop for Live Mode
  useEffect(() => {
      let interval: any;
      if (isLiveMode && isLiveCameraOn) {
          interval = setInterval(() => {
              if (liveVideoRef.current && liveVideoCanvasRef.current && liveService.isConnected) {
                  const video = liveVideoRef.current;
                  const canvas = liveVideoCanvasRef.current;
                  const ctx = canvas.getContext('2d');
                  if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
                      canvas.width = video.videoWidth;
                      canvas.height = video.videoHeight;
                      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                      const base64 = canvas.toDataURL('image/jpeg', 0.6);
                      liveService.sendVideoFrame(base64);
                  }
              }
          }, 500); // Send 2 FPS
      }
      return () => clearInterval(interval);
  }, [isLiveMode, isLiveCameraOn]);


  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join('');
        const currentBase = baseInputRef.current;
        const separator = currentBase && !currentBase.endsWith(' ') && transcript ? ' ' : '';
        onInputChange(currentBase + separator + transcript);
      };

      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, []);

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) { console.error('Failed to copy', err); }
  };

  const handleSpeak = async (text: string, id: string) => {
    if (playingId === id) {
      speechService.stop();
      setPlayingId(null);
      return;
    }
    try {
      setIsLoadingAudioId(id);
      setPlayingId(id);
      await speechService.speak(text, () => setPlayingId(null));
    } catch (error) {
      setPlayingId(null);
    } finally {
      setIsLoadingAudioId(null);
    }
  };

  const handleDownloadImage = (imageUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      baseInputRef.current = inputValue; 
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleSendAction = () => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
    if (playingId) {
        speechService.stop();
        setPlayingId(null);
    }
    onSend();
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImageSelect(e.target.files[0]);
    }
    e.target.value = '';
  };

  const handleDocFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          onFileSelect(e.target.files[0]);
      }
      e.target.value = '';
  }

  const handleEditImageClick = () => {
      onInputChange("Edit this image: ");
  };

  // Live Mode
  const startLiveMode = async () => {
    setIsLiveMode(true);
    setLiveStatus('connecting');
    setAiVolume(0);
    setUserVolume(0);
    setIsLiveCameraOn(false);

    try {
      await liveService.startSession({
        onClose: () => {
            setLiveStatus('idle');
            setIsLiveMode(false);
            setIsLiveCameraOn(false);
        },
        onVolumeChange: (u, a) => {
            setUserVolume(u);
            setAiVolume(a);
        }
      });
      setLiveStatus('active');
    } catch (error) {
      setLiveStatus('error');
      setTimeout(() => {
          setIsLiveMode(false);
          setLiveStatus('idle');
      }, 2000);
    }
  };

  const endLiveMode = () => {
    liveService.disconnect();
    setLiveStatus('idle');
    setIsLiveMode(false);
    setIsLiveCameraOn(false);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#212121] text-gray-900 dark:text-gray-100 relative">
      
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 md:px-4 md:py-2 shrink-0 z-10 md:absolute md:top-2 md:left-2 md:right-2">
        <div className="flex items-center gap-2">
            {/* Mobile Sidebar Toggle */}
            <button onClick={onMobileMenuToggle} className="md:hidden p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-[#2f2f2f] rounded-lg">
                <Menu className="w-5 h-5" />
            </button>
            <span className="font-semibold text-sm md:hidden">Nexora 2.5</span>
            
            {/* Desktop Open Sidebar Button */}
            {!isSidebarOpen && (
                <button 
                    onClick={onToggleSidebar}
                    className="hidden md:flex p-2 hover:bg-gray-100 dark:hover:bg-[#2f2f2f] rounded-lg text-gray-500 dark:text-gray-400"
                    title="Open Sidebar"
                >
                    <PanelLeft className="w-5 h-5" />
                </button>
            )}

            {/* Version Badge (Moved to Left) */}
            <div className="hidden md:flex items-center gap-2 bg-gray-100 dark:bg-[#2f2f2f] px-3 py-1.5 rounded-full cursor-pointer hover:bg-gray-200 dark:hover:bg-[#424242] transition-colors">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Nexora 2.5 Flash</span>
                <Sparkles className="w-3 h-3 text-purple-500" />
            </div>
        </div>
        
        <div className="ml-auto flex items-center gap-2">
            <button 
                onClick={onThemeToggle}
                className="p-2 hover:bg-gray-100 dark:hover:bg-[#2f2f2f] rounded-full transition-all text-gray-500 dark:text-gray-400"
                title={theme === 'light' ? "Switch to Dark Mode" : "Switch to Light Mode"}
            >
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <button onClick={startLiveMode} className={`p-2 hover:bg-gray-100 dark:hover:bg-[#2f2f2f] rounded-full transition-all ${liveStatus === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : ''}`} title="Live Voice">
                <Radio className={`w-5 h-5 ${liveStatus === 'active' ? 'text-green-600 dark:text-green-400' : 'text-gray-500 hover:text-green-500'} transition-colors`} />
            </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-hide pt-14 pb-4">
        <div className="max-w-3xl mx-auto px-3 md:px-6 space-y-4 md:space-y-6 h-full">
          {messages.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-full pb-20 animate-in fade-in zoom-in-95 duration-700">
                
                {/* Hero Section */}
                <div className="mb-8 md:mb-10 flex flex-col items-center space-y-4 md:space-y-5">
                    <div className="relative w-20 h-20 md:w-24 md:h-24 flex items-center justify-center">
                        <div className="absolute inset-0 bg-purple-500 rounded-2xl blur-2xl opacity-20 dark:opacity-40 animate-pulse"></div>
                        <div className="relative w-full h-full bg-white dark:bg-[#2f2f2f] rounded-3xl border border-gray-100 dark:border-white/10 shadow-2xl flex items-center justify-center transform hover:scale-105 transition-transform duration-500 group">
                            <Sparkles className="w-10 h-10 md:w-12 md:h-12 text-purple-600 dark:text-purple-400 group-hover:rotate-12 transition-transform duration-500" strokeWidth={1.5} />
                        </div>
                    </div>
                    <div className="text-center space-y-2 md:space-y-3 px-4">
                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-900 dark:text-white tracking-tight">
                            Welcome to Nexora
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm md:text-base max-w-lg mx-auto leading-relaxed">
                            Your advanced AI pilot for NebulaFlow. Capable of analyzing data, generating art, and answering complex queries.
                        </p>
                    </div>
                </div>

                {/* Suggestion Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3 w-full max-w-2xl px-2">
                    {WELCOME_SUGGESTIONS.map((item, i) => (
                        <button 
                            key={i} 
                            onClick={() => onSuggestionClick(item.text)} 
                            className="group relative p-3 md:p-4 flex items-start gap-3 md:gap-4 bg-white dark:bg-[#2f2f2f] hover:bg-gray-50 dark:hover:bg-[#383838] border border-gray-200 dark:border-white/5 rounded-2xl transition-all hover:shadow-lg hover:border-purple-500/20 text-left overflow-hidden"
                        >
                            <div className="p-2 md:p-2.5 rounded-xl bg-gray-50 dark:bg-black/20 group-hover:bg-white dark:group-hover:bg-[#424242] transition-colors shrink-0">
                                {item.icon}
                            </div>
                            <div className="flex flex-col gap-0.5 z-10">
                                <span className="text-[10px] md:text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                    {item.label}
                                </span>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white transition-colors line-clamp-2">
                                    {item.text}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
             </div>
          ) : (
             messages.map((msg) => (
                <div key={msg.id} id={`msg-${msg.id}`} className="group flex flex-col gap-1 w-full text-base">
                   
                   {/* User Message */}
                   {msg.role === 'user' ? (
                       <div className="flex w-full gap-3 md:gap-4 flex-row-reverse">
                           {/* User Avatar Removed as per request */}
                           
                           <div className="max-w-[85%] flex flex-col items-end">
                               <div className="bg-[#f4f4f4] dark:bg-[#2f2f2f] px-4 py-2.5 md:px-5 md:py-3 rounded-2xl md:rounded-3xl rounded-br-md text-gray-900 dark:text-gray-100 text-sm md:text-base">
                                   {msg.image && (
                                       <div className="mb-2 rounded-lg overflow-hidden">
                                           <img src={msg.image} alt="Upload" className="max-w-full max-h-[300px] object-cover" />
                                       </div>
                                   )}
                                   {msg.attachment && (
                                       <div className="mb-2 flex items-center gap-3 bg-white dark:bg-[#1a1a1a] p-3 rounded-xl border border-gray-200 dark:border-white/10">
                                           <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                                               <FileText className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                                           </div>
                                           <div className="flex flex-col">
                                               <span className="text-sm font-medium truncate max-w-[150px]">{msg.attachment.name}</span>
                                               <span className="text-[10px] text-gray-500 uppercase">{msg.attachment.mimeType.split('/')[1] || 'FILE'}</span>
                                           </div>
                                       </div>
                                   )}
                                   <div>{msg.content}</div>
                               </div>
                               {/* Footer Actions for User */}
                               <div className="flex items-center gap-2 pt-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end pr-2">
                                   <button onClick={() => handleCopy(msg.content, msg.id)} className="p-1 hover:text-gray-900 dark:hover:text-white text-gray-400 transition-colors rounded">
                                       {copiedId === msg.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                   </button>
                                   <button onClick={() => handleSpeak(msg.content, msg.id)} className="p-1 hover:text-gray-900 dark:hover:text-white text-gray-400 transition-colors rounded">
                                       {isLoadingAudioId === msg.id ? <Loader2 className="w-3 h-3 animate-spin" /> : playingId === msg.id ? <Square className="w-3 h-3 fill-current" /> : <Volume2 className="w-3 h-3" />}
                                   </button>
                               </div>
                           </div>
                       </div>
                   ) : (
                       /* Bot Message */
                       <div className="flex gap-3 md:gap-4 w-full">
                           <div className="shrink-0 w-8 h-8 rounded-full border border-gray-200 dark:border-white/10 flex items-center justify-center mt-1">
                               <Sparkles className="w-4 h-4 text-purple-500" />
                           </div>
                           <div className="flex-1 space-y-2 overflow-hidden">
                               <div className="flex items-center gap-2 mb-1">
                                   <div className="font-semibold text-sm opacity-90">Nexora</div>
                                   {playingId === msg.id && (
                                       <div className="flex items-center gap-1">
                                           <div className="flex items-end gap-0.5 h-3">
                                               <span className="w-0.5 bg-purple-500 rounded-full animate-[bounce_1s_infinite] h-full"></span>
                                               <span className="w-0.5 bg-purple-500 rounded-full animate-[bounce_1s_infinite_0.1s] h-[80%]"></span>
                                               <span className="w-0.5 bg-purple-500 rounded-full animate-[bounce_1s_infinite_0.2s] h-full"></span>
                                           </div>
                                       </div>
                                   )}
                               </div>
                               
                               {/* Image Rendering */}
                               {msg.image && (
                                   <div className="mb-2 max-w-sm rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 relative group/image">
                                       <img src={msg.image} alt="Generated" className="w-full h-auto" />
                                       <button 
                                          onClick={() => handleDownloadImage(msg.image!, `nexora-image-${msg.id}.png`)}
                                          className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-md opacity-0 group-hover/image:opacity-100 transition-opacity backdrop-blur-sm"
                                          title="Download Image"
                                       >
                                          <Download className="w-4 h-4" />
                                       </button>
                                   </div>
                               )}

                               <div className="markdown-content text-sm md:text-base">
                                   <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{msg.content}</ReactMarkdown>
                               </div>

                               {msg.suggestions && msg.suggestions.length > 0 && (
                                   <div className="flex flex-wrap gap-2 mt-2">
                                       {msg.suggestions.map((s, i) => (
                                           <button 
                                               key={i} 
                                               onClick={() => onSuggestionClick(s)}
                                               className="text-xs py-1.5 px-3 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#2f2f2f] hover:bg-gray-50 dark:hover:bg-[#424242] transition-colors text-gray-600 dark:text-gray-300"
                                           >
                                               {s}
                                           </button>
                                       ))}
                                   </div>
                               )}
                               
                               {/* Footer Actions */}
                               <div className="flex items-center gap-2 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                   <button onClick={() => handleCopy(msg.content, msg.id)} className="p-1 hover:text-gray-900 dark:hover:text-white text-gray-400 transition-colors rounded">
                                       {copiedId === msg.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                   </button>
                                   <button onClick={() => handleSpeak(msg.content, msg.id)} className="p-1 hover:text-gray-900 dark:hover:text-white text-gray-400 transition-colors rounded">
                                       {isLoadingAudioId === msg.id ? <Loader2 className="w-4 h-4 animate-spin" /> : playingId === msg.id ? <Square className="w-4 h-4 fill-current" /> : <Volume2 className="w-4 h-4" />}
                                   </button>
                               </div>
                           </div>
                       </div>
                   )}
                </div>
             ))
          )}
          {isTyping && (
             <div className="flex gap-3 md:gap-4 w-full max-w-3xl mx-auto px-3 md:px-6 animate-in fade-in duration-300">
                <div className="shrink-0 w-8 h-8 rounded-full border border-gray-200 dark:border-white/10 flex items-center justify-center mt-1 bg-white dark:bg-[#1a1a1a]">
                    <Sparkles className="w-4 h-4 text-purple-500 animate-pulse" />
                </div>
                <div className="flex items-center h-10">
                    <span className="text-sm text-gray-500 dark:text-gray-400 animate-pulse font-medium">
                        {typingStatus === 'matching' ? 'Analyzing knowledge base...' : 'Nexora is thinking...'}
                    </span>
                </div>
             </div>
          )}
          <div ref={messagesEndRef} className="h-4" />
        </div>
      </div>

      {/* Input Area */}
      <div className="shrink-0 w-full bg-white dark:bg-[#212121] pb-2 md:pb-4">
          {(selectedImage || selectedFile) && (
              <div className="max-w-3xl mx-auto px-4 md:px-6 mb-3 animate-in fade-in slide-in-from-bottom-2">
                 <div className="flex items-end gap-3">
                     {selectedImage ? (
                        <div className="relative group rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 shadow-sm bg-gray-100 dark:bg-[#2f2f2f] shrink-0">
                             <img src={selectedImage} alt="Preview" className="h-20 w-auto max-w-[120px] object-cover" />
                             
                             {/* Progress Bar with Success State */}
                             <div className={`absolute bottom-0 left-0 h-1 transition-all duration-300 ${uploadProgress === 100 ? 'bg-green-500 w-full' : 'bg-blue-500'}`} style={{ width: `${uploadProgress}%` }} />
                             
                             {/* Overlay actions */}
                             <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                 <button 
                                     onClick={onClearImage} 
                                     className="p-1.5 bg-white/20 hover:bg-red-500/80 text-white rounded-full backdrop-blur-sm transition-colors"
                                     title="Remove image"
                                 >
                                     <X className="w-4 h-4" />
                                 </button>
                             </div>
                        </div>
                     ) : (
                         <div className="relative group rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 shadow-sm bg-gray-100 dark:bg-[#2f2f2f] shrink-0 p-3 flex items-center gap-3">
                             <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                                 <FileText className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                             </div>
                             <div className="flex flex-col max-w-[150px]">
                                 <span className="text-sm font-medium truncate">{selectedFile?.name}</span>
                                 <span className="text-xs text-gray-500 uppercase">{selectedFile?.type?.split('/')[1] || 'FILE'}</span>
                             </div>
                             
                             <button 
                                 onClick={onClearFile} 
                                 className="absolute -top-1 -right-1 p-1 bg-gray-200 hover:bg-red-500 text-gray-500 hover:text-white rounded-full transition-colors"
                                 title="Remove file"
                             >
                                 <X className="w-3 h-3" />
                             </button>
                         </div>
                     )}
                     
                     <div className="flex flex-col gap-2 pb-1">
                        {selectedImage && (
                            <>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                                        <span className={`w-2 h-2 rounded-full ${uploadProgress === 100 ? 'bg-green-500' : 'bg-blue-500'} ${uploadProgress < 100 ? 'animate-pulse' : ''}`}></span>
                                        {uploadProgress === 100 ? 'Image ready' : 'Processing...'}
                                    </span>
                                </div>
                                
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <button
                                        onClick={handleEditImageClick}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-lg transition-colors border border-purple-200 dark:border-purple-800"
                                    >
                                        <Wand2 className="w-3.5 h-3.5" />
                                        Edit Image
                                    </button>

                                    <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-0.5"></div>

                                    <button
                                        onClick={handleUndo}
                                        disabled={historyIndex <= 0}
                                        className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                        title="Undo Last Upload"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                    </button>
                                    
                                    <button
                                        onClick={handleRedo}
                                        disabled={historyIndex >= imageHistory.length - 1}
                                        className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                        title="Redo Upload"
                                    >
                                        <RotateCw className="w-3.5 h-3.5" />
                                    </button>

                                    <button
                                        onClick={handleResetImage}
                                        className="flex items-center gap-1 p-1.5 text-xs font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                        title="Reset / Clear"
                                    >
                                        <RefreshCcw className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </>
                        )}
                     </div>
                 </div>
              </div>
          )}
          
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageFileChange} />
          <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleImageFileChange} />
          <input type="file" ref={docInputRef} className="hidden" accept=".pdf,.txt,.csv,.json,.md,.docx,.html,.js,.ts,.py" onChange={handleDocFileChange} />

          <ChatInput
            value={inputValue}
            onChange={onInputChange}
            onSubmit={handleSendAction}
            isListening={isListening}
            onMicToggle={toggleListening}
            onAttachmentClick={() => fileInputRef.current?.click()}
            onCameraClick={() => cameraInputRef.current?.click()}
            onFileUploadClick={() => docInputRef.current?.click()}
            onGenerateImageClick={() => onInputChange("Generate an image of ")}
            onDeepResearchClick={() => onInputChange("Deep research on: ")}
            disabled={!inputValue.trim() && !selectedImage && !selectedFile}
            placeholder={selectedImage ? "Ask me to analyze, describe, or edit this image..." : selectedFile ? "Ask me to analyze this file..." : "Ask anything"}
          />
          
          <div className="text-center px-4">
              <span className="text-[10px] text-gray-400 dark:text-gray-500 block leading-tight">
                  Nexora can make mistakes. Check important info.
              </span>
          </div>
      </div>

      {/* Modern Live Overlay */}
      {isLiveMode && (
         <div className="fixed inset-0 z-50 flex flex-col items-center justify-center animate-in fade-in duration-300">
             {/* Backdrop Blur Layer */}
             <div className="absolute inset-0 bg-white/90 dark:bg-black/90 backdrop-blur-2xl"></div>
             
             {/* Dynamic Background Mesh */}
             <div className="absolute inset-0 opacity-30 dark:opacity-20 pointer-events-none overflow-hidden">
                 <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse-slow"></div>
                 <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse-slow animation-delay-2000"></div>
             </div>

             <div className="relative z-10 flex flex-col items-center w-full max-w-lg px-6">
                 
                 {/* Live Camera View (Floating) */}
                 <div className={`relative transition-all duration-500 ease-in-out overflow-hidden rounded-2xl shadow-2xl border border-white/10 bg-black ${isLiveCameraOn ? 'h-48 w-full opacity-100 mb-8' : 'h-0 w-full opacity-0 mb-0'}`}>
                     <video ref={liveVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                     <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 px-2 py-1 rounded-md backdrop-blur-sm">
                         <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                         <span className="text-[10px] text-white font-medium uppercase">Live Feed</span>
                     </div>
                 </div>
                 {/* Canvas for processing frames */}
                 <canvas ref={liveVideoCanvasRef} className="hidden" />

                 {/* Visualizer / Status Orb */}
                 <div className="relative w-40 h-40 flex items-center justify-center mb-12">
                    {/* Ring 1 (AI Volume) */}
                    <div 
                        className="absolute inset-0 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 opacity-80 blur-md transition-transform duration-75"
                        style={{ transform: `scale(${1 + Math.min(aiVolume * 3, 1.5)})` }}
                    ></div>
                    {/* Ring 2 (User Volume) */}
                    <div 
                        className="absolute inset-4 rounded-full bg-white dark:bg-black border-4 border-purple-100 dark:border-purple-900/30 transition-transform duration-75 z-10 flex items-center justify-center"
                        style={{ transform: `scale(${1 + Math.min(userVolume * 1.5, 0.5)})` }}
                    >
                        <Sparkles className="w-12 h-12 text-purple-600 dark:text-purple-400" />
                    </div>
                 </div>

                 <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2 tracking-tight">
                     {liveStatus === 'active' ? (aiVolume > 0.05 ? "Nexora is speaking..." : "Listening...") : "Connecting..."}
                 </h2>
                 <p className="text-gray-500 dark:text-gray-400 text-sm mb-12 text-center max-w-xs mx-auto">
                     Have a fluid, natural conversation. Use the camera to show objects around you.
                 </p>

                 {/* Controls */}
                 <div className="flex items-center gap-6">
                     <button 
                        onClick={() => setIsLiveCameraOn(!isLiveCameraOn)}
                        className={`p-4 rounded-full transition-all duration-300 ${isLiveCameraOn ? 'bg-white text-black shadow-lg scale-110' : 'bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-white hover:bg-gray-300 dark:hover:bg-white/20'}`}
                     >
                         {isLiveCameraOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                     </button>
                     
                     <button 
                        onClick={endLiveMode} 
                        className="p-6 bg-red-500 rounded-full text-white hover:bg-red-600 transition-all shadow-lg shadow-red-500/30 hover:scale-105 active:scale-95"
                     >
                        <PhoneOff className="w-8 h-8 fill-current" />
                     </button>
                 </div>
             </div>
         </div>
      )}
    </div>
  );
};
