from __future__ import annotations

import math
from typing import Dict, Tuple

LEFT_EYE = 33
RIGHT_EYE = 263
MOUTH_LEFT = 61
MOUTH_RIGHT = 291
LEFT_EYEBROW = 105
RIGHT_EYEBROW = 336


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

    max_dist = max(left_dist, right_dist)
    min_dist = min(left_dist, right_dist)
    ratio = (min_dist / max_dist) if max_dist > 0 else 1.0

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

    max_dist = max(left_dist, right_dist)
    min_dist = min(left_dist, right_dist)
    ratio = (min_dist / max_dist) if max_dist > 0 else 1.0

    return {
        "left_dist": left_dist,
        "right_dist": right_dist,
        "ratio": ratio,
    }


def compute_all_metrics(
    landmarks: Dict[int, Tuple[float, float, float]],
) -> Dict[str, float]:
    lower = compute_lower_face_asymmetry(landmarks)
    upper = compute_upper_face_asymmetry(landmarks)

    return {
        "lower_face_ratio": lower["ratio"],
        "upper_face_ratio": upper["ratio"],
    }
