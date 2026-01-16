import React from 'react';
import { TrackerAnalysis } from '../types';
import { AlertTriangle, ShieldCheck, ShieldAlert, Info } from 'lucide-react';

interface AnalysisPanelProps {
  analysis: TrackerAnalysis | null;
  loading: boolean;
  onClose: () => void;
}

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ analysis, loading, onClose }) => {
  if (!analysis && !loading) return null;

  return (
    <div className="absolute top-4 right-4 z-50 w-80 md:w-96 bg-hud-black/90 border border-hud-teal/50 rounded-lg p-4 backdrop-blur-md shadow-[0_0_15px_rgba(0,240,255,0.2)] text-sm">
      <div className="flex justify-between items-center mb-4 border-b border-hud-gray pb-2">
        <h3 className="text-hud-teal font-mono font-bold flex items-center gap-2">
          <Info className="w-4 h-4" /> AI ANALYSIS LOG
        </h3>
        <button onClick={onClose} className="text-gray-500 hover:text-white">&times;</button>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-4 bg-hud-gray rounded w-3/4"></div>
          <div className="h-20 bg-hud-gray rounded w-full"></div>
          <div className="h-4 bg-hud-gray rounded w-1/2"></div>
        </div>
      ) : analysis ? (
        <div className="space-y-4 font-mono">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">THREAT LEVEL</span>
            <span className={`px-2 py-0.5 rounded text-xs font-bold border ${
              analysis.threatLevel.toUpperCase() === 'HIGH' ? 'border-red-500 text-red-500 bg-red-500/10' :
              analysis.threatLevel.toUpperCase() === 'MEDIUM' ? 'border-yellow-500 text-yellow-500 bg-yellow-500/10' :
              'border-green-500 text-green-500 bg-green-500/10'
            }`}>
              {analysis.threatLevel.toUpperCase()}
            </span>
          </div>

          <div>
            <div className="text-gray-400 text-xs mb-1">SUMMARY</div>
            <p className="text-white leading-relaxed">{analysis.summary}</p>
          </div>

          <div>
            <div className="text-gray-400 text-xs mb-1">DETAILS</div>
            <p className="text-gray-300 text-xs leading-relaxed">{analysis.details}</p>
          </div>

          <div className="bg-hud-teal/10 p-3 rounded border border-hud-teal/30">
            <div className="text-hud-teal text-xs mb-1 font-bold">RECOMMENDATION</div>
            <p className="text-hud-teal/80 text-xs">{analysis.recommendation}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AnalysisPanel;
