from __future__ import annotations

from typing import Dict, Optional

import numpy as np

DEFAULT_CALIBRATION_FRAMES = 100


class Calibrator:

    def __init__(self, n_frames: int = DEFAULT_CALIBRATION_FRAMES) -> None:
        self.n_frames = n_frames
        self._history: list[Dict[str, float]] = []
        self._baseline: Optional[Dict[str, Dict[str, float]]] = None

    @property
    def is_complete(self) -> bool:
        return len(self._history) >= self.n_frames

    @property
    def frames_collected(self) -> int:
        return len(self._history)

    @property
    def frames_remaining(self) -> int:
        return max(0, self.n_frames - len(self._history))

    def add_frame(self, metrics: Dict[str, float]) -> bool:
        if self.is_complete:
            return True

        self._history.append(metrics)

        if self.is_complete:
            self._compute_baseline()
            return True

        return False

    def get_baseline(self) -> Optional[Dict[str, Dict[str, float]]]:
        return self._baseline

    def reset(self) -> None:
        self._history.clear()
        self._baseline = None

    def _compute_baseline(self) -> None:
        keys = self._history[0].keys()
        arrays = {k: np.array([f[k] for f in self._history]) for k in keys}
        self._baseline = {
            k: {"mean": float(np.mean(v)), "std": float(np.std(v))}
            for k, v in arrays.items()
        }
