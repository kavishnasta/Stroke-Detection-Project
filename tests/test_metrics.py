import math
import pytest

from stroke_detection.metrics import (
    compute_lower_face_asymmetry,
    compute_upper_face_asymmetry,
    compute_symmetry_ratio,
    compute_all_metrics,
    _point_to_line_distance,
    LEFT_EYE, RIGHT_EYE, MOUTH_LEFT, MOUTH_RIGHT,
    LEFT_EYEBROW, RIGHT_EYEBROW, NOSE_TIP,
)


def _symmetric_landmarks() -> dict:
    lm = {}
    lm[LEFT_EYE] = (50.0, 100.0, 0.0)
    lm[RIGHT_EYE] = (150.0, 100.0, 0.0)
    lm[MOUTH_LEFT] = (70.0, 160.0, 0.0)
    lm[MOUTH_RIGHT] = (130.0, 160.0, 0.0)
    lm[LEFT_EYEBROW] = (55.0, 80.0, 0.0)
    lm[RIGHT_EYEBROW] = (145.0, 80.0, 0.0)
    lm[NOSE_TIP] = (100.0, 140.0, 0.0)
    return lm


class TestPointToLineDistance:
    def test_point_on_line(self):
        dist = _point_to_line_distance(
            (100.0, 100.0, 0.0), (50.0, 100.0, 0.0), (150.0, 100.0, 0.0)
        )
        assert math.isclose(dist, 0.0, abs_tol=1e-9)

    def test_point_above_line(self):
        dist = _point_to_line_distance(
            (100.0, 80.0, 0.0), (50.0, 100.0, 0.0), (150.0, 100.0, 0.0)
        )
        assert math.isclose(dist, 20.0, abs_tol=1e-9)

    def test_degenerate_line(self):
        dist = _point_to_line_distance(
            (10.0, 10.0, 0.0), (5.0, 5.0, 0.0), (5.0, 5.0, 0.0)
        )
        expected = math.sqrt(50.0)
        assert math.isclose(dist, expected, rel_tol=1e-6)


class TestLowerFaceAsymmetry:
    def test_symmetric_mouth(self):
        lm = _symmetric_landmarks()
        result = compute_lower_face_asymmetry(lm)
        assert math.isclose(result["ratio"], 1.0, rel_tol=1e-4)
        assert result["left_dist"] > 0
        assert math.isclose(result["left_dist"], result["right_dist"], rel_tol=1e-4)

    def test_asymmetric_mouth(self):
        lm = _symmetric_landmarks()
        lm[MOUTH_LEFT] = (70.0, 180.0, 0.0)
        result = compute_lower_face_asymmetry(lm)
        assert result["ratio"] > 1.0
        assert result["left_dist"] > result["right_dist"]


class TestUpperFaceAsymmetry:
    def test_symmetric_brows(self):
        lm = _symmetric_landmarks()
        result = compute_upper_face_asymmetry(lm)
        assert math.isclose(result["ratio"], 1.0, rel_tol=1e-4)

    def test_asymmetric_brows(self):
        lm = _symmetric_landmarks()
        lm[LEFT_EYEBROW] = (55.0, 95.0, 0.0)
        result = compute_upper_face_asymmetry(lm)
        assert result["ratio"] < 1.0


class TestComputeAllMetrics:
    def test_returns_all_keys(self):
        lm = _symmetric_landmarks()
        m = compute_all_metrics(lm)
        expected_keys = {
            "lower_face_ratio", "upper_face_ratio",
            "lower_symmetry_ratio", "upper_symmetry_ratio",
        }
        assert set(m.keys()) == expected_keys

    def test_symmetric_face_values(self):
        lm = _symmetric_landmarks()
        m = compute_all_metrics(lm)
        assert math.isclose(m["lower_face_ratio"], 1.0, rel_tol=1e-4)
        assert math.isclose(m["upper_face_ratio"], 1.0, rel_tol=1e-4)


class TestComputeSymmetryRatio:
    def test_symmetric_face(self):
        lm = _symmetric_landmarks()
        result = compute_symmetry_ratio(lm)
        assert math.isclose(result["lower_symmetry_ratio"], 1.0, rel_tol=1e-4)
        assert math.isclose(result["upper_symmetry_ratio"], 1.0, rel_tol=1e-4)

    def test_asymmetric_mouth(self):
        lm = _symmetric_landmarks()
        lm[MOUTH_LEFT] = (60.0, 180.0, 0.0)
        result = compute_symmetry_ratio(lm)
        assert result["lower_symmetry_ratio"] < 1.0

    def test_asymmetric_brow(self):
        lm = _symmetric_landmarks()
        lm[LEFT_EYEBROW] = (75.0, 80.0, 0.0)
        result = compute_symmetry_ratio(lm)
        assert result["upper_symmetry_ratio"] < 1.0
