import 'package:flutter/material.dart';
import '../models/analysis_result.dart';
import '../theme/app_theme.dart';

class AlertBanner extends StatefulWidget {
  final AlertLevel level;
  final bool running;

  const AlertBanner({super.key, required this.level, required this.running});

  @override
  State<AlertBanner> createState() => _AlertBannerState();
}

class _AlertBannerState extends State<AlertBanner>
    with SingleTickerProviderStateMixin {
  late AnimationController _pulse;
  late Animation<double> _scaleAnim;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _scaleAnim = Tween<double>(begin: 1.0, end: 1.04).animate(
      CurvedAnimation(parent: _pulse, curve: Curves.easeInOut),
    );
    _updateAnimation();
  }

  @override
  void didUpdateWidget(AlertBanner old) {
    super.didUpdateWidget(old);
    if (old.level != widget.level) _updateAnimation();
  }

  void _updateAnimation() {
    if (widget.level == AlertLevel.emergency) {
      _pulse.repeat(reverse: true);
    } else if (widget.level == AlertLevel.alert) {
      _pulse.repeat(reverse: true);
    } else {
      _pulse.stop();
      _pulse.reset();
    }
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.running) {
      return _IdleBanner();
    }

    final cfg = kAlertConfig[widget.level]!;

    return AnimatedBuilder(
      animation: _scaleAnim,
      builder: (context, child) => Transform.scale(
        scale: widget.level.index >= 2 ? _scaleAnim.value : 1.0,
        child: child,
      ),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeInOut,
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        decoration: BoxDecoration(
          color: cfg.bgColor,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: cfg.borderColor, width: 1.5),
        ),
        child: Row(
          children: [
            Text(cfg.icon, style: const TextStyle(fontSize: 28)),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    cfg.title,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: cfg.textColor,
                      letterSpacing: -0.2,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    cfg.subtitle,
                    style: TextStyle(
                      fontSize: 12,
                      color: cfg.textColor.withOpacity(0.85),
                      height: 1.35,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            _LevelBadge(level: widget.level, cfg: cfg),
          ],
        ),
      ),
    );
  }
}

class _LevelBadge extends StatelessWidget {
  final AlertLevel level;
  final AlertConfig cfg;

  const _LevelBadge({required this.level, required this.cfg});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: cfg.textColor.withOpacity(0.12),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: cfg.textColor.withOpacity(0.3)),
      ),
      child: Text(
        'L${level.index}',
        style: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w800,
          color: cfg.textColor,
        ),
      ),
    );
  }
}

class _IdleBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              color: AppColors.textDim,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 14),
          const Text(
            'Not monitoring — tap Connect to start',
            style: TextStyle(
              fontSize: 13,
              color: AppColors.textDim,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
