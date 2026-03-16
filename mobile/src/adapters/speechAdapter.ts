import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import Voice from '@react-native-voice/voice';

const recorder = new AudioRecorderPlayer();

export type SpeechCapture = {
  transcript: string;
  recordingStartMs: number;
  firstVoiceMs: number;
  recordingEndMs: number;
  wordTimestampsMs: number[];
};

export async function captureSpeechWithTimeout(timeoutMs = 15000): Promise<SpeechCapture> {
  return new Promise(async (resolve, reject) => {
    let transcript = '';
    const startMs = Date.now();
    let firstVoiceMs = startMs;
    const wordTimestampsMs: number[] = [];

    const cleanup = async () => {
      Voice.onSpeechResults = undefined;
      Voice.onSpeechPartialResults = undefined;
      Voice.onSpeechStart = undefined;
      try {
        await Voice.stop();
      } catch {
        // Ignore stop race conditions.
      }
      try {
        await recorder.stopRecorder();
      } catch {
        // Ignore stop race conditions.
      }
    };

    Voice.onSpeechStart = () => {
      firstVoiceMs = Date.now();
    };

    Voice.onSpeechPartialResults = (e: { value?: string[] }) => {
      const partial = e.value?.[0] ?? '';
      transcript = partial || transcript;
      wordTimestampsMs.push(Date.now());
    };

    Voice.onSpeechResults = (e: { value?: string[] }) => {
      transcript = e.value?.[0] ?? transcript;
    };

    const timeout = setTimeout(async () => {
      await cleanup();
      resolve({
        transcript,
        recordingStartMs: startMs,
        firstVoiceMs,
        recordingEndMs: Date.now(),
        wordTimestampsMs,
      });
    }, timeoutMs);

    try {
      await recorder.startRecorder();
      await Voice.start('en-US');
    } catch (error) {
      clearTimeout(timeout);
      await cleanup();
      reject(error);
    }
  });
}
