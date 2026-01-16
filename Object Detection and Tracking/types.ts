export interface TrackerAnalysis {
  summary: string;
  threatLevel: string;
  details: string;
  recommendation: string;
}

export type VideoSourceType = 'webcam' | 'file';
