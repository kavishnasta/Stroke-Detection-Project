import { FaceAnalysisResult, FaceLandmarks, Severity } from '../types/landmarks';
import { analyzeFaceFrame, makeInitialFaceState, FaceState } from './faceAlgorithms';
import { CircularFrameBuffer, emaLandmarks, PersistenceGate } from './signalProcessing';

export type FacePhase = 'calibration' | 'rest' | 'smile' | 'eyebrow' | 'cheek';

export class FaceEngine {
  private lastEma?: FaceLandmarks;
  private readonly gate = new PersistenceGate();
  private readonly state: FaceState = makeInitialFaceState();
  private readonly calibrationFrames = new CircularFrameBuffer<FaceAnalysisResult>(30);
  private readonly frameBuffer = new CircularFrameBuffer<FaceLandmarks>(30);

  setPhaseSnapshot(phase: FacePhase, frame: FaceLandmarks): void {
    if (phase === 'rest') this.state.rest = frame;
    if (phase === 'smile') this.state.smile = frame;
    if (phase === 'eyebrow') this.state.raisedBrow = frame;
    if (phase === 'cheek') this.state.puffCheek = frame;
  }

  processFrame(raw: FaceLandmarks, phase: FacePhase): FaceAnalysisResult {
    const smoothed = emaLandmarks(raw, this.lastEma);
    this.lastEma = smoothed;
    this.frameBuffer.push(smoothed);

    const result = analyzeFaceFrame(smoothed, this.state, this.gate);

    if (phase === 'calibration') {
      this.calibrationFrames.push(result);
      this.setPhaseSnapshot('rest', smoothed);
    }

    return result;
  }

  finalizeCalibration(): void {
    const items = this.calibrationFrames.toArray();
    if (!items.length) return;

    const mean = items.reduce(
      (acc, current) => ({
        mouthAsymmetryRatio: acc.mouthAsymmetryRatio + current.metrics.mouthAsymmetryRatio,
        smileDeltaDiffRatio: acc.smileDeltaDiffRatio + current.metrics.smileDeltaDiffRatio,
        lowerLipSagRatio: acc.lowerLipSagRatio + current.metrics.lowerLipSagRatio,
        leftFoldDepth: acc.leftFoldDepth + current.metrics.leftFoldDepth,
        rightFoldDepth: acc.rightFoldDepth + current.metrics.rightFoldDepth,
        cheekAsymmetryRatio: acc.cheekAsymmetryRatio + current.metrics.cheekAsymmetryRatio,
        cheekPuffRatio: acc.cheekPuffRatio + current.metrics.cheekPuffRatio,
        browAsymmetryRatio: acc.browAsymmetryRatio + current.metrics.browAsymmetryRatio,
        browRaiseRatio: acc.browRaiseRatio + current.metrics.browRaiseRatio,
        foreheadCompressionRatio: acc.foreheadCompressionRatio + current.metrics.foreheadCompressionRatio,
        nostrilAsymmetry: acc.nostrilAsymmetry + current.metrics.nostrilAsymmetry,
        overallAsymmetry: acc.overallAsymmetry + current.metrics.overallAsymmetry,
      }),
      {
        mouthAsymmetryRatio: 0,
        smileDeltaDiffRatio: 0,
        lowerLipSagRatio: 0,
        leftFoldDepth: 0,
        rightFoldDepth: 0,
        cheekAsymmetryRatio: 0,
        cheekPuffRatio: 0,
        browAsymmetryRatio: 0,
        browRaiseRatio: 0,
        foreheadCompressionRatio: 0,
        nostrilAsymmetry: 0,
        overallAsymmetry: 0,
      },
    );

    const n = items.length;
    this.state.baselineAsymmetry = {
      mouthAsymmetryRatio: mean.mouthAsymmetryRatio / n,
      smileDeltaDiffRatio: mean.smileDeltaDiffRatio / n,
      lowerLipSagRatio: mean.lowerLipSagRatio / n,
      leftFoldDepth: mean.leftFoldDepth / n,
      rightFoldDepth: mean.rightFoldDepth / n,
      cheekAsymmetryRatio: mean.cheekAsymmetryRatio / n,
      cheekPuffRatio: mean.cheekPuffRatio / n,
      browAsymmetryRatio: mean.browAsymmetryRatio / n,
      browRaiseRatio: mean.browRaiseRatio / n,
      foreheadCompressionRatio: mean.foreheadCompressionRatio / n,
      nostrilAsymmetry: mean.nostrilAsymmetry / n,
      overallAsymmetry: mean.overallAsymmetry / n,
    };
  }

  static severityFromFlags(flagCount: number): Severity {
    if (flagCount >= 2) return 'red';
    if (flagCount === 1) return 'yellow';
    return 'green';
  }
}
