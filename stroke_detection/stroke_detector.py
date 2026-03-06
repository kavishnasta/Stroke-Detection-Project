from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

import cv2
import mediapipe as mp
import numpy as np

from .calibration import Calibrator
from .detector import StrokeDetector, STATUS_CALIBRATING
from .metrics import compute_all_metrics


class StrokeDetectionAPI:

    def __init__(
        self,
        calibration_frames: int = 100,
        deviation_threshold: float = 0.20,
        alert_duration: float = 2.0,
        smoothing_window: int = 45,
        debounce_interval: float = 2.0,
        max_num_faces: int = 1,
        min_detection_confidence: float = 0.5,
        min_tracking_confidence: float = 0.5,
    ) -> None:
        self._calibration_frames = calibration_frames
        self._deviation_threshold = deviation_threshold
        self._alert_duration = alert_duration
        self._smoothing_window = smoothing_window
        self._debounce_interval = debounce_interval

        self._mp_face_mesh = mp.solutions.face_mesh
        self._face_mesh = self._mp_face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=max_num_faces,
            refine_landmarks=True,
            min_detection_confidence=min_detection_confidence,
            min_tracking_confidence=min_tracking_confidence,
        )

        self._calibrator = Calibrator(n_frames=calibration_frames)
        self._detector: Optional[StrokeDetector] = None

        self._last_status: Dict[str, Any] = {
            "status_message": STATUS_CALIBRATING,
            "calibrated": False,
            "frames_remaining": calibration_frames,
        }

    def calibrate(self, frame: np.ndarray) -> Dict[str, Any]:
        landmarks = self._extract_landmarks(frame)
        if landmarks is None:
            return {
                "status_message": STATUS_CALIBRATING,
                "calibrated": False,
                "frames_remaining": self._calibrator.frames_remaining,
                "no_face": True,
            }

        metrics = compute_all_metrics(landmarks)
        done = self._calibrator.add_frame(metrics)

        if done and self._detector is None:
            baseline = self._calibrator.get_baseline()
            self._detector = StrokeDetector(
                baseline=baseline,
                deviation_threshold=self._deviation_threshold,
                alert_duration=self._alert_duration,
                smoothing_window=self._smoothing_window,
                debounce_interval=self._debounce_interval,
            )

        self._last_status = {
            "status_message": STATUS_CALIBRATING,
            "calibrated": done,
            "frames_remaining": self._calibrator.frames_remaining,
        }
        return self._last_status

    def process_frame(self, frame: np.ndarray) -> Dict[str, Any]:
        if self._detector is None:
            return self.calibrate(frame)

        landmarks = self._extract_landmarks(frame)
        if landmarks is None:
            status = self._detector.get_status()
            status["no_face"] = True
            self._last_status = status
            return self._last_status

        metrics = compute_all_metrics(landmarks)
        status = self._detector.update(metrics)
        self._last_status = status
        return self._last_status

    def get_status(self) -> Dict[str, Any]:
        return dict(self._last_status)

    def reset(self) -> None:
        self._calibrator.reset()
        self._detector = None
        self._last_status = {
            "status_message": STATUS_CALIBRATING,
            "calibrated": False,
            "frames_remaining": self._calibration_frames,
        }

    def close(self) -> None:
        self._face_mesh.close()

    def _extract_landmarks(
        self, frame: np.ndarray
    ) -> Optional[Dict[int, Tuple[float, float, float]]]:
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self._face_mesh.process(rgb)
        if not results.multi_face_landmarks:
            return None

        face = results.multi_face_landmarks[0]
        h, w, _ = frame.shape
        landmarks: Dict[int, Tuple[float, float, float]] = {}
        for idx, lm in enumerate(face.landmark):
            landmarks[idx] = (lm.x * w, lm.y * h, lm.z * w)

        return landmarks
