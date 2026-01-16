
import React from 'react';
import { FAQItem } from '../types';
import { Database, Search, X, ChevronRight } from 'lucide-react';

interface FAQListProps {
  faqs: FAQItem[];
  onClose?: () => void;
}

export const FAQList: React.FC<FAQListProps> = ({ faqs, onClose }) => {
  const categories = Array.from(new Set(faqs.map(f => f.category)));

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 md:rounded-2xl shadow-sm border-r md:border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-300">
      <div className="p-4 md:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between backdrop-blur-sm">
        <div className="flex items-center gap-3 text-slate-800 dark:text-slate-100">
            <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
              <Database className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="font-bold text-sm md:text-base leading-tight">Knowledge Base</h2>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">
                  NLP Context
              </p>
            </div>
        </div>
        {onClose && (
            <button 
                onClick={onClose}
                className="md:hidden p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-all active:scale-90"
                aria-label="Close"
            >
                <X className="w-5 h-5" />
            </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-8 scrollbar-hide">
        {categories.map(category => (
            <div key={category}>
                <div className="flex items-center gap-2 mb-4 px-1">
                  <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                  <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em]">
                      {category}
                  </h3>
                  <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                </div>
                <div className="space-y-3">
                    {faqs.filter(f => f.category === category).map(faq => (
                        <div key={faq.id} className="group p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 hover:shadow-md hover:shadow-slate-200/40 dark:hover:shadow-none transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-700 active:scale-[0.98]">
                            <h4 className="text-xs md:text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2 flex items-start gap-2.5">
                                <ChevronRight className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0 group-hover:rotate-90 transition-transform" />
                                {faq.question}
                            </h4>
                            <p className="text-[11px] md:text-xs text-slate-500 dark:text-slate-400 pl-6 leading-relaxed opacity-80 group-hover:opacity-100 transition-opacity">
                                {faq.answer}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        ))}
      </div>
    </div>
  );
};
