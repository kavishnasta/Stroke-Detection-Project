import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/foundation.dart';
import 'package:record/record.dart';
import 'package:path_provider/path_provider.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:web_socket_channel/status.dart' as ws_status;

import '../models/analysis_result.dart';

enum ServiceState { idle, connecting, running, error }

class MonitorService extends ChangeNotifier {
  // ── Public state ────────────────────────────────────────────────────────────
  ServiceState state = ServiceState.idle;
  AnalysisResult result = const AnalysisResult();
  String errorMessage = '';
  String serverIp = '';
  CameraController? cameraController;

  // ── Private members ─────────────────────────────────────────────────────────
  WebSocketChannel? _channel;
  final AudioRecorder _recorder = AudioRecorder();

  Timer? _frameTimer;
  String _latestAudioB64 = '';
  bool _audioLoopActive = false;

  static const int _targetFps = 12;
  static const Duration _frameInterval =
      Duration(milliseconds: 1000 ~/ _targetFps); // ~83 ms
  static const Duration _audioChunkDuration = Duration(milliseconds: 1500);

  // ── Camera initialisation ────────────────────────────────────────────────────
  Future<void> initCamera(List<CameraDescription> cameras) async {
    if (cameras.isEmpty) return;
    cameraController?.dispose();
    final cam = cameraController = CameraController(
      cameras.first,
      ResolutionPreset.low, // ~352×288 — sufficient for face detection
      enableAudio: false,
      imageFormatGroup: ImageFormatGroup.jpeg,
    );
    try {
      await cam.initialize();
      notifyListeners();
    } catch (e) {
      errorMessage = 'Camera init failed: $e';
      notifyListeners();
    }
  }

  void setError(String message) {
    errorMessage = message;
    state = ServiceState.error;
    notifyListeners();
  }

  // ── Connect ──────────────────────────────────────────────────────────────────
  Future<void> connect(String ip) async {
    if (state == ServiceState.running) return;
    serverIp = ip;
    state = ServiceState.connecting;
    errorMessage = '';
    notifyListeners();

    try {
      final uri = Uri.parse('ws://$ip:8000/stream');
      _channel = WebSocketChannel.connect(uri);

      // Wait for the connection handshake (throws if unreachable).
      await _channel!.ready;

      _channel!.stream.listen(
        _onMessage,
        onDone: () => _handleDisconnect('Connection closed'),
        onError: (e) => _handleDisconnect('Connection error: $e'),
        cancelOnError: true,
      );

      state = ServiceState.running;
      notifyListeners();

      _startAudioLoop();
      _startFrameCapture();
    } catch (e) {
      errorMessage = 'Cannot reach ws://$ip:8000 — is the server running?';
      state = ServiceState.error;
      notifyListeners();
    }
  }

  // ── Disconnect ───────────────────────────────────────────────────────────────
  void disconnect() {
    _stopAll();
    state = ServiceState.idle;
    result = const AnalysisResult();
    notifyListeners();
  }

  void _stopAll() {
    _frameTimer?.cancel();
    _frameTimer = null;
    _audioLoopActive = false;
    _recorder.stop().catchError((_) {});
    _channel?.sink.close(ws_status.normalClosure);
    _channel = null;
  }

  void _handleDisconnect(String reason) {
    _stopAll();
    if (state == ServiceState.running) {
      errorMessage = reason;
      state = ServiceState.error;
      notifyListeners();
    }
  }

  // ── Incoming message ─────────────────────────────────────────────────────────
  void _onMessage(dynamic data) {
    try {
      final json = jsonDecode(data as String) as Map<String, dynamic>;
      result = AnalysisResult.fromJson(json);
      notifyListeners();
    } catch (_) {}
  }

  // ── Frame capture ─────────────────────────────────────────────────────────────
  void _startFrameCapture() {
    _frameTimer = Timer.periodic(_frameInterval, (_) => _captureFrame());
  }

  Future<void> _captureFrame() async {
    if (state != ServiceState.running) return;
    final cam = cameraController;
    if (cam == null || !cam.value.isInitialized || cam.value.isTakingPicture) {
      return;
    }
    try {
      final XFile photo = await cam.takePicture();
      final bytes = await photo.readAsBytes();
      final b64 = base64Encode(bytes);

      _channel?.sink.add(jsonEncode({
        'video_frame': b64,
        'audio_chunk': _latestAudioB64,
      }));
      _latestAudioB64 = '';

      await File(photo.path).delete().catchError((_) {});
    } catch (_) {}
  }

  // ── Audio recording loop ──────────────────────────────────────────────────────
  void _startAudioLoop() {
    _audioLoopActive = true;
    _audioLoop();
  }

  Future<void> _audioLoop() async {
    while (_audioLoopActive && state == ServiceState.running) {
      await _recordChunk();
    }
  }

  Future<void> _recordChunk() async {
    try {
      final dir = await getTemporaryDirectory();
      final path = '${dir.path}/stroke_audio_${DateTime.now().millisecondsSinceEpoch}.wav';

      await _recorder.start(
        RecordConfig(
          encoder: AudioEncoder.wav,
          sampleRate: 16000,
          numChannels: 1,
        ),
        path: path,
      );

      await Future.delayed(_audioChunkDuration);

      if (!_audioLoopActive) {
        await _recorder.stop();
        return;
      }

      final filePath = await _recorder.stop();
      if (filePath != null) {
        final bytes = await File(filePath).readAsBytes();
        _latestAudioB64 = base64Encode(bytes);
        await File(filePath).delete().catchError((_) {});
      }
    } catch (_) {
      await Future.delayed(const Duration(milliseconds: 300));
    }
  }

  // ── Dispose ───────────────────────────────────────────────────────────────────
  @override
  void dispose() {
    _stopAll();
    cameraController?.dispose();
    _recorder.dispose();
    super.dispose();
  }
}
