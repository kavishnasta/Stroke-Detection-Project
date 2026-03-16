import { FindingMessages } from '../constants/messages';
import { DetectionFlag, FaceAnalysisResult, FaceLandmarks, FaceMetrics } from '../types/landmarks';
import { distance, perpendicularDistanceToLine } from './geometry';
import { PersistenceGate } from './signalProcessing';

type FaceState = {
  rest?: FaceLandmarks;
  smile?: FaceLandmarks;
  raisedBrow?: FaceLandmarks;
  puffCheek?: FaceLandmarks;
  baselineAsymmetry: Partial<FaceMetrics>;
};

const PAIRS: Array<[number, number]> = [
  [33, 263],
  [61, 291],
  [70, 300],
  [234, 454],
  [127, 356],
  [205, 425],
];

function getFaceHeight(lms: FaceLandmarks): number {
  return distance(lms[10], lms[152]);
}

function getFaceWidth(lms: FaceLandmarks): number {
  return distance(lms[234], lms[454]);
}

function getMidlineDistance(point: { x: number; y: number }, top: { x: number; y: number }, bottom: { x: number; y: number }): number {
  return perpendicularDistanceToLine(point, top, bottom);
}

function normalizeWithBaseline(raw: number, baseline = 0): number {
  return Math.max(0, raw - baseline);
}

export function analyzeFaceFrame(
  landmarks: FaceLandmarks,
  state: FaceState,
  gate: PersistenceGate,
): FaceAnalysisResult {
  const faceHeight = Math.max(getFaceHeight(landmarks), 1e-6);
  const faceWidth = Math.max(getFaceWidth(landmarks), 1e-6);

  const mouthAsymmetryRatio = Math.abs(landmarks[61].y - landmarks[291].y) / faceHeight;

  const leftSmileDelta = state.rest ? Math.abs((state.smile ?? landmarks)[61].x - state.rest[61].x) : 0;
  const rightSmileDelta = state.rest ? Math.abs((state.smile ?? landmarks)[291].x - state.rest[291].x) : 0;
  const smileDen = Math.max(leftSmileDelta, rightSmileDelta, 1e-6);
  const smileDeltaDiffRatio = Math.abs(leftSmileDelta - rightSmileDelta) / smileDen;

  const lowerLipLeft = distance(landmarks[17], landmarks[61]);
  const lowerLipRight = distance(landmarks[17], landmarks[291]);
  const lowerLipSagRatio = Math.abs(lowerLipLeft - lowerLipRight) / Math.max(lowerLipLeft, lowerLipRight, 1e-6);

  const leftFoldDepth = perpendicularDistanceToLine(landmarks[205], landmarks[187], landmarks[207]);
  const rightFoldDepth = perpendicularDistanceToLine(landmarks[425], landmarks[411], landmarks[427]);

  const cheekAsymmetryRatio = Math.abs(landmarks[234].y - landmarks[454].y) / faceHeight;

  const leftPuff = state.rest ? Math.abs((state.puffCheek ?? landmarks)[234].x - state.rest[234].x) : 0;
  const rightPuff = state.rest ? Math.abs((state.puffCheek ?? landmarks)[454].x - state.rest[454].x) : 0;
  const cheekPuffRatio = Math.min(leftPuff, rightPuff) / Math.max(leftPuff, rightPuff, 1e-6);

  const leftBrowHeight = Math.abs(landmarks[70].y - landmarks[33].y);
  const rightBrowHeight = Math.abs(landmarks[300].y - landmarks[263].y);
  const browAsymmetryRatio = Math.abs(leftBrowHeight - rightBrowHeight) / Math.max(leftBrowHeight, rightBrowHeight, 1e-6);

  const leftBrowRaise = state.rest ? Math.abs((state.raisedBrow ?? landmarks)[70].y - state.rest[70].y) : 0;
  const rightBrowRaise = state.rest ? Math.abs((state.raisedBrow ?? landmarks)[300].y - state.rest[300].y) : 0;
  const browRaiseRatio = Math.min(leftBrowRaise, rightBrowRaise) / Math.max(leftBrowRaise, rightBrowRaise, 1e-6);

  const leftCompressionRest = state.rest ? distance(state.rest[67], state.rest[69]) : distance(landmarks[67], landmarks[69]);
  const leftCompressionRaised = state.raisedBrow ? distance(state.raisedBrow[67], state.raisedBrow[69]) : leftCompressionRest;
  const rightCompressionRest = state.rest ? distance(state.rest[297], state.rest[299]) : distance(landmarks[297], landmarks[299]);
  const rightCompressionRaised = state.raisedBrow ? distance(state.raisedBrow[297], state.raisedBrow[299]) : rightCompressionRest;

  const leftWrinkleCompression = leftCompressionRaised / Math.max(leftCompressionRest, 1e-6);
  const rightWrinkleCompression = rightCompressionRaised / Math.max(rightCompressionRest, 1e-6);
  const foreheadCompressionRatio =
    Math.min(leftWrinkleCompression, rightWrinkleCompression) /
    Math.max(leftWrinkleCompression, rightWrinkleCompression, 1e-6);

  const nostrilLeft = distance(landmarks[2], landmarks[141]);
  const nostrilRight = distance(landmarks[2], landmarks[370]);
  const nostrilAsymmetry = Math.abs(nostrilLeft - nostrilRight) / Math.max(nostrilLeft, nostrilRight, 1e-6);

  const midTop = landmarks[10];
  const midBottom = landmarks[152];

  const pairScores = PAIRS.map(([left, right]) => {
    const leftDist = getMidlineDistance(landmarks[left], midTop, midBottom);
    const rightDist = getMidlineDistance(landmarks[right], midTop, midBottom);
    return Math.abs(leftDist - rightDist) / faceWidth;
  });

  const overallAsymmetry = pairScores.reduce((acc, val) => acc + val, 0) / pairScores.length;

  const metrics: FaceMetrics = {
    mouthAsymmetryRatio,
    smileDeltaDiffRatio,
    lowerLipSagRatio,
    leftFoldDepth,
    rightFoldDepth,
    cheekAsymmetryRatio,
    cheekPuffRatio,
    browAsymmetryRatio,
    browRaiseRatio,
    foreheadCompressionRatio,
    nostrilAsymmetry,
    overallAsymmetry,
  };

  const flags: DetectionFlag[] = [];

  const mouthPersist = gate.update(
    'mouth_asymmetry',
    normalizeWithBaseline(mouthAsymmetryRatio, state.baselineAsymmetry.mouthAsymmetryRatio) > 0.03 ||
      smileDeltaDiffRatio > 0.2 ||
      lowerLipSagRatio > 0.2,
  );
  if (mouthPersist.persisted) {
    flags.push({
      key: 'mouth_asymmetry',
      message: FindingMessages.mouthAsymmetry,
      severity: 'red',
      persistedFrames: mouthPersist.frames,
    });
  }

  const foldFlattened = Math.min(leftFoldDepth, rightFoldDepth) / Math.max(leftFoldDepth, rightFoldDepth, 1e-6) < 0.6;
  const foldPersist = gate.update('nasolabial_flat', foldFlattened);
  if (foldPersist.persisted) {
    flags.push({
      key: 'nasolabial_flat',
      message: FindingMessages.nasolabialFold,
      severity: 'yellow',
      persistedFrames: foldPersist.frames,
    });
  }

  const cheekPersist = gate.update('cheek_sag', cheekAsymmetryRatio > 0.025 || cheekPuffRatio < 0.5);
  if (cheekPersist.persisted) {
    flags.push({
      key: 'cheek_sag',
      message: FindingMessages.cheekWeakness,
      severity: 'yellow',
      persistedFrames: cheekPersist.frames,
    });
  }

  const browPersist = gate.update('brow_asymmetry', browAsymmetryRatio > 0.15 || browRaiseRatio < 0.5);
  if (browPersist.persisted) {
    flags.push({
      key: 'brow_asymmetry',
      message: FindingMessages.eyebrowAsymmetry,
      severity: 'yellow',
      persistedFrames: browPersist.frames,
    });
  }

  const foreheadPersist = gate.update('forehead_weak', foreheadCompressionRatio < 0.5);
  if (foreheadPersist.persisted) {
    flags.push({
      key: 'forehead_weak',
      message: FindingMessages.foreheadWeakness,
      severity: 'yellow',
      persistedFrames: foreheadPersist.frames,
    });
  }

  gate.update('nostril_asym', nostrilAsymmetry > 0.12);
  gate.update('overall_sym', overallAsymmetry > 0.04);

  return { metrics, flags };
}

export function makeInitialFaceState(): FaceState {
  return {
    baselineAsymmetry: {},
  };
}

export function updateCalibrationBaseline(state: FaceState, averageMetrics: FaceMetrics): FaceState {
  return {
    ...state,
    baselineAsymmetry: {
      mouthAsymmetryRatio: averageMetrics.mouthAsymmetryRatio,
      cheekAsymmetryRatio: averageMetrics.cheekAsymmetryRatio,
      browAsymmetryRatio: averageMetrics.browAsymmetryRatio,
      nostrilAsymmetry: averageMetrics.nostrilAsymmetry,
      overallAsymmetry: averageMetrics.overallAsymmetry,
    },
  };
}

export type { FaceState };
