import React from 'react';
import { LANGUAGES } from '../constants';

interface LanguageDropdownProps {
  value: string;
  onChange: (value: string) => void;
  excludeAuto?: boolean;
}

const LanguageDropdown: React.FC<LanguageDropdownProps> = ({ value, onChange, excludeAuto = false }) => {
  const options = excludeAuto ? LANGUAGES.filter(l => l.code !== 'auto') : LANGUAGES;

  return (
    <div className="relative inline-block w-full sm:w-48">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full bg-white border border-slate-200 text-slate-700 py-2 px-3 pr-8 rounded-lg leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none font-medium"
      >
        {options.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.name}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
        <i className="fa-solid fa-chevron-down text-xs"></i>
      </div>
    </div>
  );
};

export default LanguageDropdown;
