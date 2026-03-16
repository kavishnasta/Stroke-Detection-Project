import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// A labelled metric tile with an animated bar gauge.
class MetricBar extends StatelessWidget {
  final String label;
  final String valueText;
  final double fraction; // 0.0 – 1.0
  final Color barColor;
  final Color barBg;

  const MetricBar({
    super.key,
    required this.label,
    required this.valueText,
    required this.fraction,
    this.barColor = AppColors.primary,
    this.barBg = AppColors.border,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              label,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: AppColors.textDim,
                letterSpacing: 0.4,
              ),
            ),
            Text(
              valueText,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: TweenAnimationBuilder<double>(
            tween: Tween(end: fraction.clamp(0.0, 1.0)),
            duration: const Duration(milliseconds: 500),
            curve: Curves.easeOut,
            builder: (_, v, __) => LinearProgressIndicator(
              value: v,
              minHeight: 6,
              backgroundColor: barBg,
              valueColor: AlwaysStoppedAnimation<Color>(barColor),
            ),
          ),
        ),
      ],
    );
  }
}

/// Card container for a group of related metrics.
class MetricCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final List<Widget> children;
  final Color? accentColor;

  const MetricCard({
    super.key,
    required this.title,
    required this.icon,
    required this.children,
    this.accentColor,
  });

  @override
  Widget build(BuildContext context) {
    final accent = accentColor ?? AppColors.primary;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(7),
                decoration: BoxDecoration(
                  color: accent.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, size: 16, color: accent),
              ),
              const SizedBox(width: 10),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                  letterSpacing: -0.2,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ...children,
        ],
      ),
    );
  }
}

/// Pill-shaped status badge.
class StatusBadge extends StatelessWidget {
  final String label;
  final Color color;
  final Color bgColor;

  const StatusBadge({
    super.key,
    required this.label,
    required this.color,
    required this.bgColor,
  });

  factory StatusBadge.forVoiceStatus(String status) {
    Color c;
    Color bg;
    switch (status) {
      case 'Normal':
        c = AppColors.green;
        bg = AppColors.greenBg;
        break;
      case 'Mild Dysarthria':
        c = AppColors.amber;
        bg = AppColors.amberBg;
        break;
      case 'Severe Dysarthria':
        c = AppColors.red;
        bg = AppColors.redBg;
        break;
      default:
        c = AppColors.textDim;
        bg = AppColors.bg;
    }
    return StatusBadge(label: status, color: c, bgColor: bg);
  }

  factory StatusBadge.forFaceStatus(String status) {
    final isAlert = status.contains('WARNING') || status.contains('DROOP') ||
        status.contains('PALSY');
    return StatusBadge(
      label: isAlert ? 'ALERT' : status == 'No Face Detected' ? 'No Face' : 'Normal',
      color: isAlert ? AppColors.red : AppColors.green,
      bgColor: isAlert ? AppColors.redBg : AppColors.greenBg,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: color,
          letterSpacing: 0.2,
        ),
      ),
    );
  }
}

/// Ratio symmetry indicator (shows deviation from 1.0).
class SymmetryIndicator extends StatelessWidget {
  final String label;
  final double ratio; // symmetry ratio; ideal = 1.0

  const SymmetryIndicator({super.key, required this.label, required this.ratio});

  @override
  Widget build(BuildContext context) {
    final deviation = (ratio - 1.0).abs();
    final isOk = deviation < 0.15;
    final color = isOk ? AppColors.green : AppColors.red;
    final pct = (deviation * 100).toStringAsFixed(1);

    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: color.withOpacity(0.1),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text(
            ratio.toStringAsFixed(3),
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          '${isOk ? '' : '+'}$pct%',
          style: TextStyle(
            fontSize: 11,
            color: color,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}
