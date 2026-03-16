export type Landmark = {
  x: number;
  y: number;
  z?: number;
};

export type FaceLandmarks = Landmark[];

export type Severity = 'green' | 'yellow' | 'red';

export type DetectionFlag = {
  key: string;
  message: string;
  severity: Severity;
  persistedFrames: number;
};

export type FaceMetrics = {
  mouthAsymmetryRatio: number;
  smileDeltaDiffRatio: number;
  lowerLipSagRatio: number;
  leftFoldDepth: number;
  rightFoldDepth: number;
  cheekAsymmetryRatio: number;
  cheekPuffRatio: number;
  browAsymmetryRatio: number;
  browRaiseRatio: number;
  foreheadCompressionRatio: number;
  nostrilAsymmetry: number;
  overallAsymmetry: number;
};

export type FaceAnalysisResult = {
  metrics: FaceMetrics;
  flags: DetectionFlag[];
};

export type SpeechMetrics = {
  phrase: string;
  transcript: string;
  wer: number;
  expectedDurationSec: number;
  actualDurationSec: number;
  pauseCount: number;
  metricStates: {
    wer: Severity;
    duration: Severity;
    pauses: Severity;
  };
  severity: Severity;
};

export type ArmMetrics = {
  leftDrift: number;
  rightDrift: number;
  driftRatio: number;
  flagged: boolean;
};

export type FastSessionResult = {
  timestamp: string;
  face: { severity: Severity; flags: string[] };
  arm: { severity: Severity; flagged: boolean };
  speech: { severity: Severity; wer: number; pauses: number; durationSec: number };
  overallSeverity: Severity;
};
