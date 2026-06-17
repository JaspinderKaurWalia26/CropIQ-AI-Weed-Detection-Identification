import os
import time
import cv2
import numpy as np
from typing import Dict, List, Optional, Set, Tuple

from app.services.weed_detector import WeedDetector
from app.services.groq_client import GroqClient


# ------------------------------
# Configuration (via env with sane defaults)
# ------------------------------
CAM_INDEX = int(os.getenv("CAM_INDEX", "0"))
FRAME_SKIP = int(os.getenv("FRAME_SKIP", "2"))  # process every Nth frame
CONF_THRESHOLD = float(os.getenv("WEED_CONF", "0.25"))
PANEL_WIDTH = int(os.getenv("PANEL_WIDTH", "420"))
RECS_TTL_SECONDS = int(os.getenv("RECS_TTL_SECONDS", "120"))  # cache TTL for recs
WINDOW_NAME = os.getenv("WINDOW_NAME", "CropIQ - Real-time Weed Detection")


# ------------------------------
# Types
# ------------------------------
Detection = Dict[str, object]  # keys: label(str), confidence(float), box(tuple)


# ------------------------------
# Recommendation cache with TTL
# ------------------------------
class RecommendationCache:
    def __init__(self, ttl_seconds: int = 120):
        self.ttl = ttl_seconds
        self._data: Dict[str, Tuple[str, float]] = {}
        # maps weed_name -> (recommendation_text, expiry_timestamp)

    def get(self, key: str) -> Optional[str]:
        item = self._data.get(key)
        if not item:
            return None
        value, exp = item
        if time.time() > exp:
            self._data.pop(key, None)
            return None
        return value

    def set(self, key: str, value: str):
        self._data[key] = (value, time.time() + self.ttl)


# ------------------------------
# Core helpers
# ------------------------------

def detect_weeds(frame, detector: WeedDetector, conf_threshold: float) -> Tuple[Optional[object], List[Detection]]:
    """
    Run detection on a frame and return annotated image and detections list.
    The WeedDetector already draws boxes; we return that annotated frame here for simplicity.
    """
    return detector.detect_on_frame(frame, conf_threshold=conf_threshold)


def draw_bounding_boxes(frame, detections: List[Detection]):
    """
    Draw bounding boxes and labels on a copy of the frame based on provided detections.
    """
    if frame is None:
        return None
    img = frame.copy()
    for det in detections:
        box = det.get('box')
        label = str(det.get('label') or '')
        conf = float(det.get('confidence') or 0.0)
        if not box:
            continue
        x1, y1, x2, y2 = [int(v) for v in box]
        color = (0, 255, 0)
        cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)
        label_text = f"{label} {conf:.2f}"
        (w, _), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 1)
        y_text = max(y1 - 5, 20)
        cv2.rectangle(img, (x1, y_text - 15), (x1 + w, y_text + 2), color, -1)
        cv2.putText(img, label_text, (x1, y_text), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1)
    return img


def store_weed_names(detections: List[Detection], unique_weeds: Set[str]) -> Set[str]:
    """
    Update and return the set of unique weed names from detections.
    """
    for det in detections:
        label = str(det.get('label') or '').strip()
        if label:
            unique_weeds.add(label)
    return unique_weeds


def get_recommendations(unique_weeds: Set[str], groq: GroqClient, cache: RecommendationCache) -> Dict[str, str]:
    """
    For each unique weed, obtain recommendations using Groq with simple TTL cache.
    """
    results: Dict[str, str] = {}
    for weed in sorted(unique_weeds):
        cached = cache.get(weed)
        if cached:
            results[weed] = cached
            continue
        text, err = groq.get_recommendations(weed)
        if text and not err:
            cache.set(weed, text)
            results[weed] = text
        else:
            results[weed] = f"Recommendation unavailable: {err or 'Unknown error'}"
    return results


def render_side_panel(panel_width: int, frame_height: int, recs: Dict[str, str]) -> object:
    """
    Create a right-side panel image containing recommendations text.
    """
    panel_img = 255 * np.ones((frame_height, panel_width, 3), dtype=np.uint8)

    # Title
    y = 30
    cv2.putText(panel_img, 'Recommendations', (10, y), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 100, 0), 2)
    y += 15
    cv2.line(panel_img, (10, y), (panel_width - 10, y), (0, 150, 0), 1)
    y += 15

    # Content per weed, wrap text
    max_width = panel_width - 20
    for weed, text in recs.items():
        # Weed header
        cv2.putText(panel_img, f"- {weed}", (10, y), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (20, 20, 20), 2)
        y += 22
        # Wrap recommendation text
        wrapped_lines = wrap_text(text, max_chars=44)
        for line in wrapped_lines:
            if y > frame_height - 10:
                break
            cv2.putText(panel_img, line, (14, y), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (40, 40, 40), 1)
            y += 18
        y += 8
        if y > frame_height - 10:
            break

    return panel_img


def wrap_text(text: str, max_chars: int = 44) -> List[str]:
    words = text.split()
    lines: List[str] = []
    cur: List[str] = []
    for w in words:
        if sum(len(x) for x in cur) + len(cur) + len(w) > max_chars:
            if cur:
                lines.append(' '.join(cur))
            cur = [w]
        else:
            cur.append(w)
    if cur:
        lines.append(' '.join(cur))
    return lines


# ------------------------------
# Camera loop
# ------------------------------

def start_camera_feed():
    # Initialize model
    detector = WeedDetector(model_path=os.getenv('MODEL_PATH'))
    if detector.load_error():
        print(f"Model load error: {detector.load_error()}")

    # Initialize Groq client (reuse env-configured values)
    groq = GroqClient(
        api_key=os.getenv('GROQ_API_KEY'),
        model=os.getenv('GROQ_MODEL'),
        base_url=os.getenv('GROQ_API_BASE'),
    )
    cache = RecommendationCache(ttl_seconds=RECS_TTL_SECONDS)

    # Open camera with robust backend/index selection (Windows-friendly)
    def open_camera_prefer_windows(idx: int) -> Optional[cv2.VideoCapture]:
        backends = []
        # Try DirectShow and Media Foundation if available
        if hasattr(cv2, 'CAP_DSHOW'):
            backends.append(cv2.CAP_DSHOW)
        if hasattr(cv2, 'CAP_MSMF'):
            backends.append(cv2.CAP_MSMF)
        backends.append(0)  # default

        for be in backends:
            try:
                cap_try = cv2.VideoCapture(idx, be) if be != 0 else cv2.VideoCapture(idx)
                if cap_try is not None and cap_try.isOpened():
                    return cap_try
                if cap_try is not None:
                    cap_try.release()
            except Exception as e:
                print(f"Camera open attempt failed for index={idx}, backend={be}: {e}")
        return None

    # Try given index, else fall back to 1 and 2
    try_indices = [CAM_INDEX, 1, 2]
    cap = None
    for idx in try_indices:
        cap = open_camera_prefer_windows(idx)
        if cap is not None:
            print(f"Camera opened on index {idx}")
            break
        else:
            print(f"Could not open camera at index {idx}")
    if cap is None:
        print("Failed to open any camera. Ensure permissions are granted and no other app is using the camera.")
        return

    # Attempt to set a reasonable resolution
    try:
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, float(os.getenv('CAM_WIDTH', '1280')))
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, float(os.getenv('CAM_HEIGHT', '720')))
    except Exception:
        pass

    unique_weeds: Set[str] = set()
    frame_idx = 0

    try:
        while True:
            ok, frame = cap.read()
            if not ok or frame is None:
                print("Failed to read frame from camera. If this persists, close other apps using the camera and try a different CAM_INDEX.")
                # small delay to avoid busy loop
                if cv2.waitKey(10) & 0xFF == ord('q'):
                    break
                continue

            frame_idx += 1
            run_infer = (frame_idx % FRAME_SKIP == 0)

            annotated = frame
            detections: List[Detection] = []
            if run_infer:
                annotated, detections = detect_weeds(frame, detector, CONF_THRESHOLD)
                annotated = annotated if annotated is not None else frame

                # Update unique weeds set
                unique_weeds = store_weed_names(detections, unique_weeds)

            # Build side panel recommendations (throttled by cache TTL)
            recs = {}
            if unique_weeds:
                recs = get_recommendations(unique_weeds, groq, cache)

            # Compose final view: annotated frame + side panel
            h, w = annotated.shape[:2]
            panel_img = render_side_panel(PANEL_WIDTH, h, recs) if recs else 255 * np.ones((h, PANEL_WIDTH, 3), dtype=np.uint8)
            view = cv2.hconcat([annotated, panel_img]) if panel_img is not None else annotated

            # Status footer
            status_text = f"Weeds: {', '.join(sorted(unique_weeds)) if unique_weeds else 'None'} | Press 'q' to quit"
            cv2.rectangle(view, (0, h - 28), (view.shape[1], h), (255, 255, 255), -1)
            cv2.putText(view, status_text, (10, h - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1)

            cv2.imshow(WINDOW_NAME, view)
            # Exit on 'q'
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

    finally:
        cap.release()
        cv2.destroyAllWindows()


# ------------------------------
# Main entry
# ------------------------------

def main():
    start_camera_feed()


if __name__ == "__main__":
    main()
