from __future__ import annotations

import base64
import io
import wave
from typing import Optional, Tuple

import numpy as np

SAMPLE_RATE = 16000
# Clinical minimum: 3 seconds of sustained speech for reliable jitter/shimmer
# (filters sneezes <1s, yawns, coughs — all transient events)
MIN_SAMPLES = int(SAMPLE_RATE * 3.0)

# Clinical thresholds from MDVP/Praat literature (stored as fractions, not percent)
# Normal jitter (period) < 1.0%; pathological > 1.5%  [PMC7053781, PMC9895185]
_JITTER_MILD   = 0.010   # 1.0% — above normal
_JITTER_SEVERE = 0.015   # 1.5% — clearly pathological

# Normal shimmer (local) < 3.81%; pathological > 6.0%  [MDVP manual, PMC7053781]
_SHIMMER_MILD   = 0.038  # 3.8% — above normal
_SHIMMER_SEVERE = 0.060  # 6.0% — clearly pathological

_SPREAD_LOW  = 500.0
_SPREAD_HIGH = 3000.0

# Minimum confidence before any pathological label is applied
_MIN_CONFIDENCE = 0.65


def _decode_audio(audio_b64: str) -> Optional[Tuple[np.ndarray, int]]:
    try:
        raw = base64.b64decode(audio_b64)
    except Exception:
        return None

    if raw[:4] == b"RIFF":
        try:
            with wave.open(io.BytesIO(raw)) as wf:
                frames = wf.readframes(wf.getnframes())
                sr = wf.getframerate()
                n_channels = wf.getnchannels()
                sampwidth = wf.getsampwidth()

            dtype = np.int16 if sampwidth == 2 else np.int8
            data = np.frombuffer(frames, dtype=dtype).astype(np.float32)
            data /= np.iinfo(dtype).max

            if n_channels > 1:
                data = data.reshape(-1, n_channels).mean(axis=1)

            return data, sr
        except Exception:
            pass

    try:
        import soundfile as sf

        data, sr = sf.read(io.BytesIO(raw))
        if data.ndim > 1:
            data = data.mean(axis=1)
        return data.astype(np.float32), int(sr)
    except Exception:
        pass

    return None


def _yin_f0(signal: np.ndarray, sr: int) -> np.ndarray:
    frame_len = int(sr * 0.025)
    hop_len = int(sr * 0.010)
    tau_min = max(1, int(sr / 500.0))
    tau_max = min(frame_len - 1, int(sr / 50.0))

    fft_size = 1
    while fft_size < 2 * frame_len:
        fft_size <<= 1

    tau_range = np.arange(1, tau_max + 1, dtype=np.int32)
    f0_frames: list[float] = []

    for start in range(0, len(signal) - frame_len, hop_len):
        frame = signal[start : start + frame_len].astype(np.float64)

        X = np.fft.rfft(frame, n=fft_size)
        autocorr = np.fft.irfft(X * X.conj())[:frame_len]

        cumx2 = np.empty(frame_len + 1, dtype=np.float64)
        cumx2[0] = 0.0
        np.cumsum(frame ** 2, out=cumx2[1:])

        df = np.empty(tau_max + 1, dtype=np.float64)
        df[0] = 0.0
        df[1:] = cumx2[frame_len - tau_range] + (cumx2[frame_len] - cumx2[tau_range]) - 2.0 * autocorr[tau_range]

        cumdf = np.cumsum(df[1:])
        cmnd = np.ones(tau_max + 1, dtype=np.float64)
        cmnd[1:] = np.where(cumdf > 0.0, df[1:] * tau_range / cumdf, 1.0)

        tau_best = tau_min
        for tau in range(tau_min, tau_max):
            if cmnd[tau] < 0.10:
                while tau + 1 < tau_max and cmnd[tau + 1] < cmnd[tau]:
                    tau += 1
                tau_best = tau
                break

        f0_frames.append(float(sr) / tau_best if cmnd[tau_best] < 0.30 else 0.0)

    return np.array(f0_frames, dtype=np.float32)


def _compute_jitter(f0: np.ndarray) -> float:
    """Compute period jitter (local) — mean absolute period difference / mean period.
    Converts F0 to period domain to match clinical Praat jitter definition."""
    voiced = f0[f0 > 0]
    if len(voiced) < 3:
        return 0.0
    periods = 1.0 / voiced  # convert Hz → seconds (period)
    mean_period = float(np.mean(periods))
    return float(np.mean(np.abs(np.diff(periods)))) / mean_period if mean_period > 0 else 0.0


# Minimum fraction of frames that must be voiced before jitter/shimmer are meaningful.
# Background noise typically produces <10% voiced frames; real speech is 30-80%.
_MIN_VOICED_RATIO = 0.20

# RMS energy below this = silence / background noise — skip analysis entirely.
# Browser mic audio is often lower amplitude than expected due to AGC and downsampling.
_MIN_RMS_ENERGY = 0.002

# Jitter > 5% means the pitch tracker failed (noise, not dysarthria) — discard.
_MAX_VALID_JITTER = 0.05


def _compute_shimmer_voiced(signal: np.ndarray, sr: int, voiced_mask: np.ndarray) -> float:
    """Compute shimmer only on frames that are actually voiced.
    voiced_mask is a boolean array aligned with f0_frames."""
    frame_len = int(sr * 0.025)
    hop_len   = int(sr * 0.010)
    amps = []
    for i, start in enumerate(range(0, len(signal) - frame_len, hop_len)):
        if i < len(voiced_mask) and voiced_mask[i]:
            amps.append(float(np.max(np.abs(signal[start : start + frame_len]))))
    if len(amps) < 3:
        return 0.0
    a = np.array(amps, dtype=np.float32)
    mean_a = float(np.mean(a))
    return float(np.mean(np.abs(np.diff(a)))) / mean_a if mean_a > 0 else 0.0


def process_audio_chunk(audio_b64: str) -> dict:
    _no_data = {"status": "Insufficient Data", "confidence": 0.0, "jitter": 0.0, "shimmer": 0.0}

    if not audio_b64:
        return _no_data

    decoded = _decode_audio(audio_b64)
    if decoded is None:
        return _no_data

    signal, sr = decoded

    if len(signal) < MIN_SAMPLES:
        return _no_data

    # ── Gate 1: energy — reject silence and background noise ──────────────────
    rms = float(np.sqrt(np.mean(signal ** 2)))
    if rms < _MIN_RMS_ENERGY:
        return {"status": "No Speech", "confidence": 0.0, "jitter": 0.0, "shimmer": 0.0}

    # ── Pitch tracking ────────────────────────────────────────────────────────
    f0 = _yin_f0(signal, sr)
    voiced_mask = f0 > 0
    voiced_ratio = float(np.sum(voiced_mask)) / max(len(f0), 1)

    # ── Gate 2: voiced frame ratio — reject noise masquerading as speech ──────
    # Background noise: YIN detects <15% voiced; real speech: 40–80%
    if voiced_ratio < _MIN_VOICED_RATIO:
        return {"status": "No Speech", "confidence": 0.0, "jitter": 0.0, "shimmer": 0.0}

    # ── Compute metrics only on voiced frames ─────────────────────────────────
    jit  = _compute_jitter(f0)
    shim = _compute_shimmer_voiced(signal, sr, voiced_mask)

    # ── Gate 3: discard unreliable pitch tracker output ───────────────────────
    if jit > _MAX_VALID_JITTER:
        # Pitch tracker failed — shimmer on arbitrary frames is also unreliable,
        # so zero both to prevent constant-score artefacts (the "always 80%" bug)
        jit  = 0.0
        shim = 0.0

    # ── Scoring — both metrics must be co-elevated (dysarthria raises both) ───
    jitter_mild   = jit  > _JITTER_MILD
    jitter_severe = jit  > _JITTER_SEVERE
    shimmer_mild  = shim > _SHIMMER_MILD
    shimmer_severe= shim > _SHIMMER_SEVERE

    score = 0.0
    if jitter_mild and shimmer_mild:
        # Proportional co-elevation: scale linearly from mild→severe thresholds
        j_frac = min(1.0, (jit  - _JITTER_MILD)  / max(_JITTER_SEVERE  - _JITTER_MILD,  1e-9))
        s_frac = min(1.0, (shim - _SHIMMER_MILD) / max(_SHIMMER_SEVERE - _SHIMMER_MILD, 1e-9))
        score  = 0.22 + 0.48 * ((j_frac + s_frac) / 2.0)   # range: 0.22 – 0.70
    else:
        # Single metric elevated — likely noise residual; proportional small penalty
        if jitter_severe or shimmer_severe:
            j_over = max(0.0, jit  / _JITTER_SEVERE  - 1.0) if jitter_severe  else 0.0
            s_over = max(0.0, shim / _SHIMMER_SEVERE - 1.0) if shimmer_severe else 0.0
            score  = 0.04 + 0.07 * min(1.0, max(j_over, s_over))   # range: 0.04 – 0.11

    # ── Voiced-ratio quality factor — adds natural variation to confidence ────
    # voiced_ratio 0.20 (gate minimum) → 0.72 ;  0.70+ → 0.95
    _vq_lo, _vq_hi = _MIN_VOICED_RATIO, 0.70
    vq = 0.72 + 0.23 * min(1.0, max(0.0, (voiced_ratio - _vq_lo) / max(_vq_hi - _vq_lo, 1e-9)))

    if score < 0.30:
        status = "Normal"
        confidence = round(min(0.97, max(0.25, (1.0 - score * 2.8) * vq)), 3)
    elif score < 0.60:
        status = "Mild Dysarthria"
        confidence = round(min(0.92, max(0.30, score * vq)), 3)
    else:
        status = "Severe Dysarthria"
        confidence = round(min(0.97, min(score, 1.0) * vq), 3)

    if status != "Normal" and confidence < _MIN_CONFIDENCE:
        status = "Normal"
        confidence = round(1.0 - confidence, 3)

    return {
        "status": status,
        "confidence": confidence,
        "jitter": round(float(jit), 5),
        "shimmer": round(float(shim), 5),
    }
