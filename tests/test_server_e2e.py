from __future__ import annotations

import base64
import io
import json
import sys
import time
import wave

import cv2
import numpy as np

sys.path.insert(0, ".")
sys.path.insert(0, "./backend")

from starlette.testclient import TestClient

from backend.server import app

client = TestClient(app)

SR = 16000
rng = np.random.default_rng(42)


def make_wav_b64(sig: np.ndarray, sr: int = SR) -> str:
    pcm = (sig * 32767).astype(np.int16)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(pcm.tobytes())
    return base64.b64encode(buf.getvalue()).decode()


def make_blank_frame_b64() -> str:
    blank = np.zeros((480, 640, 3), dtype=np.uint8)
    _, buf = cv2.imencode(".jpg", blank)
    return base64.b64encode(buf.tobytes()).decode()


blank_b64 = make_blank_frame_b64()

t100 = np.linspace(0, 0.1, int(SR * 0.1), dtype=np.float32)
audio_100ms = make_wav_b64(np.sin(2 * np.pi * 180 * t100) * 0.5)

t1500 = np.linspace(0, 1.5, int(SR * 1.5), dtype=np.float32)
audio_1500ms = make_wav_b64(np.sin(2 * np.pi * 180 * t1500) * 0.5)

_sev_parts = []
for _hz in [80, 300, 90, 280, 100, 260, 110, 240, 95, 270, 85, 290]:
    _n = int(SR * 0.125)
    _amp = rng.uniform(0.05, 1.0)
    _sev_parts.append(
        np.sin(2 * np.pi * _hz * np.linspace(0, 0.125, _n, dtype=np.float32)) * _amp
    )
severe_audio = make_wav_b64(np.concatenate(_sev_parts))


def _p(ok: bool, label: str, detail: str = "") -> None:
    tag = "PASS" if ok else "FAIL"
    line = f"[{tag}] {label}"
    if detail:
        line += f"  {detail}"
    print(line)


print("=" * 60)
print("SERVER E2E TESTS  (in-process TestClient)")
print("=" * 60)

with client.websocket_connect("/stream") as ws:

    ws.send_json({"video_frame": blank_b64, "audio_chunk": audio_100ms})
    r = ws.receive_json()
    _p(
        r["face_status"] == "No Face Detected" and not r["alert_active"],
        "E2E-1  100ms audio + blank frame",
        f"face={r['face_status']}  voice={r['voice_status']}  alert={r['alert_active']}",
    )

    ws.send_json({"video_frame": blank_b64, "audio_chunk": ""})
    r = ws.receive_json()
    _p(
        not r["alert_active"],
        "E2E-2  Empty audio uses cached voice result",
        f"voice={r['voice_status']}  alert={r['alert_active']}",
    )

    ws.send_json({})
    r = ws.receive_json()
    required = {
        "face_status",
        "face_ratios",
        "voice_status",
        "voice_confidence",
        "voice_jitter",
        "voice_shimmer",
        "alert_active",
        "alert_face",
    }
    missing = required - set(r.keys())
    _p(not missing, "E2E-3  Empty payload schema", f"keys_present={sorted(r.keys())}")

    print("\n  Filling 1.5s sliding buffer (15 x 100ms chunks)…")
    for _ in range(15):
        ws.send_json({"video_frame": blank_b64, "audio_chunk": audio_100ms})
        r = ws.receive_json()
    _p(
        r["voice_status"] == "Normal",
        "E2E-4  Buffer accumulation → Normal speech",
        f"voice={r['voice_status']}  jitter={r['voice_jitter']}  shimmer={r['voice_shimmer']}",
    )

    print("\n  Injecting severe dysarthric audio (12 x 125ms chunks)…")
    for i, _hz in enumerate([80, 300, 90, 280, 100, 260, 110, 240, 95, 270, 85, 290]):
        _n = int(SR * 0.125)
        _amp = rng.uniform(0.05, 1.0)
        chunk = np.sin(
            2 * np.pi * _hz * np.linspace(0, 0.125, _n, dtype=np.float32)
        ) * _amp
        ws.send_json({"video_frame": blank_b64, "audio_chunk": make_wav_b64(chunk)})
        r = ws.receive_json()
    _p(
        r["voice_status"] in ("Mild Dysarthria", "Severe Slurring"),
        "E2E-5  Dysarthric detection via buffer",
        f"voice={r['voice_status']}  jitter={r['voice_jitter']}  shimmer={r['voice_shimmer']}  alert={r['alert_active']}",
    )

    N = 30
    t0 = time.perf_counter()
    for _ in range(N):
        ws.send_json({"video_frame": blank_b64, "audio_chunk": audio_100ms})
        ws.receive_json()
    elapsed = time.perf_counter() - t0
    fps = N / elapsed
    ms_avg = elapsed * 1000 / N
    verdict = "PASS" if fps >= 10 else "WARN" if fps >= 5 else "FAIL"
    _p(fps >= 10, f"E2E-6  Throughput (100ms audio)", f"{fps:.1f} req/s  ({ms_avg:.0f}ms avg)")

    N2 = 5
    t0 = time.perf_counter()
    for _ in range(N2):
        ws.send_json({"video_frame": blank_b64, "audio_chunk": audio_1500ms})
        ws.receive_json()
    elapsed2 = time.perf_counter() - t0
    fps2 = N2 / elapsed2
    ms2 = elapsed2 * 1000 / N2
    verdict2 = "PASS" if fps2 >= 5 else "FAIL"
    _p(fps2 >= 5, f"E2E-7  Throughput (1.5s audio)", f"{fps2:.1f} req/s  ({ms2:.0f}ms avg)")

print()
