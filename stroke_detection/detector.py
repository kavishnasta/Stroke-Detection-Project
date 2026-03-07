from __future__ import annotations

import collections
import time
from typing import Any, Dict, Optional


DEFAULT_DEVIATION_THRESHOLD = 0.20
DEFAULT_ALERT_DURATION_SEC = 2.0
DEFAULT_SMOOTHING_WINDOW = 45
DEFAULT_DEBOUNCE_INTERVAL = 2.0
DEFAULT_SYMMETRY_THRESHOLD = 0.15

STATUS_CALIBRATING = "CALIBRATING"
STATUS_NEUTRAL = "MONITORING - NEUTRAL"
STATUS_STROKE = "WARNING: LOWER FACIAL DROOP DETECTED"
STATUS_PALSY = "WARNING: PERIPHERAL NERVE PALSY SUSPECTED"

BASELINE_MODE = "BASELINE_MODE"
SYMMETRY_MODE = "SYMMETRY_MODE"
_VALID_MODES = {BASELINE_MODE, SYMMETRY_MODE}


class StrokeDetector:

    def __init__(
        self,
        baseline: Optional[Dict[str, Dict[str, float]]] = None,
        deviation_threshold: float = DEFAULT_DEVIATION_THRESHOLD,
        alert_duration: float = DEFAULT_ALERT_DURATION_SEC,
        smoothing_window: int = DEFAULT_SMOOTHING_WINDOW,
        debounce_interval: float = DEFAULT_DEBOUNCE_INTERVAL,
        mode: str = BASELINE_MODE,
        symmetry_threshold: float = DEFAULT_SYMMETRY_THRESHOLD,
    ) -> None:
        if mode not in _VALID_MODES:
            raise ValueError(f"Unknown mode {mode!r}, must be one of {_VALID_MODES}")


        self.mode = mode
        self.baseline = baseline
        self.deviation_threshold = deviation_threshold
        self.alert_duration = alert_duration
        self.smoothing_window = smoothing_window
        self.debounce_interval = debounce_interval
        self.symmetry_threshold = symmetry_threshold

        self._lower_buffer: collections.deque = collections.deque(maxlen=smoothing_window)
        self._upper_buffer: collections.deque = collections.deque(maxlen=smoothing_window)

        self._deviation_start: Optional[float] = None
        self._current_condition: str = STATUS_NEUTRAL
        self._displayed_status: str = STATUS_NEUTRAL
        self._last_status_change_time: Optional[float] = None

        self._smoothed_lower: float = 1.0
        self._smoothed_upper: float = 1.0
        self._lower_deviation: float = 0.0
        self._upper_deviation: float = 0.0
        self._alert_active: bool = False
        self._alert_sustained_seconds: float = 0.0

    def update(
        self, metrics: Dict[str, float], timestamp: Optional[float] = None
    ) -> Dict[str, Any]:
        now = timestamp if timestamp is not None else time.monotonic()

        if self.mode == SYMMETRY_MODE:
            return self._update_symmetry(metrics, now)
        return self._update_baseline(metrics, now)

    def set_mode(self, mode: str) -> None:
        if mode not in _VALID_MODES:
            raise ValueError(f"Unknown mode {mode!r}, must be one of {_VALID_MODES}")
        self.mode = mode
        self.reset()

    def _update_baseline(
        self, metrics: Dict[str, float], now: float
    ) -> Dict[str, Any]:
        lower_ratio = metrics.get("lower_face_ratio", 1.0)
        upper_ratio = metrics.get("upper_face_ratio", 1.0)

        self._lower_buffer.append(lower_ratio)
        self._upper_buffer.append(upper_ratio)

        self._smoothed_lower = sum(self._lower_buffer) / len(self._lower_buffer)
        self._smoothed_upper = sum(self._upper_buffer) / len(self._upper_buffer)

        if self.baseline is None:
            lower_high = self._smoothed_lower < 0.85 or self._smoothed_lower > 1.15
            upper_high = self._smoothed_upper < 0.85 or self._smoothed_upper > 1.15
            self._lower_deviation = abs(1.0 - self._smoothed_lower)
            self._upper_deviation = abs(1.0 - self._smoothed_upper)
        else:
            lower_mean = self.baseline["lower_face_ratio"]["mean"]
            upper_mean = self.baseline["upper_face_ratio"]["mean"]

            self._lower_deviation = (
                abs(self._smoothed_lower - lower_mean) / abs(lower_mean)
                if lower_mean != 0
                else abs(self._smoothed_lower - lower_mean)
            )
            self._upper_deviation = (
                abs(self._smoothed_upper - upper_mean) / abs(upper_mean)
                if upper_mean != 0
                else abs(self._smoothed_upper - upper_mean)
            )

            lower_high = self._lower_deviation > self.deviation_threshold
            upper_high = self._upper_deviation > self.deviation_threshold

        if lower_high and not upper_high:
            new_condition = STATUS_STROKE
        elif lower_high and upper_high:
            new_condition = STATUS_PALSY
        else:
            new_condition = STATUS_NEUTRAL

        if new_condition != STATUS_NEUTRAL:
            if self._deviation_start is None:
                self._deviation_start = now
            elapsed = now - self._deviation_start
            if elapsed >= self.alert_duration:
                self._alert_active = True
                self._alert_sustained_seconds = elapsed
                self._current_condition = new_condition
            else:
                self._alert_active = False
                self._alert_sustained_seconds = 0.0
                self._current_condition = STATUS_NEUTRAL
        else:
            self._deviation_start = None
            self._alert_active = False
            self._alert_sustained_seconds = 0.0
            self._current_condition = STATUS_NEUTRAL

        if self._last_status_change_time is None:
            self._displayed_status = self._current_condition
            self._last_status_change_time = now
        elif (now - self._last_status_change_time) >= self.debounce_interval:
            if self._current_condition != self._displayed_status:
                self._displayed_status = self._current_condition
                self._last_status_change_time = now

        return self.get_status()

    def _update_symmetry(
        self, metrics: Dict[str, float], now: float
    ) -> Dict[str, Any]:
        lower_ratio = metrics.get("lower_symmetry_ratio", 1.0)
        upper_ratio = metrics.get("upper_symmetry_ratio", 1.0)

        self._smoothed_lower = lower_ratio
        self._smoothed_upper = upper_ratio

        self._lower_deviation = 1.0 - lower_ratio
        self._upper_deviation = 1.0 - upper_ratio

        lower_high = self._lower_deviation > self.symmetry_threshold
        upper_high = self._upper_deviation > self.symmetry_threshold

        if lower_high and not upper_high:
            self._current_condition = STATUS_STROKE
            self._alert_active = True
        elif lower_high and upper_high:
            self._current_condition = STATUS_PALSY
            self._alert_active = True
        else:
            self._current_condition = STATUS_NEUTRAL
            self._alert_active = False

        self._alert_sustained_seconds = 0.0
        self._displayed_status = self._current_condition

        return self.get_status()

    def get_status(self) -> Dict[str, Any]:
        return {
            "status_message": self._displayed_status,
            "alert": self._alert_active,
            "alert_duration": self._alert_sustained_seconds,
            "lower_face_deviation": self._lower_deviation,
            "upper_face_deviation": self._upper_deviation,
            "smoothed_lower_ratio": self._smoothed_lower,
            "smoothed_upper_ratio": self._smoothed_upper,
        }

    def reset(self) -> None:
        self._lower_buffer.clear()
        self._upper_buffer.clear()
        self._deviation_start = None
        self._current_condition = STATUS_NEUTRAL
        self._displayed_status = STATUS_NEUTRAL
        self._last_status_change_time = None
        self._smoothed_lower = 1.0
        self._smoothed_upper = 1.0
        self._lower_deviation = 0.0
        self._upper_deviation = 0.0
        self._alert_active = False
        self._alert_sustained_seconds = 0.0
