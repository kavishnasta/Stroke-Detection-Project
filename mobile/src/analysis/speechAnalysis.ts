import { FindingMessages } from '../constants/messages';
import { pickRandomPhrase, TestPhrase } from '../constants/phrases';
import { Severity, SpeechMetrics } from '../types/landmarks';

export const SPEECH_TIMEOUT_MS = 15000;

export type SpeechTiming = {
  recordingStartMs: number;
  firstVoiceMs: number;
  recordingEndMs: number;
  wordTimestampsMs: number[];
};

function normalizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function wordLevelLevenshtein(reference: string[], hypothesis: string[]): number {
  const rows = reference.length + 1;
  const cols = hypothesis.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) dp[i][0] = i;
  for (let j = 0; j < cols; j += 1) dp[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = reference[i - 1] === hypothesis[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }

  return dp[reference.length][hypothesis.length];
}

function estimateSyllables(phrase: string): number {
  const words = normalizeText(phrase);
  return words.reduce((acc, word) => {
    const groups = (word.match(/[aeiouy]+/g) ?? []).length;
    return acc + Math.max(groups, 1);
  }, 0);
}

function classifyWer(wer: number): Severity {
  if (wer < 0.15) return 'green';
  if (wer <= 0.35) return 'yellow';
  return 'red';
}

function classifyDuration(actualDurationSec: number, expectedDurationSec: number): Severity {
  if (actualDurationSec > expectedDurationSec * 2) return 'red';
  if (actualDurationSec > expectedDurationSec * 1.5) return 'yellow';
  return 'green';
}

function classifyPauses(pauseCount: number, phraseWordCount: number): Severity {
  const shortPhrase = phraseWordCount <= 8;
  const redThreshold = shortPhrase ? 4 : 5;
  const yellowThreshold = shortPhrase ? 3 : 4;
  if (pauseCount >= redThreshold) return 'red';
  if (pauseCount >= yellowThreshold) return 'yellow';
  return 'green';
}

function combineSpeechSeverity(states: Severity[]): Severity {
  const redCount = states.filter((s) => s === 'red').length;
  const yellowOrRedCount = states.filter((s) => s !== 'green').length;

  if (redCount >= 2) return 'red';
  if (yellowOrRedCount >= 1) return 'yellow';
  return 'green';
}

export function countLongPauses(wordTimestampsMs: number[], gapThresholdMs = 500): number {
  if (wordTimestampsMs.length < 2) return 0;
  let count = 0;
  for (let i = 1; i < wordTimestampsMs.length; i += 1) {
    if (wordTimestampsMs[i] - wordTimestampsMs[i - 1] > gapThresholdMs) {
      count += 1;
    }
  }
  return count;
}

export function analyzeSpeech(referencePhrase: string, transcript: string, timing: SpeechTiming): SpeechMetrics {
  const refWords = normalizeText(referencePhrase);
  const hypWords = normalizeText(transcript);

  const edits = wordLevelLevenshtein(refWords, hypWords);
  const wer = edits / Math.max(refWords.length, 1);

  const syllables = estimateSyllables(referencePhrase);
  const expectedDurationSec = syllables / 5;
  const actualDurationSec = Math.max((timing.recordingEndMs - timing.firstVoiceMs) / 1000, 0);
  const pauseCount = countLongPauses(timing.wordTimestampsMs);

  const werState = classifyWer(wer);
  const durationState = classifyDuration(actualDurationSec, expectedDurationSec);
  const pausesState = classifyPauses(pauseCount, refWords.length);

  const severity = combineSpeechSeverity([werState, durationState, pausesState]);

  return {
    phrase: referencePhrase,
    transcript,
    wer,
    expectedDurationSec,
    actualDurationSec,
    pauseCount,
    metricStates: {
      wer: werState,
      duration: durationState,
      pauses: pausesState,
    },
    severity,
  };
}

export function chooseSpeechPhrase(sessionSeed?: number): TestPhrase {
  return pickRandomPhrase(sessionSeed ?? Date.now());
}

export function speechFindingNeeded(severity: Severity): string[] {
  return severity === 'green' ? [] : [FindingMessages.speechChange];
}
