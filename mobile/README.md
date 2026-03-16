# Stroke FAST Mobile Scaffold (React Native 0.72)

This folder contains a production-oriented scaffold for an offline-capable FAST stroke check app.

## Installed dependencies

- @react-native-voice/voice
- react-native-audio-recorder-player
- @react-native-async-storage/async-storage

## What is implemented

- Exact prompts and traffic-light result text
- Mandatory disclaimer rendered on every screen
- Face analytics modules with MediaPipe landmark mapping and thresholds:
  - Mouth/smile asymmetry
  - Nasolabial flattening
  - Cheek sagging and puff weakness
  - Eyebrow asymmetry and raise weakness
  - Forehead wrinkle asymmetry
  - Nostril asymmetry
  - Overall symmetry score
- Signal processing:
  - 15fps target
  - Circular buffer of 30 frames
  - EMA smoothing with alpha=0.3
  - 10+ frame persistence gate
  - Calibration baseline hook
- Speech analysis:
  - Random phrase selection
  - Word Error Rate via word-level Levenshtein
  - Duration vs expected syllable-based timing
  - Pause counting with >500ms gaps
  - Combined green/yellow/red logic with retry support hooks
- 3-step FAST flow screens (Face, Arm, Speech)
- Results screen with:
  - Per-test status
  - Prominent emergency warning for yellow/red
  - Always-visible Call 911 button
  - Share Results summary
  - Save to local history using AsyncStorage

## Integrate camera + MediaPipe

Use react-native-mediapipe or @mediapipe/tasks-vision and connect frame callbacks to:

- src/adapters/faceMeshAdapter.ts
- src/analysis/faceEngine.ts
- src/analysis/faceAlgorithms.ts

Feed each 468-landmark frame to FaceEngine.processFrame() and set snapshots during each action phase.

## Integrate live speech capture

Use:

- src/adapters/speechAdapter.ts
- src/analysis/speechAnalysis.ts

Start recorder + Voice together, enforce 15s timeout, and pass transcript + timing into analyzeSpeech().

## Commands

Run from this folder:

npm install
npm run android

## Offline requirement

All scoring logic in src/analysis is local and offline.
Speech recognition engine availability depends on device OS language packs; keep UX fallback messaging if recognition service is unavailable.
