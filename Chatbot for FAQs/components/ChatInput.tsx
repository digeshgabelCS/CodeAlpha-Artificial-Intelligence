import React, { useState, useRef, useEffect } from 'react';
import { Plus, Mic, ArrowUp, Camera, Image as ImageIcon, Sparkles, Globe, FileText } from 'lucide-react';

interface ChatInputProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  isListening?: boolean;
  onMicToggle?: () => void;
  onAttachmentClick?: () => void;
  onCameraClick?: () => void;
  onFileUploadClick?: () => void;
  onGenerateImageClick?: () => void;
  onDeepResearchClick?: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSubmit,
  isListening,
  onMicToggle,
  onAttachmentClick,
  onCameraClick,
  onFileUploadClick,
  onGenerateImageClick,
  onDeepResearchClick,
  disabled,
  placeholder
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasContent = value.trim().length > 0;

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      // Reset height to allow shrinking
      textareaRef.current.style.height = 'auto';
      // Set height based on scrollHeight, maxing out at 200px
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-4 flex items-center justify-center relative z-20">
      {/* Floating Pill Container */}
      <div className="w-full flex items-end gap-2 bg-white/90 dark:bg-[#171717]/90 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[32px] p-2 shadow-2xl dark:shadow-black/50 transition-all duration-300 hover:shadow-xl dark:hover:border-white/15 focus-within:ring-1 focus-within:ring-gray-300 dark:focus-within:ring-white/10">
        
        {/* Left Action (Plus Menu) */}
        <div className="relative shrink-0 mb-1 ml-1" ref={menuRef}>
            {showMenu && (
                <div className="absolute bottom-full left-0 mb-4 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl p-1.5 flex flex-col gap-1 min-w-[200px] animate-in fade-in slide-in-from-bottom-2 zoom-in-95 backdrop-blur-lg">
                    <button 
                        onClick={() => {
                            onAttachmentClick?.();
                            setShowMenu(false);
                        }}
                        className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] rounded-xl transition-colors text-left"
                    >
                        <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                             <ImageIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        Upload Image
                    </button>
                    <button 
                        onClick={() => {
                            onCameraClick?.();
                            setShowMenu(false);
                        }}
                        className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] rounded-xl transition-colors text-left"
                    >
                        <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                             <Camera className="w-4 h-4 text-green-600 dark:text-green-400" />
                        </div>
                        Take Photo
                    </button>
                    <button 
                        onClick={() => {
                            onFileUploadClick?.();
                            setShowMenu(false);
                        }}
                        className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] rounded-xl transition-colors text-left"
                    >
                        <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                             <FileText className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                        </div>
                        Upload File
                    </button>
                    <button 
                        onClick={() => {
                            onGenerateImageClick?.();
                            setShowMenu(false);
                        }}
                        className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] rounded-xl transition-colors text-left"
                    >
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                             <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        Generate Image
                    </button>
                    <button 
                        onClick={() => {
                            onDeepResearchClick?.();
                            setShowMenu(false);
                        }}
                        className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] rounded-xl transition-colors text-left"
                    >
                        <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                             <Globe className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                        </div>
                        Deep Research
                    </button>
                </div>
            )}
            
            <button 
                onClick={() => setShowMenu(!showMenu)}
                className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-200 ${
                  showMenu 
                    ? 'bg-gray-200 dark:bg-[#333] text-gray-900 dark:text-white rotate-45' 
                    : 'bg-gray-100 dark:bg-[#2a2a2a] text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#333] hover:text-gray-900 dark:hover:text-white'
                }`}
                title="Add Attachment"
            >
              <Plus size={20} strokeWidth={2} />
            </button>
        </div>

        {/* Auto-Resizing Text Area */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? "Listening..." : "Ask anything"}
          className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none text-[16px] w-full min-w-0 resize-none max-h-[200px] overflow-y-auto scrollbar-hide py-3 leading-6 font-normal"
          spellCheck={true}
          rows={1}
        />

        {/* Right Actions (Mic & Send) */}
        <div className="flex items-center gap-2 shrink-0 mb-1 mr-1">
          {/* Microphone */}
          <button 
            onClick={onMicToggle}
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-200 ${
              isListening 
                ? 'bg-red-500/10 text-red-500 animate-pulse' 
                : 'bg-transparent hover:bg-gray-100 dark:hover:bg-[#2a2a2a] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
            title="Voice Input"
          >
            {isListening ? (
                <div className="flex items-center gap-[3px] h-4">
                    <div className="w-1 bg-current rounded-full animate-wave-1 h-3"></div>
                    <div className="w-1 bg-current rounded-full animate-wave-2 h-5"></div>
                    <div className="w-1 bg-current rounded-full animate-wave-3 h-3"></div>
                </div>
            ) : (
                <Mic size={22} strokeWidth={1.5} />
            )}
          </button>
          
          {/* Send Button */}
          <button 
            onClick={onSubmit}
            disabled={disabled || !hasContent}
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 ${
                hasContent 
                ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg hover:scale-105 active:scale-95' 
                : 'bg-gray-200 dark:bg-[#2a2a2a] text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
            }`}
          >
            <ArrowUp size={20} strokeWidth={2.5} />
          </button>
        </div>

      </div>
    </div>
  );
};
