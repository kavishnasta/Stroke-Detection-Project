import AsyncStorage from '@react-native-async-storage/async-storage';
import { FastSessionResult } from '../types/landmarks';

const HISTORY_KEY = 'stroke_fast_history_v1';

export async function saveResultToHistory(result: FastSessionResult): Promise<void> {
  const existing = await loadHistory();
  const updated = [result, ...existing].slice(0, 50);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
}

export async function loadHistory(): Promise<FastSessionResult[]> {
  const raw = await AsyncStorage.getItem(HISTORY_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as FastSessionResult[];
  } catch {
    return [];
  }
}

export function createShareableSummary(result: FastSessionResult): string {
  return [
    `Stroke FAST self-check (${result.timestamp})`,
    `Face: ${result.face.severity.toUpperCase()}${result.face.flags.length ? ` (${result.face.flags.join('; ')})` : ''}`,
    `Arms: ${result.arm.severity.toUpperCase()}${result.arm.flagged ? ' (one arm drifted)' : ''}`,
    `Speech: ${result.speech.severity.toUpperCase()} (WER=${result.speech.wer.toFixed(2)}, pauses=${result.speech.pauses}, duration=${result.speech.durationSec.toFixed(1)}s)`,
    `Overall: ${result.overallSeverity.toUpperCase()}`,
    'When in doubt, call 911. It is better to be safe.',
  ].join('\n');
}
