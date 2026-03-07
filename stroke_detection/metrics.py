from __future__ import annotations

import math
from typing import Dict, Tuple

LEFT_EYE = 33
RIGHT_EYE = 263
MOUTH_LEFT = 61
MOUTH_RIGHT = 291
LEFT_EYEBROW = 105
RIGHT_EYEBROW = 336
NOSE_TIP = 1


def _point_to_line_distance(
    point: Tuple[float, float, float],
    line_a: Tuple[float, float, float],
    line_b: Tuple[float, float, float],
) -> float:
    ax, ay = line_a[0], line_a[1]
    bx, by = line_b[0], line_b[1]
    px, py = point[0], point[1]

    dx = bx - ax
    dy = by - ay
    length = math.sqrt(dx * dx + dy * dy)

    if length == 0:
        return math.sqrt((px - ax) ** 2 + (py - ay) ** 2)

    return abs(dy * px - dx * py + bx * ay - by * ax) / length


def compute_lower_face_asymmetry(
    landmarks: Dict[int, Tuple[float, float, float]],
) -> Dict[str, float]:
    eye_left = landmarks[LEFT_EYE]
    eye_right = landmarks[RIGHT_EYE]
    mouth_left = landmarks[MOUTH_LEFT]
    mouth_right = landmarks[MOUTH_RIGHT]

    left_dist = _point_to_line_distance(mouth_left, eye_left, eye_right)
    right_dist = _point_to_line_distance(mouth_right, eye_left, eye_right)

    ratio = (left_dist / right_dist) if right_dist > 0 else 1.0

    return {
        "left_dist": left_dist,
        "right_dist": right_dist,
        "ratio": ratio,
    }


def compute_upper_face_asymmetry(
    landmarks: Dict[int, Tuple[float, float, float]],
) -> Dict[str, float]:
    eye_left = landmarks[LEFT_EYE]
    eye_right = landmarks[RIGHT_EYE]
    brow_left = landmarks[LEFT_EYEBROW]
    brow_right = landmarks[RIGHT_EYEBROW]

    left_dist = _point_to_line_distance(brow_left, eye_left, eye_right)
    right_dist = _point_to_line_distance(brow_right, eye_left, eye_right)

    ratio = (left_dist / right_dist) if right_dist > 0 else 1.0

    return {
        "left_dist": left_dist,
        "right_dist": right_dist,
        "ratio": ratio,
    }


def compute_symmetry_ratio(
    landmarks: Dict[int, Tuple[float, float, float]],
) -> Dict[str, float]:
    eye_left = landmarks[LEFT_EYE]
    eye_right = landmarks[RIGHT_EYE]
    midpoint = (
        (eye_left[0] + eye_right[0]) / 2.0,
        (eye_left[1] + eye_right[1]) / 2.0,
        0.0,
    )
    nose = landmarks[NOSE_TIP]

    mouth_left = landmarks[MOUTH_LEFT]
    mouth_right = landmarks[MOUTH_RIGHT]
    left_mouth_dist = _point_to_line_distance(mouth_left, midpoint, nose)
    right_mouth_dist = _point_to_line_distance(mouth_right, midpoint, nose)
    max_mouth = max(left_mouth_dist, right_mouth_dist)
    lower_ratio = (min(left_mouth_dist, right_mouth_dist) / max_mouth) if max_mouth > 0 else 1.0

    brow_left = landmarks[LEFT_EYEBROW]
    brow_right = landmarks[RIGHT_EYEBROW]
    left_brow_dist = _point_to_line_distance(brow_left, midpoint, nose)
    right_brow_dist = _point_to_line_distance(brow_right, midpoint, nose)
    max_brow = max(left_brow_dist, right_brow_dist)
    upper_ratio = (min(left_brow_dist, right_brow_dist) / max_brow) if max_brow > 0 else 1.0

    return {
        "lower_symmetry_ratio": lower_ratio,
        "upper_symmetry_ratio": upper_ratio,
    }


def compute_all_metrics(
    landmarks: Dict[int, Tuple[float, float, float]],
) -> Dict[str, float]:
    lower = compute_lower_face_asymmetry(landmarks)
    upper = compute_upper_face_asymmetry(landmarks)
    symmetry = compute_symmetry_ratio(landmarks)

    return {
        "lower_face_ratio": lower["ratio"],
        "upper_face_ratio": upper["ratio"],
        "lower_symmetry_ratio": symmetry["lower_symmetry_ratio"],
        "upper_symmetry_ratio": symmetry["upper_symmetry_ratio"],
    }
