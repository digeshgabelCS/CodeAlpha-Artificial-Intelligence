
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { translateText, generateSpeech } from './services/geminiService';
import LanguageDropdown from './components/LanguageDropdown';
import { TranslationHistoryItem } from './types';
import { LANGUAGES } from './constants';

const App: React.FC = () => {
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('es');
  const [loading, setLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [history, setHistory] = useState<TranslationHistoryItem[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);

  // Fix: Replaced NodeJS.Timeout with ReturnType<typeof setTimeout> for browser compatibility
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTranslate = useCallback(async (text: string, src: string, target: string) => {
    if (!text.trim()) {
      setTranslatedText('');
      return;
    }

    setLoading(true);
    try {
      const result = await translateText(text, src, target);
      setTranslatedText(result);
      
      // Save to history
      const newItem: TranslationHistoryItem = {
        id: Math.random().toString(36).substr(2, 9),
        sourceText: text,
        translatedText: result,
        sourceLang: src,
        targetLang: target,
        timestamp: Date.now(),
      };
      setHistory(prev => [newItem, ...prev.slice(0, 9)]);
    } catch (error) {
      console.error("Translation Error:", error);
      setTranslatedText("Error during translation. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(() => {
      if (sourceText.trim()) {
        handleTranslate(sourceText, sourceLang, targetLang);
      }
    }, 1000);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [sourceText, sourceLang, targetLang, handleTranslate]);

  const handleCopy = () => {
    navigator.clipboard.writeText(translatedText);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleTTS = async () => {
    if (!translatedText || isSpeaking) return;
    setIsSpeaking(true);
    try {
      await generateSpeech(translatedText);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSpeaking(false);
    }
  };

  const handleSwap = () => {
    if (sourceLang === 'auto') return; // Cannot swap with auto-detect
    const tempLang = sourceLang;
    const tempText = sourceText;
    setSourceLang(targetLang);
    setTargetLang(tempLang);
    setSourceText(translatedText || '');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 py-6 px-4 mb-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
              <i className="fa-solid fa-language text-xl"></i>
            </div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Linguist AI</h1>
          </div>
          <div className="text-slate-500 text-sm hidden sm:block">
            Powered by Gemini 3.0
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 space-y-6">
        {/* Translation Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex flex-col md:flex-row border-b border-slate-100">
            {/* Input Side */}
            <div className="flex-1 p-6 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <LanguageDropdown value={sourceLang} onChange={setSourceLang} />
                <button 
                  onClick={handleSwap}
                  disabled={sourceLang === 'auto'}
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <i className="fa-solid fa-right-left text-sm"></i>
                </button>
              </div>
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder="Enter text to translate..."
                className="w-full h-40 md:h-64 resize-none border-0 focus:ring-0 text-lg text-slate-700 placeholder:text-slate-300 transition-all bg-transparent"
              />
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span>{sourceText.length} characters</span>
                <button 
                  onClick={() => setSourceText('')}
                  className="hover:text-red-500 transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Middle Divider for MD+ screens */}
            <div className="hidden md:block w-px bg-slate-100" />

            {/* Output Side */}
            <div className="flex-1 p-6 space-y-4 bg-slate-50/50">
              <div className="flex items-center mb-2">
                <LanguageDropdown value={targetLang} onChange={setTargetLang} excludeAuto />
              </div>
              <div className="relative group">
                <div className={`w-full h-40 md:h-64 overflow-y-auto text-lg whitespace-pre-wrap ${loading ? 'opacity-50' : 'text-slate-700'}`}>
                  {translatedText || <span className="text-slate-300 italic">Translation will appear here...</span>}
                </div>
                {loading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  onClick={handleTTS}
                  disabled={!translatedText || isSpeaking}
                  className="p-3 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all disabled:opacity-30"
                  title="Listen"
                >
                  <i className={`fa-solid ${isSpeaking ? 'fa-spinner animate-spin' : 'fa-volume-high'}`}></i>
                </button>
                <button
                  onClick={handleCopy}
                  disabled={!translatedText}
                  className="p-3 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all disabled:opacity-30 relative"
                  title="Copy"
                >
                  <i className={`fa-solid ${copySuccess ? 'fa-check text-green-500' : 'fa-copy'}`}></i>
                  {copySuccess && (
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded">Copied</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* History Section */}
        {history.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-700">Recent Translations</h2>
              <button 
                onClick={() => setHistory([])}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear History
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {history.map((item) => (
                <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-200 transition-all group cursor-pointer"
                  onClick={() => {
                    setSourceText(item.sourceText);
                    setSourceLang(item.sourceLang);
                    setTargetLang(item.targetLang);
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      <span>{LANGUAGES.find(l => l.code === item.sourceLang)?.name || item.sourceLang}</span>
                      <i className="fa-solid fa-arrow-right mx-2 opacity-50"></i>
                      <span className="text-blue-500">{LANGUAGES.find(l => l.code === item.targetLang)?.name || item.targetLang}</span>
                    </div>
                    <span className="text-[10px] text-slate-300">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-sm text-slate-800 line-clamp-2 font-medium mb-1">{item.sourceText}</p>
                  <p className="text-sm text-slate-500 line-clamp-2 italic">{item.translatedText}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Persistent CTA / Status */}
      <footer className="fixed bottom-6 right-6 flex space-x-4">
        <a 
          href="https://ai.google.dev" 
          target="_blank" 
          rel="noopener noreferrer"
          className="bg-white px-4 py-2 rounded-full shadow-lg border border-slate-200 flex items-center space-x-2 hover:bg-slate-50 transition-all text-xs font-medium text-slate-600"
        >
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          <span>System Online</span>
        </a>
      </footer>
    </div>
  );
};

export default App;
