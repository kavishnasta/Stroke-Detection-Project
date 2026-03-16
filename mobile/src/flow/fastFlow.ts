import { Severity } from '../types/landmarks';

export type FastStep = 'onboarding' | 'face' | 'arm' | 'speech' | 'results' | 'learn';

export type StepConfig = {
  key: FastStep;
  label: string;
  durationSec?: number;
};

export const FAST_STEPS: StepConfig[] = [
  { key: 'face', label: 'Step 1 of 3: Face Check', durationSec: 45 },
  { key: 'arm', label: 'Step 2 of 3: Arm Check', durationSec: 15 },
  { key: 'speech', label: 'Step 3 of 3: Speech Check', durationSec: 20 },
];

export function combineOverallSeverity(face: Severity, arm: Severity, speech: Severity): Severity {
  const severities = [face, arm, speech];
  const redCount = severities.filter((s) => s === 'red').length;
  const yellowCount = severities.filter((s) => s === 'yellow').length;

  if (redCount >= 1 || yellowCount >= 2) return 'red';
  if (yellowCount >= 1) return 'yellow';
  return 'green';
}

export function overallSummaryText(face: Severity, arm: Severity, speech: Severity): string {
  const overall = combineOverallSeverity(face, arm, speech);
  if (overall === 'green') {
    return 'No signs of concern detected. Stay vigilant!';
  }
  if (overall === 'yellow') {
    return 'Some signs were detected. Consider retaking the test or consulting a doctor.';
  }
  return 'Multiple warning signs detected. Please seek medical attention immediately.';
}

export function testResultLabel(label: string, severity: Severity, warningText: string): string {
  return severity === 'green' ? `${label}: ✓ Normal` : `${label}: ⚠ ${warningText}`;
}
