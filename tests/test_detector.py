import pytest

from stroke_detection.detector import (
    StrokeDetector,
    STATUS_NEUTRAL,
    STATUS_STROKE,
    STATUS_PALSY,
)


BASELINE = {
    "lower_face_ratio": {"mean": 1.0, "std": 0.01},
    "upper_face_ratio": {"mean": 1.0, "std": 0.01},
}

NORMAL_METRICS = {
    "lower_face_ratio": 1.0,
    "upper_face_ratio": 1.0,
}


class TestStrokeDetector:
    def test_no_alert_within_threshold(self):
        det = StrokeDetector(BASELINE)
        status = det.update(NORMAL_METRICS, timestamp=0.0)
        assert status["alert"] is False
        assert status["status_message"] == STATUS_NEUTRAL

    def test_no_alert_for_short_deviation(self):
        det = StrokeDetector(BASELINE, deviation_threshold=0.20, alert_duration=2.0)
        deviated = {"lower_face_ratio": 0.5, "upper_face_ratio": 1.0}
        det.update(deviated, timestamp=0.0)
        status = det.update(deviated, timestamp=1.5)
        assert status["alert"] is False

    def test_stroke_alert_lower_droop_only(self):
        det = StrokeDetector(
            BASELINE,
            deviation_threshold=0.20,
            alert_duration=2.0,
            smoothing_window=1,
            debounce_interval=0.0,
        )
        deviated = {"lower_face_ratio": 0.5, "upper_face_ratio": 1.0}
        det.update(deviated, timestamp=0.0)
        det.update(deviated, timestamp=1.0)
        status = det.update(deviated, timestamp=2.5)
        assert status["alert"] is True
        assert status["status_message"] == STATUS_STROKE

    def test_palsy_alert_both_deviated(self):
        det = StrokeDetector(
            BASELINE,
            deviation_threshold=0.20,
            alert_duration=2.0,
            smoothing_window=1,
            debounce_interval=0.0,
        )
        deviated = {"lower_face_ratio": 0.5, "upper_face_ratio": 0.5}
        det.update(deviated, timestamp=0.0)
        det.update(deviated, timestamp=1.0)
        status = det.update(deviated, timestamp=2.5)
        assert status["alert"] is True
        assert status["status_message"] == STATUS_PALSY

    def test_alert_clears_when_normal(self):
        det = StrokeDetector(
            BASELINE,
            deviation_threshold=0.20,
            alert_duration=2.0,
            smoothing_window=1,
            debounce_interval=0.0,
        )
        deviated = {"lower_face_ratio": 0.5, "upper_face_ratio": 1.0}
        det.update(deviated, timestamp=0.0)
        det.update(deviated, timestamp=3.0)
        status = det.update(deviated, timestamp=3.5)
        assert status["alert"] is True

        status = det.update(NORMAL_METRICS, timestamp=6.0)
        assert status["alert"] is False
        assert status["status_message"] == STATUS_NEUTRAL

    def test_debounce_prevents_rapid_change(self):
        det = StrokeDetector(
            BASELINE,
            deviation_threshold=0.20,
            alert_duration=0.0,
            smoothing_window=1,
            debounce_interval=2.0,
        )
        deviated = {"lower_face_ratio": 0.5, "upper_face_ratio": 1.0}

        det.update(NORMAL_METRICS, timestamp=0.0)
        assert det.get_status()["status_message"] == STATUS_NEUTRAL

        det.update(deviated, timestamp=0.5)
        assert det.get_status()["status_message"] == STATUS_NEUTRAL

        det.update(deviated, timestamp=2.5)
        assert det.get_status()["status_message"] == STATUS_STROKE

    def test_smoothing_dampens_spike(self):
        det = StrokeDetector(
            BASELINE,
            deviation_threshold=0.20,
            alert_duration=0.0,
            smoothing_window=5,
            debounce_interval=0.0,
        )
        for i in range(4):
            det.update(NORMAL_METRICS, timestamp=float(i))

        spike = {"lower_face_ratio": 0.3, "upper_face_ratio": 1.0}
        status = det.update(spike, timestamp=4.0)
        assert status["smoothed_lower_ratio"] > 0.3

    def test_get_status_without_update(self):
        det = StrokeDetector(BASELINE)
        status = det.get_status()
        assert status["alert"] is False

    def test_reset(self):
        det = StrokeDetector(
            BASELINE,
            deviation_threshold=0.20,
            alert_duration=0.0,
            smoothing_window=1,
            debounce_interval=0.0,
        )
        deviated = {"lower_face_ratio": 0.5, "upper_face_ratio": 1.0}
        det.update(deviated, timestamp=0.0)
        det.update(deviated, timestamp=3.0)
        assert det.get_status()["alert"] is True

        det.reset()
        status = det.get_status()
        assert status["alert"] is False
        assert status["status_message"] == STATUS_NEUTRAL
