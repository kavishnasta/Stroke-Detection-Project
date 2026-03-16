const PHRASES = [
  'The early bird catches the worm',
  "You can't teach an old dog new tricks",
  'The quick brown fox jumps over the lazy dog',
  'She sells seashells by the seashore',
  'Peter Piper picked a peck of pickled peppers',
] as const;

export type TestPhrase = (typeof PHRASES)[number];

export function pickRandomPhrase(seed = Date.now()): TestPhrase {
  const index = Math.abs(seed) % PHRASES.length;
  return PHRASES[index];
}

export default PHRASES;
