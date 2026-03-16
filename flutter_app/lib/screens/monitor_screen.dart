import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';

import '../models/analysis_result.dart';
import '../services/monitor_service.dart';
import '../theme/app_theme.dart';
import '../widgets/alert_banner.dart';
import '../widgets/metric_card.dart';

class MonitorScreen extends StatefulWidget {
  final String serverIp;

  const MonitorScreen({super.key, required this.serverIp});

  @override
  State<MonitorScreen> createState() => _MonitorScreenState();
}

class _MonitorScreenState extends State<MonitorScreen> {
  late MonitorService _service;
  bool _initialised = false;

  @override
  void initState() {
    super.initState();
    _service = MonitorService();
    _init();
  }

  Future<void> _init() async {
    // Request camera + microphone permissions up-front.
    final statuses = await [Permission.camera, Permission.microphone].request();
    final camOk = statuses[Permission.camera]?.isGranted ?? false;
    final micOk = statuses[Permission.microphone]?.isGranted ?? false;

    if (!camOk || !micOk) {
      if (mounted) {
        _service.setError('Camera and microphone permissions are required.');
        setState(() => _initialised = true);
      }
      return;
    }

    final cameras = await availableCameras();
    await _service.initCamera(cameras);
    if (mounted) {
      setState(() => _initialised = true);
      await _service.connect(widget.serverIp);
    }
  }

  @override
  void dispose() {
    _service.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider.value(
      value: _service,
      child: AnnotatedRegion<SystemUiOverlayStyle>(
        value: SystemUiOverlayStyle.dark,
        child: Scaffold(
          backgroundColor: AppColors.bg,
          appBar: _buildAppBar(),
          body: _initialised ? _buildBody() : _buildLoading(),
        ),
      ),
    );
  }

  AppBar _buildAppBar() {
    return AppBar(
      title: const Text('FAST Monitor'),
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_ios_new, size: 18),
        onPressed: () {
          _service.disconnect();
          Navigator.of(context).pop();
        },
      ),
      actions: [
        Consumer<MonitorService>(
          builder: (_, svc, __) => Padding(
            padding: const EdgeInsets.only(right: 16),
            child: _ConnectionDot(state: svc.state),
          ),
        ),
      ],
    );
  }

  Widget _buildLoading() {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircularProgressIndicator(color: AppColors.primary),
          SizedBox(height: 16),
          Text('Initialising camera…',
              style: TextStyle(color: AppColors.textDim, fontSize: 14)),
        ],
      ),
    );
  }

  Widget _buildBody() {
    return Consumer<MonitorService>(
      builder: (_, svc, __) {
        final running = svc.state == ServiceState.running;
        return Column(
          children: [
            // Camera preview + overlay
            _CameraPreview(controller: svc.cameraController, service: svc),

            // Scrollable metrics
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
                child: Column(
                  children: [
                    AlertBanner(
                      level: svc.result.alertLevel,
                      running: running,
                    ),
                    if (svc.state == ServiceState.error) ...[
                      const SizedBox(height: 8),
                      _ErrorBanner(message: svc.errorMessage, onRetry: () {
                        svc.connect(widget.serverIp);
                      }),
                    ],
                    const SizedBox(height: 12),
                    _FaceMetricsCard(result: svc.result, running: running),
                    const SizedBox(height: 10),
                    _VoiceMetricsCard(result: svc.result, running: running),
                    const SizedBox(height: 16),
                    _buildDisconnectButton(svc),
                  ],
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildDisconnectButton(MonitorService svc) {
    if (svc.state == ServiceState.idle) return const SizedBox.shrink();
    return OutlinedButton.icon(
      onPressed: () {
        svc.disconnect();
        Navigator.of(context).pop();
      },
      icon: const Icon(Icons.stop_circle_outlined, size: 20),
      label: const Text('Stop & Disconnect'),
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.textSecondary,
        side: const BorderSide(color: AppColors.border),
      ),
    );
  }
}

// ── Camera Preview ─────────────────────────────────────────────────────────────

class _CameraPreview extends StatelessWidget {
  final CameraController? controller;
  final MonitorService service;

  const _CameraPreview({required this.controller, required this.service});

  @override
  Widget build(BuildContext context) {
    final height = MediaQuery.of(context).size.height * 0.32;
    return Container(
      height: height,
      width: double.infinity,
      color: Colors.black,
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (controller != null && controller!.value.isInitialized)
            ClipRect(child: CameraPreview(controller!))
          else
            const Center(
              child: Icon(Icons.videocam_off, color: Colors.white38, size: 48),
            ),

          // Overlay: face status tag
          Positioned(
            bottom: 10,
            left: 12,
            right: 12,
            child: Consumer<MonitorService>(
              builder: (_, svc, __) => _FaceStatusOverlay(
                status: svc.result.faceStatus,
                alertFace: svc.result.alertFace,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FaceStatusOverlay extends StatelessWidget {
  final String status;
  final bool alertFace;

  const _FaceStatusOverlay({required this.status, required this.alertFace});

  @override
  Widget build(BuildContext context) {
    final isAlert = alertFace;
    final label = isAlert
        ? status.replaceAll('WARNING: ', '')
        : status == 'MONITORING - NEUTRAL'
            ? 'Face tracking — normal'
            : status;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: isAlert
            ? AppColors.red.withOpacity(0.88)
            : Colors.black.withOpacity(0.55),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isAlert ? Icons.warning_amber_rounded : Icons.face_outlined,
            color: Colors.white,
            size: 15,
          ),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              label,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Face Metrics Card ──────────────────────────────────────────────────────────

class _FaceMetricsCard extends StatelessWidget {
  final AnalysisResult result;
  final bool running;

  const _FaceMetricsCard({required this.result, required this.running});

  @override
  Widget build(BuildContext context) {
    final deviationLower = (result.faceRatios.lower - 1.0).abs();
    final deviationUpper = (result.faceRatios.upper - 1.0).abs();
    final lowerFrac = (deviationLower / 0.30).clamp(0.0, 1.0);
    final upperFrac = (deviationUpper / 0.30).clamp(0.0, 1.0);

    Color barColorFor(double dev) =>
        dev < 0.10 ? AppColors.green : dev < 0.15 ? AppColors.amber : AppColors.red;

    return MetricCard(
      title: 'Face Symmetry',
      icon: Icons.face_retouching_natural,
      accentColor: result.alertFace ? AppColors.red : AppColors.green,
      children: [
        Row(
          children: [
            const Text(
              'Status',
              style: TextStyle(
                fontSize: 12,
                color: AppColors.textDim,
                fontWeight: FontWeight.w500,
              ),
            ),
            const Spacer(),
            StatusBadge.forFaceStatus(result.faceStatus),
          ],
        ),
        const SizedBox(height: 14),
        MetricBar(
          label: 'LOWER FACE',
          valueText: running ? result.faceRatios.lower.toStringAsFixed(3) : '—',
          fraction: running ? lowerFrac : 0.0,
          barColor: barColorFor(deviationLower),
        ),
        const SizedBox(height: 10),
        MetricBar(
          label: 'UPPER FACE',
          valueText: running ? result.faceRatios.upper.toStringAsFixed(3) : '—',
          fraction: running ? upperFrac : 0.0,
          barColor: barColorFor(deviationUpper),
        ),
        if (running) ...[
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              const Icon(Icons.info_outline, size: 12, color: AppColors.textDim),
              const SizedBox(width: 4),
              const Text(
                'Ideal symmetry = 1.000 · deviation < 15% = normal',
                style: TextStyle(fontSize: 10, color: AppColors.textDim),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

// ── Voice Metrics Card ─────────────────────────────────────────────────────────

class _VoiceMetricsCard extends StatelessWidget {
  final AnalysisResult result;
  final bool running;

  const _VoiceMetricsCard({required this.result, required this.running});

  @override
  Widget build(BuildContext context) {
    final jitterPct = result.voiceJitter * 100;
    final shimmerPct = result.voiceShimmer * 100;

    // Jitter: normal < 0.4%, pathological > 0.9% (detrended scale)
    final jitterFrac = (jitterPct / 1.5).clamp(0.0, 1.0);
    final shimmerFrac = (shimmerPct / 8.0).clamp(0.0, 1.0);

    Color jitterColor = jitterPct < 0.4
        ? AppColors.green
        : jitterPct < 0.9
            ? AppColors.amber
            : AppColors.red;
    Color shimmerColor = shimmerPct < 3.8
        ? AppColors.green
        : shimmerPct < 6.0
            ? AppColors.amber
            : AppColors.red;

    final isDysarthric = result.voiceStatus.contains('Dysarthria');

    return MetricCard(
      title: 'Voice Analysis',
      icon: Icons.graphic_eq,
      accentColor: isDysarthric ? AppColors.red : AppColors.green,
      children: [
        Row(
          children: [
            const Text(
              'Status',
              style: TextStyle(
                fontSize: 12,
                color: AppColors.textDim,
                fontWeight: FontWeight.w500,
              ),
            ),
            const Spacer(),
            StatusBadge.forVoiceStatus(
              running ? result.voiceStatus : '—',
            ),
          ],
        ),
        if (running && result.voiceConfidence > 0) ...[
          const SizedBox(height: 10),
          MetricBar(
            label: 'CONFIDENCE',
            valueText: '${(result.voiceConfidence * 100).toStringAsFixed(0)}%',
            fraction: result.voiceConfidence,
            barColor: AppColors.primary,
            barBg: AppColors.border,
          ),
        ],
        const SizedBox(height: 14),
        MetricBar(
          label: 'JITTER (period)',
          valueText: running && jitterPct > 0
              ? '${jitterPct.toStringAsFixed(2)}%'
              : running
                  ? 'Measuring…'
                  : '—',
          fraction: running ? jitterFrac : 0.0,
          barColor: jitterColor,
        ),
        const SizedBox(height: 10),
        MetricBar(
          label: 'SHIMMER (amplitude)',
          valueText: running && shimmerPct > 0
              ? '${shimmerPct.toStringAsFixed(2)}%'
              : running
                  ? 'Measuring…'
                  : '—',
          fraction: running ? shimmerFrac : 0.0,
          barColor: shimmerColor,
        ),
        if (running) ...[
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              const Icon(Icons.info_outline, size: 12, color: AppColors.textDim),
              const SizedBox(width: 4),
              const Text(
                'Jitter < 0.4% · Shimmer < 3.8% = normal speech',
                style: TextStyle(fontSize: 10, color: AppColors.textDim),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

// ── Error Banner ───────────────────────────────────────────────────────────────

class _ErrorBanner extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorBanner({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.redBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.redBorder),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: AppColors.red, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                color: AppColors.red,
                fontSize: 12,
                height: 1.4,
              ),
            ),
          ),
          TextButton(
            onPressed: onRetry,
            child: const Text(
              'Retry',
              style: TextStyle(
                  color: AppColors.red,
                  fontWeight: FontWeight.w700,
                  fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Connection dot indicator ───────────────────────────────────────────────────

class _ConnectionDot extends StatefulWidget {
  final ServiceState state;

  const _ConnectionDot({required this.state});

  @override
  State<_ConnectionDot> createState() => _ConnectionDotState();
}

class _ConnectionDotState extends State<_ConnectionDot>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    _update();
  }

  @override
  void didUpdateWidget(_ConnectionDot old) {
    super.didUpdateWidget(old);
    if (old.state != widget.state) _update();
  }

  void _update() {
    if (widget.state == ServiceState.running) {
      _ctrl.repeat(reverse: true);
    } else {
      _ctrl.stop();
      _ctrl.reset();
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    Color color;
    switch (widget.state) {
      case ServiceState.running:
        color = AppColors.green;
        break;
      case ServiceState.connecting:
        color = AppColors.amber;
        break;
      case ServiceState.error:
        color = AppColors.red;
        break;
      case ServiceState.idle:
        color = AppColors.textDim;
    }

    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) => Container(
        width: 10,
        height: 10,
        decoration: BoxDecoration(
          color: color.withOpacity(
            widget.state == ServiceState.running
                ? 0.5 + 0.5 * _ctrl.value
                : 1.0,
          ),
          shape: BoxShape.circle,
          boxShadow: widget.state == ServiceState.running
              ? [
                  BoxShadow(
                    color: color.withOpacity(0.4 * _ctrl.value),
                    blurRadius: 6,
                  )
                ]
              : null,
        ),
      ),
    );
  }
}
