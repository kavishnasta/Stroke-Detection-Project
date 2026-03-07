from __future__ import annotations

import argparse
import sys

import cv2
import numpy as np

from stroke_detection import StrokeDetectionAPI


GREEN = (0, 200, 0)
YELLOW = (0, 220, 255)
RED = (0, 0, 255)
WHITE = (255, 255, 255)
OVERLAY_BG = (30, 30, 30)

STATUS_COLORS = {
    "CALIBRATING": YELLOW,
    "MONITORING - NEUTRAL": GREEN,
    "WARNING: LOWER FACIAL DROOP DETECTED": RED,
    "WARNING: PERIPHERAL NERVE PALSY SUSPECTED": RED,
}


def draw_overlay(frame: np.ndarray, status: dict) -> np.ndarray:
    overlay = frame.copy()
    h, w = frame.shape[:2]
    pad = 10

    msg = status.get("status_message", "CALIBRATING")
    colour = STATUS_COLORS.get(msg, YELLOW)

    remaining = status.get("frames_remaining")
    no_face = status.get("no_face", False)

    panel_h = 60
    if remaining is not None:
        panel_h = 90

    lower_dev = status.get("lower_face_deviation")
    upper_dev = status.get("upper_face_deviation")
    if lower_dev is not None:
        panel_h = 130

    cv2.rectangle(overlay, (0, 0), (w, panel_h), OVERLAY_BG, -1)

    y = 35
    if no_face:
        cv2.putText(overlay, "NO FACE DETECTED", (pad, y),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, YELLOW, 2)
        y += 30

    cv2.putText(overlay, msg, (pad, y),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, colour, 2)
    y += 30

    if remaining is not None:
        cv2.putText(overlay, f"Frames remaining: {remaining}", (pad, y),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, WHITE, 1)
        y += 25

    if lower_dev is not None and upper_dev is not None:
        lower_colour = RED if lower_dev > 0.04 else GREEN
        upper_colour = RED if upper_dev > 0.04 else GREEN
        cv2.putText(overlay, f"Lower face deviation: {lower_dev * 100:.1f}%",
                    (pad, y), cv2.FONT_HERSHEY_SIMPLEX, 0.5, lower_colour, 1)
        y += 22
        cv2.putText(overlay, f"Upper face deviation: {upper_dev * 100:.1f}%",
                    (pad, y), cv2.FONT_HERSHEY_SIMPLEX, 0.5, upper_colour, 1)

    alpha = 0.65
    cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)
    return frame


def main() -> None:
    parser = argparse.ArgumentParser(description="Stroke Detection Demo")
    parser.add_argument(
        "--source", default="0",
        help="Webcam index or path to a video file",
    )
    parser.add_argument(
        "--static", action="store_true",
        help="Launch in static mode (bypass calibration, use bilateral symmetry)",
    )
    args = parser.parse_args()

    try:
        source = int(args.source)
    except ValueError:
        source = args.source

    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        print(f"[ERROR] Cannot open video source: {args.source}")
        sys.exit(1)

    api = StrokeDetectionAPI(static_mode=args.static)

    print("Press 'q' to quit.  Press 'r' to recalibrate.")

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            status = api.get_status()
            if not status.get("calibrated", False):
                status = api.calibrate(frame)
            else:
                status = api.process_frame(frame)

            frame = draw_overlay(frame, status)
            cv2.imshow("Stroke Detection Demo", frame)

            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                break
            elif key == ord("r"):
                api.reset()
                print("Recalibrating...")

    finally:
        api.close()
        cap.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
