from __future__ import annotations

import asyncio
import base64
import io
import sys
import wave
from collections import deque
from pathlib import Path
from typing import Any, Dict

import cv2
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

_BACKEND_DIR = Path(__file__).parent
_PROJECT_ROOT = _BACKEND_DIR.parent
sys.path.insert(0, str(_PROJECT_ROOT))
sys.path.insert(0, str(_BACKEND_DIR))

from stroke_detection.stroke_detector import StrokeDetectionAPI
from voice_detector import process_audio_chunk

app = FastAPI(title="Stroke Detection Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_SAMPLE_RATE = 16000
_BUFFER_SECONDS = 6.0   # 6-second rolling window — clinical minimum is 3s for jitter/shimmer
_BUFFER_SAMPLES = int(_SAMPLE_RATE * _BUFFER_SECONDS)

_face_detector = StrokeDetectionAPI(static_mode=True)


def _decode_frame(b64_jpeg: str):
    try:
        img_bytes = base64.b64decode(b64_jpeg)
        arr = np.frombuffer(img_bytes, dtype=np.uint8)
        return cv2.imdecode(arr, cv2.IMREAD_COLOR)
    except Exception:
        return None


def _decode_audio_chunk(b64_audio: str):
    try:
        raw = base64.b64decode(b64_audio)
        if raw[:4] == b"RIFF":
            with wave.open(io.BytesIO(raw)) as wf:
                frames = wf.readframes(wf.getnframes())
                sampwidth = wf.getsampwidth()
                n_channels = wf.getnchannels()
            dtype = np.int16 if sampwidth == 2 else np.int8
            data = np.frombuffer(frames, dtype=dtype).astype(np.float32)
            data /= np.iinfo(dtype).max
            if n_channels > 1:
                data = data.reshape(-1, n_channels).mean(axis=1)
            return data
        pcm = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
        return pcm
    except Exception:
        return None


def _run_face(b64_jpeg: str) -> Dict[str, Any]:
    if not b64_jpeg:
        return {
            "face_status": "No Frame",
            "face_ratios": {"lower": 1.0, "upper": 1.0},
            "alert_face": False,
        }

    frame = _decode_frame(b64_jpeg)
    if frame is None:
        return {
            "face_status": "Decode Error",
            "face_ratios": {"lower": 1.0, "upper": 1.0},
            "alert_face": False,
        }

    r = _face_detector.process_frame(frame)

    if r.get("no_face", False):
        return {
            "face_status": "No Face Detected",
            "face_ratios": {"lower": 1.0, "upper": 1.0},
            "alert_face": False,
        }

    return {
        "face_status": r.get("status_message", "MONITORING"),
        "face_ratios": {
            "lower": round(float(r.get("smoothed_lower_ratio", 1.0)), 3),
            "upper": round(float(r.get("smoothed_upper_ratio", 1.0)), 3),
        },
        "alert_face": bool(r.get("alert", False)),
    }


def _run_voice(pcm_chunk: np.ndarray, audio_buf: deque) -> Dict[str, Any]:
    audio_buf.extend(pcm_chunk.tolist())

    accumulated = np.array(list(audio_buf), dtype=np.float32)
    buf = io.BytesIO()
    pcm16 = (accumulated * 32767).astype(np.int16)
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(_SAMPLE_RATE)
        wf.writeframes(pcm16.tobytes())
    b64 = base64.b64encode(buf.getvalue()).decode()

    r = process_audio_chunk(b64)
    return {
        "voice_status": r["status"],
        "voice_confidence": r["confidence"],
        "voice_jitter": r["jitter"],
        "voice_shimmer": r["shimmer"],
    }


@app.websocket("/stream")
async def stream_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()

    audio_buf: deque = deque(maxlen=_BUFFER_SAMPLES)
    last_voice: Dict[str, Any] = {
        "voice_status": "Insufficient Data",
        "voice_confidence": 0.0,
        "voice_jitter": 0.0,
        "voice_shimmer": 0.0,
    }

    try:
        while True:
            payload = await websocket.receive_json()
            b64_frame = payload.get("video_frame", "")
            b64_audio = payload.get("audio_chunk", "")

            pcm_chunk = _decode_audio_chunk(b64_audio) if b64_audio else None

            if pcm_chunk is not None and len(pcm_chunk) > 0:
                face_data, voice_data = await asyncio.gather(
                    asyncio.to_thread(_run_face, b64_frame),
                    asyncio.to_thread(_run_voice, pcm_chunk, audio_buf),
                )
                last_voice = voice_data
            else:
                face_data = await asyncio.to_thread(_run_face, b64_frame)
                voice_data = last_voice

            # ── 3-level alert logic (based on FAST clinical protocol) ──────────
            # Level 0: Normal
            # Level 1: Warning  — face OR voice abnormal (high sensitivity, OR logic)
            # Level 2: Alert    — face AND voice both abnormal (high specificity, AND logic)
            # Level 3: Emergency— both abnormal with high confidence
            face_alert   = face_data["alert_face"]
            voice_status = voice_data["voice_status"]
            voice_conf   = voice_data["voice_confidence"]

            voice_mild   = voice_status == "Mild Dysarthria"   and voice_conf >= 0.65
            voice_severe = voice_status == "Severe Dysarthria" and voice_conf >= 0.70

            if face_alert and voice_severe:
                alert_level = 3
            elif face_alert and (voice_mild or voice_severe):
                alert_level = 2
            elif face_alert or voice_severe:
                alert_level = 1
            else:
                alert_level = 0

            alert_active = alert_level >= 2  # Only escalate UI on confirmed AND-logic

            await websocket.send_json({
                **face_data,
                **voice_data,
                "alert_active": alert_active,
                "alert_level": alert_level,
            })

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        try:
            await websocket.close(code=1011, reason=str(exc))
        except Exception:
            pass


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)
