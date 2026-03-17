/**
 * AudioService
 * Records 1.5-second WAV clips via react-native-audio-recorder-player,
 * reads each clip as base64, then delivers it to WebSocketService.
 *
 * WAV is sent with a proper RIFF header so the backend can identify
 * the sample-rate (16000 Hz) and bit-depth (PCM-16) unambiguously.
 */
import AudioRecorderPlayer, {
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
  AVEncoderAudioQualityIOSType,
  AVLinearPCMBitDepthKeyIOS,
} from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';

const CHUNK_MS = 1500; // 1.5 second clips
const SAMPLE_RATE = 16000;

export class AudioService {
  private player = new AudioRecorderPlayer();
  private running = false;
  private onChunk: ((wavB64: string) => void) | null = null;

  start(onChunk: (wavB64: string) => void) {
    this.onChunk = onChunk;
    this.running = true;
    this.loop();
  }

  stop() {
    this.running = false;
    this.onChunk = null;
    this.player.stopRecorder().catch(() => {});
  }

  private async loop() {
    while (this.running) {
      await this.recordChunk();
    }
  }

  private async recordChunk() {
    const path = `${RNFS.TemporaryDirectoryPath}/stroke_audio_${Date.now()}.wav`;

    try {
      await this.player.startRecorder(path, {
        // Android: record raw PCM into a WAV file
        AudioEncoderAndroid: AudioEncoderAndroidType.PCM_16BIT,
        AudioSourceAndroid: AudioSourceAndroidType.VOICE_RECOGNITION,
        AudioSamplingRateAndroid: SAMPLE_RATE,
        AudioChannelsAndroid: 1,
        // iOS: linear PCM at 16 kHz
        AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
        AVSampleRateKeyIOS: SAMPLE_RATE,
        AVNumberOfChannelsKeyIOS: 1,
        AVLinearPCMBitDepthKeyIOS: AVLinearPCMBitDepthKeyIOS.bit16,
        AVLinearPCMIsBigEndianKeyIOS: false,
        AVLinearPCMIsFloatKeyIOS: false,
      });

      await new Promise<void>(res => setTimeout(res, CHUNK_MS));

      await this.player.stopRecorder();

      if (!this.running) {
        await RNFS.unlink(path).catch(() => {});
        return;
      }

      const b64 = await RNFS.readFile(path, 'base64');
      await RNFS.unlink(path).catch(() => {});

      this.onChunk?.(b64);
    } catch {
      // Recoverable — brief pause then retry
      await new Promise<void>(res => setTimeout(res, 200));
    }
  }
}
