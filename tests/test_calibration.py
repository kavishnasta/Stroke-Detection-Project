import math
import pytest

from stroke_detection.calibration import Calibrator


SAMPLE_METRICS = {
    "lower_face_ratio": 1.0,
    "upper_face_ratio": 1.0,
}


class TestCalibrator:
    def test_not_complete_until_n_frames(self):
        cal = Calibrator(n_frames=10)
        for _ in range(9):
            assert cal.add_frame(SAMPLE_METRICS) is False
        assert not cal.is_complete
        assert cal.add_frame(SAMPLE_METRICS) is True
        assert cal.is_complete

    def test_frames_remaining(self):
        cal = Calibrator(n_frames=5)
        assert cal.frames_remaining == 5
        cal.add_frame(SAMPLE_METRICS)
        assert cal.frames_remaining == 4

    def test_baseline_none_before_complete(self):
        cal = Calibrator(n_frames=5)
        assert cal.get_baseline() is None

    def test_baseline_mean_constant_input(self):
        cal = Calibrator(n_frames=10)
        for _ in range(10):
            cal.add_frame(SAMPLE_METRICS)
        baseline = cal.get_baseline()
        assert baseline is not None
        for key, stats in baseline.items():
            assert math.isclose(stats["mean"], SAMPLE_METRICS[key], rel_tol=1e-9)
            assert math.isclose(stats["std"], 0.0, abs_tol=1e-9)

    def test_baseline_mean_varying_input(self):
        cal = Calibrator(n_frames=4)
        values = [0.90, 0.95, 1.00, 1.05]
        for v in values:
            cal.add_frame({"lower_face_ratio": v, "upper_face_ratio": v})
        baseline = cal.get_baseline()
        expected_mean = sum(values) / len(values)
        assert math.isclose(baseline["lower_face_ratio"]["mean"], expected_mean, rel_tol=1e-6)
        assert baseline["lower_face_ratio"]["std"] > 0

    def test_reset(self):
        cal = Calibrator(n_frames=5)
        for _ in range(5):
            cal.add_frame(SAMPLE_METRICS)
        assert cal.is_complete
        cal.reset()
        assert not cal.is_complete
        assert cal.get_baseline() is None
        assert cal.frames_collected == 0

    def test_add_frame_after_complete_returns_true(self):
        cal = Calibrator(n_frames=2)
        cal.add_frame(SAMPLE_METRICS)
        cal.add_frame(SAMPLE_METRICS)
        assert cal.add_frame(SAMPLE_METRICS) is True
