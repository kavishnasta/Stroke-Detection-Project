import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  ScrollView,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { StatusBar } from 'expo-status-bar';

const TARGET_FPS = 12;
const FRAME_INTERVAL_MS = Math.floor(1000 / TARGET_FPS);
const AUDIO_SEGMENT_MS = 1500;

const INITIAL_RESULT = {
  face_status: 'Not connected',
  face_ratios: { lower: 1.0, upper: 1.0 },
  voice_status: '—',
  voice_confidence: 0.0,
  voice_jitter: 0.0,
  voice_shimmer: 0.0,
  alert_active: false,
};

function RatioBar({ label, value }) {
  const inRange = value >= 0.85 && value <= 1.15;
  const color = inRange ? '#30D158' : '#FF3B30';
  return (
    <View style={styles.ratioRow}>
      <Text style={styles.ratioLabel}>{label}</Text>
      <Text style={[styles.ratioValue, { color }]}>{value.toFixed(3)}</Text>
      <Text style={[styles.ratioTag, { color }]}>{inRange ? 'OK' : 'ASYMMETRIC'}</Text>
    </View>
  );
}

export default function App() {
  const [camPermission, requestCamPermission] = useCameraPermissions();
  const [micGranted, setMicGranted] = useState(false);
  const [serverIp, setServerIp] = useState('192.168.1.100');
  const [connected, setConnected] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(INITIAL_RESULT);

  const cameraRef = useRef(null);
  const wsRef = useRef(null);
  const captureTimerRef = useRef(null);
  const audioActiveRef = useRef(false);
  const latestAudioB64Ref = useRef('');
  const isCapturingRef = useRef(false);

  useEffect(() => {
    (async () => {
      const { status } = await Audio.requestPermissionsAsync();
      setMicGranted(status === 'granted');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
    })();
    return () => teardown();
  }, []);

  const teardown = () => {
    isCapturingRef.current = false;
    audioActiveRef.current = false;
    if (captureTimerRef.current) clearTimeout(captureTimerRef.current);
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }
    setRunning(false);
    setConnected(false);
    setResult(INITIAL_RESULT);
  };

  const audioLoop = useCallback(async () => {
    audioActiveRef.current = true;
    while (audioActiveRef.current) {
      let recording = null;
      try {
        recording = new Audio.Recording();
        await recording.prepareToRecordAsync({
          ios: {
            extension: '.wav',
            outputFormat: Audio.IOSOutputFormat.LINEARPCM,
            audioQuality: Audio.IOSAudioQuality.LOW,
            sampleRate: 16000,
            numberOfChannels: 1,
            bitRate: 128000,
            linearPCMBitDepth: 16,
            linearPCMIsFloat: false,
            linearPCMIsBigEndian: false,
          },
          android: {
            extension: '.3gp',
            outputFormat: Audio.AndroidOutputFormat.THREE_GPP,
            audioEncoder: Audio.AndroidAudioEncoder.AMR_NB,
            sampleRate: 16000,
            numberOfChannels: 1,
            bitRate: 32000,
          },
          web: {},
        });
        await recording.startAsync();
        await new Promise((resolve) => setTimeout(resolve, AUDIO_SEGMENT_MS));
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        if (uri && Platform.OS !== 'web') {
          const b64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          latestAudioB64Ref.current = b64;
          await FileSystem.deleteAsync(uri, { idempotent: true });
        }
      } catch (_) {
        if (recording) {
          try {
            await recording.stopAndUnloadAsync();
          } catch (_inner) {}
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
  }, []);

  const captureLoop = useCallback(async () => {
    const tick = async () => {
      if (!isCapturingRef.current) return;
      const t0 = Date.now();
      try {
        if (cameraRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
          const photo = await cameraRef.current.takePictureAsync({
            base64: true,
            quality: 0.25,
            skipProcessing: true,
          });
          wsRef.current.send(
            JSON.stringify({
              video_frame: photo.base64 ?? '',
              audio_chunk: latestAudioB64Ref.current,
            })
          );
        }
      } catch (_) {}
      const delay = Math.max(0, FRAME_INTERVAL_MS - (Date.now() - t0));
      captureTimerRef.current = setTimeout(tick, delay);
    };
    tick();
  }, []);

  const startMonitoring = useCallback(() => {
    const ws = new WebSocket(`ws://${serverIp}:8000/stream`);

    ws.onopen = () => {
      setConnected(true);
      setRunning(true);
      isCapturingRef.current = true;
      audioLoop();
      captureLoop();
    };

    ws.onclose = () => teardown();
    ws.onerror = () => teardown();

    ws.onmessage = ({ data }) => {
      try {
        setResult(JSON.parse(data));
      } catch (_) {}
    };

    wsRef.current = ws;
  }, [serverIp, audioLoop, captureLoop]);

  const stopMonitoring = () => {
    isCapturingRef.current = false;
    audioActiveRef.current = false;
    teardown();
  };

  if (!camPermission) {
    return <View style={styles.root} />;
  }

  if (!camPermission.granted || !micGranted) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar style="light" />
        <View style={styles.permContainer}>
          <Text style={styles.permTitle}>Permissions Required</Text>
          <Text style={styles.permSub}>
            Camera and microphone access are needed to run the stroke detection monitor.
          </Text>
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={async () => {
              await requestCamPermission();
              const { status } = await Audio.requestPermissionsAsync();
              setMicGranted(status === 'granted');
            }}
          >
            <Text style={styles.btnText}>Grant Permissions</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const borderColor = result.alert_active ? '#FF3B30' : connected ? '#30D158' : '#333';

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />

      <View style={[styles.cameraWrap, { borderColor }]}>
        <CameraView ref={cameraRef} style={styles.camera} facing="front" />

        <View style={styles.overlay}>
          <Text style={[styles.overlayTitle, result.alert_active && styles.alertColor]}>
            {result.alert_active ? '⚠ STROKE ALERT' : result.face_status}
          </Text>
          <RatioBar label="Lower (Mouth)" value={result.face_ratios?.lower ?? 1.0} />
          <RatioBar label="Upper (Brow) " value={result.face_ratios?.upper ?? 1.0} />
          <View style={styles.divider} />
          <Text style={styles.overlayLine}>
            Voice: {result.voice_status}{' '}
            <Text style={styles.dimText}>
              ({(result.voice_confidence * 100).toFixed(0)}% conf)
            </Text>
          </Text>
          <Text style={styles.dimText}>
            Jitter: {result.voice_jitter?.toFixed(4) ?? '—'} {'  '}
            Shimmer: {result.voice_shimmer?.toFixed(4) ?? '—'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.controls}
        contentContainerStyle={styles.controlsContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.fieldLabel}>Backend IP</Text>
        <TextInput
          style={styles.ipInput}
          value={serverIp}
          onChangeText={setServerIp}
          editable={!running}
          keyboardType="numbers-and-punctuation"
          autoCorrect={false}
          placeholder="192.168.x.x"
          placeholderTextColor="#444"
        />

        <TouchableOpacity
          style={[styles.btnPrimary, running && styles.btnStop]}
          onPress={running ? stopMonitoring : startMonitoring}
          activeOpacity={0.8}
        >
          <Text style={styles.btnText}>
            {running ? 'Stop Monitoring' : 'Start Monitoring'}
          </Text>
        </TouchableOpacity>

        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: connected ? '#30D158' : '#555' }]} />
          <Text style={styles.statusText}>
            {connected ? `Connected  •  ${TARGET_FPS} FPS` : 'Disconnected'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
    ...(Platform.OS === 'web'
      ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }
      : {}),
  },
  cameraWrap: {
    flex: 1,
    margin: 10,
    borderRadius: 14,
    borderWidth: 3,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.72)',
    padding: 14,
    gap: 5,
  },
  overlayTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  alertColor: {
    color: '#FF3B30',
  },
  overlayLine: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  dimText: {
    color: '#aaa',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  ratioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratioLabel: {
    color: '#ccc',
    fontSize: 12,
    fontFamily: 'monospace',
    width: 110,
  },
  ratioValue: {
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: '600',
    width: 54,
  },
  ratioTag: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 3,
  },
  controls: {
    maxHeight: 230,
  },
  controlsContent: {
    padding: 16,
    gap: 10,
  },
  fieldLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 2,
  },
  ipInput: {
    backgroundColor: '#1c1c1e',
    color: '#fff',
    padding: 12,
    borderRadius: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#333',
    fontFamily: 'monospace',
  },
  btnPrimary: {
    backgroundColor: '#0A84FF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnStop: {
    backgroundColor: '#FF3B30',
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  statusText: {
    color: '#888',
    fontSize: 13,
  },
  permContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  permTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  permSub: {
    color: '#aaa',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
