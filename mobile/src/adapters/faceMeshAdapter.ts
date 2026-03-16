import { FaceLandmarks } from '../types/landmarks';

export type FaceMeshFrame = {
  landmarks: FaceLandmarks;
  timestampMs: number;
};

export type FaceMeshListener = (frame: FaceMeshFrame) => void;

export interface FaceMeshAdapter {
  start(listener: FaceMeshListener): Promise<void>;
  stop(): Promise<void>;
}

// Wire this adapter to react-native-mediapipe or @mediapipe/tasks-vision.
// Keep all analytics in TypeScript modules so offline scoring remains deterministic.
export class StubFaceMeshAdapter implements FaceMeshAdapter {
  async start(_listener: FaceMeshListener): Promise<void> {
    return;
  }

  async stop(): Promise<void> {
    return;
  }
}
