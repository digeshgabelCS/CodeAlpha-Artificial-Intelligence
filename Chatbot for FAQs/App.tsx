
import React, { useState, useEffect, useRef } from 'react';
import { ChatInterface } from './components/ChatInterface';
import { Sidebar } from './components/Sidebar';
import { FAQ_DATA } from './constants';
import { ChatMessage, Intent, ChatSession } from './types';
import { nlpService } from './services/nlpService';
import { geminiService } from './services/geminiService';
import { speechService } from './services/speechService';

const SESSIONS_STORAGE_KEY = 'nebula_chat_sessions';
const THEME_KEY = 'nebula_theme';

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const App: React.FC = () => {
  // --- State Management ---
  
  // All Chat Sessions
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem(SESSIONS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Rehydrate Dates in messages if necessary (though we store timestamps as numbers in Session, messages use Date objects in runtime)
        return parsed.map((session: any) => ({
          ...session,
          messages: session.messages.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          }))
        })).sort((a: ChatSession, b: ChatSession) => b.updatedAt - a.updatedAt);
      }
    } catch (e) {
      console.error("Failed to load chat sessions", e);
    }
    return []; 
  });

  // Current Active Chat
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // UI State
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingStatus, setTypingStatus] = useState<'matching' | 'searching' | 'idle'>('idle');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<{ name: string; type: string; data: string } | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
      if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch (e) {
      console.error("Failed to load theme", e);
    }
    return 'dark'; 
  });

  // --- Effects ---

  // Apply theme
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // Initialize NLP
  useEffect(() => {
    nlpService.initialize(FAQ_DATA);
  }, []);

  // Persist Sessions when they change
  useEffect(() => {
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  // Sync Messages to Current Session
  // Whenever `messages` changes, we update the `sessions` array for the current ID
  useEffect(() => {
    if (currentSessionId && messages.length > 0) {
      setSessions(prev => prev.map(session => {
        if (session.id === currentSessionId) {
          return {
            ...session,
            messages: messages,
            updatedAt: Date.now(),
            // Update title if it's "New Chat" and we have a user message
            title: (session.title === 'New Chat' && messages[0]) 
              ? (messages[0].content.slice(0, 30) + (messages[0].content.length > 30 ? '...' : ''))
              : session.title
          };
        }
        return session;
      }));
    }
  }, [messages, currentSessionId]);

  // --- Handlers ---

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
  const toggleSidebar = () => setIsSidebarOpen(prev => !prev);

  const handleNewChat = () => {
    speechService.stop();
    setMessages([]);
    setCurrentSessionId(null);
    setInputValue('');
    setSelectedImage(null);
    setSelectedFile(null);
    setIsMobileMenuOpen(false);
  };

  const handleSessionSelect = (sessionId: string) => {
    speechService.stop();
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setCurrentSessionId(sessionId);
      setMessages(session.messages);
      setInputValue('');
      setSelectedImage(null);
      setSelectedFile(null);
      setIsMobileMenuOpen(false);
    }
  };

  const handleClearAllSessions = () => {
    setSessions([]);
    handleNewChat();
  };

  const handleDeleteSession = (sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (currentSessionId === sessionId) {
        handleNewChat();
    }
  };

  const handleImageSelect = (fileOrString: File | string) => {
    if (typeof fileOrString === 'string') {
        setSelectedImage(fileOrString);
        setSelectedFile(null); // Mutually exclusive for simplicity in this version
    } else {
        const reader = new FileReader();
        reader.onloadend = () => {
          setSelectedImage(reader.result as string);
          setSelectedFile(null);
        };
        reader.readAsDataURL(fileOrString);
    }
  };

  const handleFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
        setSelectedFile({
            name: file.name,
            type: file.type,
            data: reader.result as string
        });
        setSelectedImage(null); // Mutually exclusive
    };
    reader.readAsDataURL(file);
  };

  const handleHistoryMessageClick = (messageId: string) => {
    // Scroll to message logic
    setIsMobileMenuOpen(false);
    setTimeout(() => {
        const el = document.getElementById(`msg-${messageId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 100);
  };

  // --- Core Logic ---

  const processMessage = async (text: string) => {
    const finalContent = text.trim() || (selectedImage ? "Analyze this image" : selectedFile ? "Analyze this file" : "");
    if (!finalContent) return;

    // Detect Intent first to check for commands
    const detectedIntent: Intent = nlpService.detectIntent(finalContent);

    // ACTION: Clear Chat Command
    if (detectedIntent === 'CLEAR_CHAT') {
        handleNewChat();
        return;
    }

    // 1. Setup Session if needed
    let activeSessionId = currentSessionId;
    let currentMessages = messages;

    if (!activeSessionId) {
        // Create new session
        const newSessionId = generateId();
        const newSession: ChatSession = {
            id: newSessionId,
            title: finalContent.slice(0, 30) + (finalContent.length > 30 ? '...' : ''),
            messages: [], // Will be populated shortly
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        // Update State
        setCurrentSessionId(newSessionId);
        activeSessionId = newSessionId;
        setSessions(prev => [newSession, ...prev]);
    }

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: finalContent,
      timestamp: new Date(),
      metadata: { detectedIntent },
      image: selectedImage || undefined,
      attachment: selectedFile ? {
          name: selectedFile.name,
          mimeType: selectedFile.type,
          data: selectedFile.data
      } : undefined
    };

    // Update local message view immediately
    const updatedMessagesWithUser = [...currentMessages, userMsg];
    setMessages(updatedMessagesWithUser);
    
    setInputValue('');
    setSelectedImage(null);
    setSelectedFile(null);
    
    // Check Local NLP first
    if (detectedIntent !== 'IMAGE_GENERATION' && !userMsg.image && !userMsg.attachment) {
        const lastBotMsg = updatedMessagesWithUser.filter(m => m.role === 'bot').pop();
        
        const localMatch = nlpService.findBestMatch(finalContent, {
            previousCategory: lastBotMsg?.metadata?.category,
            currentIntent: detectedIntent,
            faqs: FAQ_DATA
        });

        if (localMatch && localMatch.score >= 0.65) {
            setIsTyping(true);
            setTypingStatus('matching');
            
            // Simulate slight delay for "reading" feel
            await new Promise(resolve => setTimeout(resolve, 600));

            const botMsg: ChatMessage = {
                id: generateId(),
                role: 'bot',
                content: localMatch.faq.answer,
                timestamp: new Date(),
                suggestions: nlpService.getRelatedQuestions(FAQ_DATA, localMatch.faq),
                metadata: {
                    source: 'local-nlp',
                    matchScore: localMatch.score,
                    matchedQuestion: localMatch.faq.question,
                    category: localMatch.faq.category,
                    detectedIntent
                }
            };
            setMessages(prev => [...prev, botMsg]);
            setIsTyping(false);
            setTypingStatus('idle');
            return; 
        }
    }

    // Cloud Fallback
    setIsTyping(true);
    setTypingStatus('searching');

    try {
        const geminiResponse = await geminiService.getConversationalResponse(
            userMsg.content, 
            updatedMessagesWithUser, 
            FAQ_DATA,
            detectedIntent,
            userMsg.image,
            userMsg.attachment
        );
        
        const botMsg: ChatMessage = {
            id: generateId(),
            role: 'bot',
            content: geminiResponse.text,
            timestamp: new Date(),
            suggestions: geminiResponse.suggestions,
            image: geminiResponse.image,
            metadata: {
                source: 'gemini-ai',
                groundingChunks: geminiResponse.groundingChunks,
                detectedIntent
            }
        };
        setMessages(prev => [...prev, botMsg]);
    } catch (error: any) {
        console.error("Pipeline Error:", error);
        
        let errorContent = "I encountered an error processing your request. Please try again.";
        let errorSuggestions: string[] = [];

        if (detectedIntent === 'IMAGE_GENERATION') {
            errorContent = "I couldn't generate an image for that prompt. It may have triggered safety filters or the model is currently overloaded.";
            errorSuggestions = [
                "Try a simpler description",
                "Avoid explicit or controversial terms",
                "Ask for a textual description instead"
            ];
        }

        const errorMsg: ChatMessage = {
          id: generateId(),
          role: 'bot',
          content: errorContent,
          timestamp: new Date(),
          suggestions: errorSuggestions.length > 0 ? errorSuggestions : undefined,
          metadata: { source: 'gemini-ai' }
        };
        setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
      setTypingStatus('idle');
    }
  };

  const handleSend = () => processMessage(inputValue);

  const handleSuggestionClick = (text: string) => {
    processMessage(text);
  };

  return (
    <div className="flex h-full w-full bg-white dark:bg-gpt-dark text-gray-900 dark:text-gray-100 font-sans transition-colors duration-200">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 md:hidden" 
          onClick={() => setIsMobileMenuOpen(false)}
        >
            <div 
                className="absolute left-0 top-0 bottom-0 w-[85%] max-w-[280px] bg-gpt-sidebar"
                onClick={(e) => e.stopPropagation()}
            >
                <Sidebar 
                    sessions={sessions}
                    currentSessionId={currentSessionId}
                    onSessionSelect={handleSessionSelect}
                    onSessionDelete={handleDeleteSession}
                    onNewChat={handleNewChat}
                    onClearAll={handleClearAllSessions}
                    onClose={() => setIsMobileMenuOpen(false)}
                    theme={theme}
                    onThemeToggle={toggleTheme}
                />
            </div>
        </div>
      )}

      {/* Desktop Sidebar with Animation */}
      <div 
        className={`hidden md:flex flex-col h-full bg-[#f9f9f9] dark:bg-gpt-sidebar transition-[width,opacity] duration-300 ease-in-out shrink-0 overflow-hidden ${
            isSidebarOpen ? 'w-[260px] border-r border-gray-200 dark:border-transparent opacity-100' : 'w-0 border-r-0 opacity-0'
        }`}
      >
          {/* Inner container with fixed width to prevent content reflow during animation */}
          <div className="w-[260px] h-full flex flex-col">
              <Sidebar 
                  sessions={sessions}
                  currentSessionId={currentSessionId}
                  onSessionSelect={handleSessionSelect}
                  onSessionDelete={handleDeleteSession}
                  onNewChat={handleNewChat}
                  onClearAll={handleClearAllSessions}
                  theme={theme}
                  onThemeToggle={toggleTheme}
                  onToggleSidebar={toggleSidebar}
              />
          </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative min-w-0 transition-colors duration-200">
          <ChatInterface 
              messages={messages}
              inputValue={inputValue}
              onInputChange={setInputValue}
              onSend={handleSend}
              isTyping={isTyping}
              typingStatus={typingStatus}
              onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
              onSuggestionClick={handleSuggestionClick}
              onImageSelect={handleImageSelect}
              selectedImage={selectedImage}
              onClearImage={() => setSelectedImage(null)}
              // File props
              onFileSelect={handleFileSelect}
              selectedFile={selectedFile}
              onClearFile={() => setSelectedFile(null)}
              
              theme={theme}
              onThemeToggle={toggleTheme}
              isSidebarOpen={isSidebarOpen}
              onToggleSidebar={toggleSidebar}
          />
      </div>
    </div>
  );
};

export default App;
