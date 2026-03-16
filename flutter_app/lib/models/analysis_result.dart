import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class FaceRatios {
  final double lower;
  final double upper;

  const FaceRatios({this.lower = 1.0, this.upper = 1.0});

  factory FaceRatios.fromJson(Map<String, dynamic> json) => FaceRatios(
        lower: (json['lower'] as num?)?.toDouble() ?? 1.0,
        upper: (json['upper'] as num?)?.toDouble() ?? 1.0,
      );
}

enum AlertLevel { normal, warning, alert, emergency }

class AnalysisResult {
  final String faceStatus;
  final FaceRatios faceRatios;
  final bool alertFace;

  final String voiceStatus;
  final double voiceConfidence;
  final double voiceJitter;
  final double voiceShimmer;

  final bool alertActive;
  final AlertLevel alertLevel;

  const AnalysisResult({
    this.faceStatus = 'Connecting…',
    this.faceRatios = const FaceRatios(),
    this.alertFace = false,
    this.voiceStatus = '—',
    this.voiceConfidence = 0.0,
    this.voiceJitter = 0.0,
    this.voiceShimmer = 0.0,
    this.alertActive = false,
    this.alertLevel = AlertLevel.normal,
  });

  factory AnalysisResult.fromJson(Map<String, dynamic> json) {
    final level = json['alert_level'] as int? ?? 0;
    return AnalysisResult(
      faceStatus: json['face_status'] as String? ?? '—',
      faceRatios:
          FaceRatios.fromJson(json['face_ratios'] as Map<String, dynamic>? ?? {}),
      alertFace: json['alert_face'] as bool? ?? false,
      voiceStatus: json['voice_status'] as String? ?? '—',
      voiceConfidence: (json['voice_confidence'] as num?)?.toDouble() ?? 0.0,
      voiceJitter: (json['voice_jitter'] as num?)?.toDouble() ?? 0.0,
      voiceShimmer: (json['voice_shimmer'] as num?)?.toDouble() ?? 0.0,
      alertActive: json['alert_active'] as bool? ?? false,
      alertLevel: AlertLevel.values[level.clamp(0, 3)],
    );
  }
}

/// Visual configuration per alert level.
class AlertConfig {
  final Color bgColor;
  final Color textColor;
  final Color borderColor;
  final String icon;
  final String title;
  final String subtitle;
  final String badge;

  const AlertConfig({
    required this.bgColor,
    required this.textColor,
    required this.borderColor,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.badge,
  });
}

const Map<AlertLevel, AlertConfig> kAlertConfig = {
  AlertLevel.normal: AlertConfig(
    bgColor: AppColors.greenBg,
    textColor: AppColors.green,
    borderColor: AppColors.greenBorder,
    icon: '💚',
    title: 'No Stroke Indicators',
    subtitle: 'All parameters within normal range',
    badge: 'LEVEL 0 — NORMAL',
  ),
  AlertLevel.warning: AlertConfig(
    bgColor: AppColors.amberBg,
    textColor: AppColors.amber,
    borderColor: AppColors.amberBorder,
    icon: '🟡',
    title: 'Warning — Single Marker',
    subtitle: 'Face or speech abnormality observed. Continue monitoring.',
    badge: 'LEVEL 1 — WARNING',
  ),
  AlertLevel.alert: AlertConfig(
    bgColor: AppColors.redBg,
    textColor: AppColors.red,
    borderColor: AppColors.redBorder,
    icon: '🔴',
    title: 'Alert — Multiple Markers',
    subtitle: 'Face AND speech abnormalities detected. Seek clinical assessment.',
    badge: 'LEVEL 2 — ALERT',
  ),
  AlertLevel.emergency: AlertConfig(
    bgColor: Color(0xFF7F1D1D),
    textColor: Colors.white,
    borderColor: Color(0xFF991B1B),
    icon: '🚨',
    title: 'EMERGENCY — Stroke Signs',
    subtitle: 'FAST positive: facial droop + severe dysarthria. Call emergency NOW.',
    badge: 'LEVEL 3 — EMERGENCY',
  ),
};
