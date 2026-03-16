import { FaceLandmarks, Landmark } from '../types/landmarks';

export const MIN_FPS = 15;
export const BUFFER_SIZE = 30;
export const EMA_ALPHA = 0.3;
export const PERSISTENCE_FRAMES = 10;

export function emaLandmarks(current: FaceLandmarks, previous?: FaceLandmarks): FaceLandmarks {
  if (!previous || previous.length !== current.length) {
    return current;
  }
  return current.map((lm, idx) => {
    const prev = previous[idx];
    return {
      x: EMA_ALPHA * lm.x + (1 - EMA_ALPHA) * prev.x,
      y: EMA_ALPHA * lm.y + (1 - EMA_ALPHA) * prev.y,
      z: EMA_ALPHA * (lm.z ?? 0) + (1 - EMA_ALPHA) * (prev.z ?? 0),
    };
  });
}

export class CircularFrameBuffer<T> {
  private readonly capacity: number;
  private items: T[] = [];

  constructor(capacity = BUFFER_SIZE) {
    this.capacity = capacity;
  }

  push(item: T): void {
    if (this.items.length === this.capacity) {
      this.items.shift();
    }
    this.items.push(item);
  }

  toArray(): T[] {
    return [...this.items];
  }

  latest(): T | undefined {
    return this.items[this.items.length - 1];
  }

  get size(): number {
    return this.items.length;
  }
}

export class PersistenceGate {
  private readonly threshold: number;
  private counters: Record<string, number> = {};

  constructor(threshold = PERSISTENCE_FRAMES) {
    this.threshold = threshold;
  }

  update(key: string, condition: boolean): { persisted: boolean; frames: number } {
    const next = condition ? (this.counters[key] ?? 0) + 1 : 0;
    this.counters[key] = next;
    return { persisted: next >= this.threshold, frames: next };
  }
}

export function averageLandmark(frames: FaceLandmarks[], index: number): Landmark {
  if (!frames.length) {
    return { x: 0, y: 0, z: 0 };
  }

  const sum = frames.reduce(
    (acc, frame) => {
      const lm = frame[index] ?? { x: 0, y: 0, z: 0 };
      return {
        x: acc.x + lm.x,
        y: acc.y + lm.y,
        z: acc.z + (lm.z ?? 0),
      };
    },
    { x: 0, y: 0, z: 0 },
  );

  const n = frames.length;
  return { x: sum.x / n, y: sum.y / n, z: sum.z / n };
}
