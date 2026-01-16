
import React, { useState } from 'react';
import { ChatSession, User } from '../types';
import { Plus, MessageSquare, X, Moon, Sun, Trash2, Check, PanelLeft, LogOut, Share } from 'lucide-react';
import { jsPDF } from 'jspdf';

interface SidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  user?: User;
  onSessionSelect: (id: string) => void;
  onSessionDelete?: (id: string) => void;
  onNewChat: () => void;
  onClearAll: () => void;
  onLogout?: () => void;
  onClose?: () => void;
  theme: 'light' | 'dark';
  onThemeToggle: () => void;
  onToggleSidebar?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
    sessions, 
    currentSessionId,
    user,
    onSessionSelect, 
    onSessionDelete,
    onNewChat,
    onClearAll,
    onLogout,
    onClose,
    theme,
    onThemeToggle,
    onToggleSidebar
}) => {
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  
  const handleClearClick = () => setIsConfirmingClear(true);
  
  const confirmClear = () => {
    onClearAll();
    setIsConfirmingClear(false);
  };

  const cancelClear = () => setIsConfirmingClear(false);

  const handleExportPDF = () => {
    const currentSession = sessions.find(s => s.id === currentSessionId);
    if (!currentSession || currentSession.messages.length === 0) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const maxLineWidth = pageWidth - (margin * 2);
    
    let y = 20;

    // Title
    doc.setFontSize(22);
    doc.setTextColor(147, 51, 234); // Purple
    doc.text("Nexora Ai Chat", margin, y);
    y += 10;
    
    // Date & Session Info
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Date: ${new Date().toLocaleString()}`, margin, y);
    y += 6;
    doc.text(`Topic: ${currentSession.title}`, margin, y);
    y += 15;

    doc.setFontSize(11);

    currentSession.messages.forEach((msg) => {
        // Simple page break check
        if (y > 270) {
            doc.addPage();
            y = 20;
        }

        // Role Header
        doc.setFont("helvetica", "bold");
        if (msg.role === 'user') {
            doc.setTextColor(50, 50, 50);
            doc.text("You:", margin, y);
        } else {
            doc.setTextColor(147, 51, 234); // Purple
            doc.text("Nexora:", margin, y);
        }
        y += 6;

        // Content
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0);
        
        // Basic cleanup of markdown for plain text PDF rendering
        // NOTE: For full markdown support in PDF, complex libraries like html2pdf or react-pdf are needed. 
        // This is a lightweight text export.
        const cleanContent = msg.content
            .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
            .replace(/\*(.*?)\*/g, '$1')     // Italic
            .replace(/##/g, '')              // Headers
            .replace(/`/g, '');              // Code blocks

        const lines = doc.splitTextToSize(cleanContent, maxLineWidth);
        
        // Check if content fits, if not add page
        if (y + (lines.length * 5) > 280) {
            doc.addPage();
            y = 20;
        }
        
        doc.text(lines, margin, y);
        y += (lines.length * 5) + 10; // Spacing after message
    });

    doc.save(`nexora-chat-${Date.now()}.pdf`);
  };

  return (
    <div className="h-full flex flex-col justify-between bg-gray-50 dark:bg-gpt-sidebar text-gray-900 dark:text-gray-100 p-3 overflow-hidden">
      
      <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header & New Chat */}
          <div className="flex items-center gap-2 mb-4 px-2 pt-2">
             {onClose && (
                <button onClick={onClose} className="md:hidden p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg">
                    <X className="w-5 h-5" />
                </button>
             )}
             
             <button 
                onClick={onNewChat}
                className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-[#212121] hover:bg-gray-100 dark:hover:bg-[#2f2f2f] border border-gray-200 dark:border-transparent rounded-lg text-sm font-medium transition-colors shadow-sm text-left group"
             >
                 <Plus className="w-4 h-4 text-gray-500 group-hover:text-gray-900 dark:group-hover:text-white transition-colors" />
                 <span>New chat</span>
             </button>

             {/* Desktop Close Sidebar */}
             <button 
                onClick={onToggleSidebar} 
                className="hidden md:flex p-2.5 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#2f2f2f] rounded-lg transition-colors"
                title="Close sidebar"
             >
                <PanelLeft className="w-5 h-5" />
             </button>
          </div>

          <div className="px-3 mb-2">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">History</h3>
          </div>

          {/* Session List */}
          <div className="flex-1 overflow-y-auto px-2 space-y-1 scrollbar-hide">
             {sessions.length === 0 ? (
                 <div className="px-3 py-4 text-sm text-gray-500 italic text-center">No conversations yet.</div>
             ) : (
                 sessions.map(session => (
                     <div 
                        key={session.id} 
                        className={`group relative flex items-center rounded-lg transition-colors ${
                            session.id === currentSessionId 
                            ? 'bg-gray-200 dark:bg-[#2f2f2f]' 
                            : 'hover:bg-gray-200 dark:hover:bg-[#2f2f2f]'
                        }`}
                     >
                         <button
                            onClick={() => onSessionSelect(session.id)}
                            className="flex-1 w-full text-left flex items-center gap-3 px-3 py-3 text-sm truncate"
                            title={session.title}
                         >
                             <MessageSquare className="w-4 h-4 shrink-0 text-gray-500" />
                             <div className="flex flex-col truncate">
                                 <span className={`truncate ${session.id === currentSessionId ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
                                     {session.title}
                                 </span>
                                 <span className="text-[10px] text-gray-400">
                                     {new Date(session.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                 </span>
                             </div>
                         </button>
                         
                         {/* Delete Session Button (Visible on Hover or if active) */}
                         {onSessionDelete && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSessionDelete(session.id);
                                }}
                                className={`absolute right-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-md transition-all opacity-0 group-hover:opacity-100 focus:opacity-100`}
                                title="Delete chat"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                         )}
                     </div>
                 ))
             )}
          </div>
      </div>

      {/* Bottom Profile/Settings */}
      <div className="pt-2 border-t border-gray-200 dark:border-white/10 mt-2 space-y-1">
          {sessions.length > 0 && currentSessionId && (
             <button 
                onClick={handleExportPDF}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-gray-200 dark:hover:bg-[#2f2f2f] text-sm transition-colors text-gray-700 dark:text-gray-300 group"
             >
                <Share className="w-4 h-4 group-hover:text-purple-500 transition-colors" />
                <span className="group-hover:text-purple-500 transition-colors">Share as PDF</span>
             </button>
          )}

          {sessions.length > 0 && (
            isConfirmingClear ? (
                <div className="w-full flex items-center justify-between px-3 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm animate-in fade-in slide-in-from-bottom-1">
                    <span className="font-medium text-xs">Delete all chats?</span>
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={confirmClear} 
                            className="p-1.5 hover:bg-red-200 dark:hover:bg-red-900/40 rounded transition-colors"
                            title="Confirm"
                        >
                            <Check className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={cancelClear} 
                            className="p-1.5 hover:bg-red-200 dark:hover:bg-red-900/40 rounded transition-colors"
                            title="Cancel"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ) : (
                <button 
                    onClick={handleClearClick}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-gray-200 dark:hover:bg-[#2f2f2f] text-sm transition-colors group text-gray-700 dark:text-gray-300"
                >
                    <Trash2 className="w-4 h-4 group-hover:text-red-500 transition-colors" />
                    <span className="group-hover:text-red-500 transition-colors">Clear all conversations</span>
                </button>
            )
          )}

          <button 
            onClick={onThemeToggle}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-gray-200 dark:hover:bg-[#2f2f2f] text-sm transition-colors"
          >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
          </button>

          {user && (
              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-white/10 flex items-center gap-3 px-2 py-2">
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-200 dark:border-white/10 shrink-0">
                      <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                  </div>
                  <button 
                    onClick={onLogout}
                    className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                    title="Sign Out"
                  >
                      <LogOut className="w-4 h-4" />
                  </button>
              </div>
          )}
      </div>
    </div>
  );
};
