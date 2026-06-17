import os
import cv2
import numpy as np
from typing import Optional, Tuple, Union, List, Dict, Any


class WeedDetector:
    """
    Abstraction over the trained weed detection model.

    Integration supported:
      - Ultralytics YOLO (.pt/.pth) object detection models.

    Environment variables used:
      - MODEL_PATH: path to the trained model file (e.g., C:\\...\\best.pt)

    Expected return: (weed_name, confidence)
      - weed_name: str or None if no weed detected
      - confidence: float in [0,1] or None if not available
    """

    def __init__(self, model_path: Optional[str] = None):
        # Accept explicit argument or env var
        self.model_path = model_path or os.getenv('MODEL_PATH')
        # If a relative path is provided (e.g., 'backend/best.pt'), resolve it
        if self.model_path and not os.path.isabs(self.model_path):
            # backend/app/services -> go two levels up to reach backend/
            backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
            self.model_path = os.path.abspath(os.path.join(backend_root, self.model_path))
        self._model = None
        self._engine = None  # 'yolo'
        self._labels = None
        self._load_error: Optional[str] = None

        if not self.model_path:
            self._load_error = 'MODEL_PATH is not set'
            return

        # Quick existence check for clearer error messages
        if not os.path.exists(self.model_path):
            self._load_error = f"Model file not found at '{self.model_path}'"
            return

        ext = os.path.splitext(self.model_path)[1].lower()
        try:
            if ext in {'.pt', '.pth'}:
                # Try Ultralytics YOLO
                try:
                    from ultralytics import YOLO  # type: ignore
                except Exception as e:
                    self._load_error = (
                        'Ultralytics is required for YOLO models (.pt/.pth). '
                        'Install with: pip install ultralytics. '
                        f'Import error: {e}'
                    )
                    return
                self._model = YOLO(self.model_path)
                # Class names dict: {class_id: name}
                self._labels = getattr(self._model, 'names', None)
                self._engine = 'yolo'
            else:
                self._load_error = f'Unsupported model extension: {ext}'
        except Exception as e:
            self._load_error = f'Failed to load model: {e}'

    def load_error(self) -> Optional[str]:
        return self._load_error

    def detect_with_boxes(self, image_path: str, output_path: Optional[str] = None, 
                         conf_threshold: float = 0.25) -> Tuple[Optional[np.ndarray], List[Dict[str, Any]]]:
        """
        Detect weeds in the image and draw bounding boxes around them.
        
        Args:
            image_path: Path to the input image
            output_path: If provided, save the result to this path
            conf_threshold: Minimum confidence threshold for detection
            
        Returns:
            Tuple containing:
                - Image with bounding boxes drawn (numpy array) or None if error
                - List of detections, each with 'label', 'confidence', and 'box' (x1, y1, x2, y2)
        """
        if not os.path.exists(image_path):
            return None, []
            
        if self._load_error is not None or self._model is None:
            return None, []
            
        try:
            # Read the image
            image = cv2.imread(image_path)
            if image is None:
                return None, []
                
            # Run detection
            if self._engine == 'yolo':
                device = os.getenv('WEED_DEVICE')
                results = self._model.predict(
                    source=image,
                    conf=conf_threshold,
                    device=device,
                    verbose=False
                )
                
                if not results:
                    return image, []
                    
                result = results[0]
                boxes = getattr(result, 'boxes', None)
                
                if boxes is None or len(boxes) == 0:
                    return image, []
                
                # Process detections
                detections = []
                for box in boxes:
                    try:
                        # Get box coordinates (x1, y1, x2, y2)
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
                        conf = float(box.conf[0].cpu().numpy())
                        cls_id = int(box.cls[0].cpu().numpy())
                        
                        # Get label name if available
                        label = self._labels.get(cls_id, f'weed_{cls_id}') if self._labels else f'weed_{cls_id}'
                        
                        # Add to detections
                        detections.append({
                            'label': label,
                            'confidence': conf,
                            'box': (x1, y1, x2, y2)
                        })
                        
                        # Draw bounding box
                        color = (0, 255, 0)  # Green color for boxes
                        cv2.rectangle(image, (x1, y1), (x2, y2), color, 2)
                        
                        # Draw label background
                        label_text = f"{label} {conf:.2f}"
                        (w, h), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 1)
                        cv2.rectangle(image, (x1, y1 - 20), (x1 + w, y1), color, -1)
                        cv2.putText(image, label_text, (x1, y1 - 5), 
                                  cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1)
                        
                    except Exception as e:
                        print(f"Error processing detection: {e}")
                        continue
                
                # Save result if output path is provided
                if output_path and detections:
                    os.makedirs(os.path.dirname(output_path), exist_ok=True)
                    cv2.imwrite(output_path, image)
                    
                return image, detections
                
        except Exception as e:
            print(f"Error in detect_with_boxes: {e}")
            
        return None, []

    def detect(self, image_path: str) -> Tuple[Optional[str], Optional[float]]:
        """
        Run detection on the given image path and return (weed_name, confidence).
        This is kept for backward compatibility.
        """
        if not os.path.exists(image_path):
            return None, None

        if self._load_error is not None or self._model is None:
            # Model not loaded; return gracefully so API still works
            return None, None

        try:
            if self._engine == 'yolo':
                # Run prediction; conf threshold can be tuned via env WEED_CONF
                conf_thr = float(os.getenv('WEED_CONF', '0.25'))
                device = os.getenv('WEED_DEVICE')  # e.g., 'cpu' or '0'
                predict_kwargs = dict(source=image_path, conf=conf_thr, verbose=False)
                if device:
                    predict_kwargs['device'] = device
                results = self._model.predict(**predict_kwargs)
                if not results:
                    return None, None
                result = results[0]
                # result.boxes has xyxy, confidence, and class indexes (detection models)
                boxes = getattr(result, 'boxes', None)
                if boxes is None or len(boxes) == 0:
                    # Fallback: classification models expose result.probs
                    probs = getattr(result, 'probs', None)
                    if probs is not None:
                        try:
                            top1 = int(getattr(probs, 'top1', None))
                            top1conf = float(getattr(probs, 'top1conf', None))
                        except Exception:
                            top1 = None
                            top1conf = None
                        names = getattr(result, 'names', None) or self._labels or {}
                        if top1 is not None and top1conf is not None:
                            weed_name = names.get(top1, str(top1)) if isinstance(names, dict) else str(top1)
                            return weed_name, top1conf
                    return None, None
                # Select the highest confidence detection
                max_idx = None
                max_conf = -1.0
                # Prefer names from result, fallback to model-level labels
                names = getattr(result, 'names', None) or self._labels or {}
                for i in range(len(boxes)):
                    # boxes.conf is a tensor; detach to float
                    try:
                        conf = float(boxes.conf[i].item())
                    except Exception:
                        conf = float(boxes.conf[i]) if hasattr(boxes.conf, '__getitem__') else 0.0
                    if conf > max_conf:
                        max_conf = conf
                        try:
                            cls_id = int(boxes.cls[i].item())
                        except Exception:
                            cls_id = int(boxes.cls[i]) if hasattr(boxes.cls, '__getitem__') else -1
                        max_idx = cls_id

                if max_idx is None or max_conf < 0:
                    return None, None

                weed_name = names.get(max_idx, str(max_idx)) if isinstance(names, dict) else str(max_idx)
                return weed_name, max_conf

            # Unknown engine
            return None, None
        except Exception:
            # If inference fails for any reason, return no detection rather than crashing API
            return None, None

    def detect_on_frame(self, frame: np.ndarray, conf_threshold: float = 0.25) -> Tuple[Optional[np.ndarray], List[Dict[str, Any]]]:
        """
        Detect weeds directly on an in-memory frame (numpy array) and draw bounding boxes.
        Returns (annotated_frame, detections) where detections is a list of dicts with
        'label', 'confidence', and 'box' (x1, y1, x2, y2).
        """
        if frame is None or not isinstance(frame, np.ndarray):
            return None, []

        if self._load_error is not None or self._model is None:
            return None, []

        try:
            if self._engine == 'yolo':
                device = os.getenv('WEED_DEVICE')
                results = self._model.predict(
                    source=frame,
                    conf=conf_threshold,
                    device=device if device else None,
                    verbose=False
                )

                if not results:
                    return frame, []

                result = results[0]
                boxes = getattr(result, 'boxes', None)
                if boxes is None or len(boxes) == 0:
                    return frame, []

                detections: List[Dict[str, Any]] = []
                image = frame.copy()
                for box in boxes:
                    try:
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
                        conf = float(box.conf[0].cpu().numpy())
                        cls_id = int(box.cls[0].cpu().numpy())

                        label = self._labels.get(cls_id, f'weed_{cls_id}') if self._labels else f'weed_{cls_id}'

                        detections.append({
                            'label': label,
                            'confidence': conf,
                            'box': (int(x1), int(y1), int(x2), int(y2))
                        })

                        color = (0, 255, 0)
                        cv2.rectangle(image, (int(x1), int(y1)), (int(x2), int(y2)), color, 2)

                        label_text = f"{label} {conf:.2f}"
                        (w, h), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 1)
                        y_text = max(int(y1) - 5, 20)
                        cv2.rectangle(image, (int(x1), y_text - 15), (int(x1) + w, y_text + 2), color, -1)
                        cv2.putText(image, label_text, (int(x1), y_text), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1)
                    except Exception as e:
                        print(f"Error processing detection (frame): {e}")
                        continue

                return image, detections
        except Exception as e:
            print(f"Error in detect_on_frame: {e}")

        return None, []
