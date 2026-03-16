import { ArmMetrics } from '../types/landmarks';

export type WristPoint = { x: number; y: number };

export function analyzeArmDrift(
  leftStart: WristPoint,
  leftEnd: WristPoint,
  rightStart: WristPoint,
  rightEnd: WristPoint,
): ArmMetrics {
  const leftDrift = Math.abs(leftEnd.y - leftStart.y);
  const rightDrift = Math.abs(rightEnd.y - rightStart.y);
  const driftRatio = Math.max(leftDrift, rightDrift) / Math.max(Math.min(leftDrift, rightDrift), 1e-6);
  const flagged = driftRatio > 2;

  return {
    leftDrift,
    rightDrift,
    driftRatio,
    flagged,
  };
}
