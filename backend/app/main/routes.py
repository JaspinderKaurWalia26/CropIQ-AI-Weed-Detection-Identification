from flask import jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
import os
import uuid
from datetime import datetime

from app.main import bp
from app.models import User, ScanHistory
from app import db
from sqlalchemy import func
from app.services.weed_detector import WeedDetector
from app.services.groq_client import GroqClient
from app.services.translation_service import translate_text
import base64
import io
import numpy as np
import cv2
import time

@bp.route('/translate', methods=['POST'])
def translate():
    """
    Translate given text into the target language using Deep Translator.
    Example request JSON:
    {
      "text": "Hello, how are you?",
      "target_lang": "hi"
    }
    """
    data = request.get_json(silent=True) or {}
    text = data.get('text')
    target_lang = data.get('target_lang')

    if not text or not target_lang:
        return jsonify({"error": "Missing 'text' or 'target_lang'"}), 400

    translated_text = translate_text(text, target_lang)
    return jsonify({"translated_text": translated_text}), 200

@bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'message': 'CropIQ API is running'}), 200


@bp.route('/protected', methods=['GET'])
@jwt_required()
def protected():
    """Protected route example"""
    current_user_id = get_jwt_identity()
    user = User.query.get(int(current_user_id))
    
    return jsonify({
        'message': f'Hello {user.first_name}, this is a protected route!',
        'user_id': current_user_id
    }), 200


# Helpers
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}


def allowed_file(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def ensure_upload_dir(path: str):
    os.makedirs(path, exist_ok=True)


# ------------------------------
# Real-time detection for Web UI
# ------------------------------
_rt_detector: WeedDetector = None  # lazy init


def _get_rt_detector() -> WeedDetector:
    global _rt_detector
    if _rt_detector is None:
        _rt_detector = WeedDetector(model_path=current_app.config.get('MODEL_PATH'))
    return _rt_detector


def _decode_base64_image(data_url_or_b64: str) -> np.ndarray:
    """Accepts a pure base64 string or a data URL (data:image/..;base64,...) and returns BGR image."""
    if ',' in data_url_or_b64 and data_url_or_b64.strip().startswith('data:'):
        b64 = data_url_or_b64.split(',', 1)[1]
    else:
        b64 = data_url_or_b64
    img_bytes = base64.b64decode(b64)
    img_array = np.frombuffer(img_bytes, dtype=np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    return img


@bp.route('/realtime/detect', methods=['POST'])
@jwt_required()
def realtime_detect():
    """
    Accepts JSON { image: <base64 or data URL>, conf: optional float }
    Returns JSON { detections: [ {label, confidence, box: {x1,y1,x2,y2}} ], width, height, model_error }
    """
    data = request.get_json(silent=True) or {}
    img_b64 = data.get('image')
    conf = float(data.get('conf', 0.25))
    if not img_b64:
        return jsonify({'error': "Missing 'image' (base64)"}), 400

    detector = _get_rt_detector()
    model_error = detector.load_error() if hasattr(detector, 'load_error') else None

    img = _decode_base64_image(img_b64)
    if img is None:
        return jsonify({'error': 'Failed to decode image'}), 400

    annotated, detections = detector.detect_on_frame(img, conf_threshold=conf)
    h, w = (img.shape[0], img.shape[1]) if img is not None else (None, None)

    # Convert boxes to dict for JSON friendliness
    out_dets = []
    for d in detections:
        x1, y1, x2, y2 = d.get('box', (0, 0, 0, 0))
        out_dets.append({
            'label': d.get('label'),
            'confidence': d.get('confidence'),
            'box': {'x1': int(x1), 'y1': int(y1), 'x2': int(x2), 'y2': int(y2)}
        })

    return jsonify({
        'detections': out_dets,
        'width': w,
        'height': h,
        'model_error': model_error,
    }), 200


# Simple in-memory TTL cache for recommendations
_recs_cache: dict = {}
_recs_ttl: int = 120  # seconds


def _get_recommendation_cached(groq: GroqClient, weed: str) -> str:
    now = time.time()
    ent = _recs_cache.get(weed)
    if ent and ent['exp'] > now:
        return ent['text']
    text, err = groq.get_recommendations(weed)
    val = text if text and not err else f"Recommendation unavailable: {err or 'Unknown error'}"
    _recs_cache[weed] = {'text': val, 'exp': now + _recs_ttl}
    return val


@bp.route('/realtime/recommend', methods=['POST'])
@jwt_required()
def realtime_recommend():
    """
    Accepts JSON { weeds: ["Parthenium", "Pigweed", ...] }
    Returns JSON { recommendations: { weedName: text } }
    """
    data = request.get_json(silent=True) or {}
    weeds = data.get('weeds') or []
    if not isinstance(weeds, list):
        return jsonify({'error': "'weeds' must be a list of strings"}), 400

    groq = GroqClient(
        api_key=current_app.config.get('GROQ_API_KEY'),
        model=current_app.config.get('GROQ_MODEL'),
        base_url=current_app.config.get('GROQ_API_BASE'),
    )

    out = {}
    for wname in weeds:
        if not isinstance(wname, str) or not wname.strip():
            continue
        out[wname] = _get_recommendation_cached(groq, wname.strip())

    return jsonify({'recommendations': out}), 200


@bp.route('/scan/upload', methods=['POST'])
@jwt_required()
def upload_and_scan():
    """
    Upload a crop image, run weed detection, call Grok for organic removal methods,
    persist results in ScanHistory, and return the outcome.
    Accepts multipart/form-data with field name 'image'.
    """
    current_user_id = get_jwt_identity()
    user: User = User.query.get(int(current_user_id))
    if not user:
        return jsonify({'error': 'User not found'}), 404

    if 'image' not in request.files:
        return jsonify({'error': 'No image file part in request'}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'Unsupported file type'}), 400

    upload_root = current_app.config.get('UPLOAD_FOLDER')
    if not upload_root:
        return jsonify({'error': 'UPLOAD_FOLDER not configured'}), 500

    # Save file under user-specific folder
    user_folder = os.path.join(upload_root, f'user_{user.id}')
    ensure_upload_dir(user_folder)
    ext = file.filename.rsplit('.', 1)[1].lower()
    filename = secure_filename(f"{uuid.uuid4().hex}.{ext}")
    file_path = os.path.join(user_folder, filename)
    file.save(file_path)

    # Run detection via service
    detector = WeedDetector(model_path=current_app.config.get('MODEL_PATH'))
    weed_name, confidence = detector.detect(file_path)
    model_error = getattr(detector, 'load_error', lambda: None)()  # expose any model load error

    # Call Groq only if a weed was detected
    groq_text = None
    groq_error = None
    if weed_name:
        groq = GroqClient(
            api_key=current_app.config.get('GROQ_API_KEY'),
            model=current_app.config.get('GROQ_MODEL'),
            base_url=current_app.config.get('GROQ_API_BASE'),
        )
        groq_text, groq_error = groq.get_recommendations(weed_name)

    # Update user scan count (per-user, robust against prior inconsistencies)
    try:
        last_count = (
            db.session.query(func.max(ScanHistory.scan_count_at_scan))
            .filter(ScanHistory.user_id == user.id)
            .scalar()
        ) or 0
    except Exception:
        last_count = user.scan_count or 0

    next_count = max((user.scan_count or 0) + 1, (last_count or 0) + 1)
    user.scan_count = next_count

    # Persist history
    history = ScanHistory(
        user_id=user.id,
        image_path=file_path,
        weed_name=weed_name,
        recommendations=groq_text,
        detected_at=datetime.utcnow(),
        scan_count_at_scan=next_count,
    )

    try:
        db.session.add(history)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'Failed to save scan history'}), 500

    return jsonify({
        'message': 'Scan processed',
        'data': {
            'weed_name': weed_name,
            'confidence': confidence,
            'recommendations': groq_text,
            'groq_error': groq_error,
            'scan_count': user.scan_count,
            'history_id': history.id,
            # diagnostics to aid debugging in development
            'model_error': model_error,
            'conf_threshold': os.getenv('WEED_CONF', '0.25'),
        }
    }), 200


@bp.route('/scan/history', methods=['GET'])
@jwt_required()
def get_history():
    """Return paginated scan history for the current user, only detected items."""
    current_user_id = int(get_jwt_identity())
    user: User = User.query.get(current_user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 10))

    pagination = (
        ScanHistory.query
        .filter(
            ScanHistory.user_id == current_user_id,
            ScanHistory.weed_name.isnot(None),
            ScanHistory.weed_name != '',
            ~ScanHistory.weed_name.in_(['Unknown', 'unknown', 'UNKNOWN'])
        )
        .order_by(ScanHistory.detected_at.desc())
        .paginate(page=page, per_page=per_page, error_out=False)
    )

    items = [h.to_dict() for h in pagination.items]
    return jsonify({
        'items': items,
        'page': pagination.page,
        'per_page': pagination.per_page,
        'total': pagination.total,
        'pages': pagination.pages,
    }), 200


@bp.route('/scan/stats', methods=['GET'])
@jwt_required()
def scan_stats():
    """Return total scans and detected scans for the current user."""
    current_user_id = int(get_jwt_identity())
    user: User = User.query.get(current_user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    total_scans = (
        db.session.query(ScanHistory.id)
        .filter(ScanHistory.user_id == current_user_id)
        .count()
    )

    detected_scans = (
        db.session.query(ScanHistory.id)
        .filter(
            ScanHistory.user_id == current_user_id,
            ScanHistory.weed_name.isnot(None),
            ScanHistory.weed_name != '',
            ~ScanHistory.weed_name.in_(['Unknown', 'unknown', 'UNKNOWN'])
        )
        .count()
    )

    return jsonify({
        'total_scans': total_scans,
        'detected_scans': detected_scans,
        'user_id': current_user_id,
    }), 200


@bp.route('/chat', methods=['POST'])
@jwt_required()
def chat_with_assistant():
    """Simple chat endpoint that forwards a user message (and optional history) to Groq.

    Expected JSON body:
      {
        "message": "...",                  # required
        "history": [                       # optional, prior turns
          {"role": "user", "content": "..."},
          {"role": "assistant", "content": "..."}
        ]
      }
    Returns 200 with { reply, error }.
    """
    current_user_id = get_jwt_identity()
    user = User.query.get(int(current_user_id))
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json(silent=True) or {}
    message = data.get('message')
    history = data.get('history') or []

    if not message or not isinstance(message, str):
        return jsonify({'error': 'Missing or invalid message'}), 400

    groq = GroqClient(
        api_key=current_app.config.get('GROQ_API_KEY'),
        model=current_app.config.get('GROQ_MODEL'),
        base_url=current_app.config.get('GROQ_API_BASE'),
    )

    system_prompt = (
        "You are CropIQ, a helpful, friendly, and practical agricultural assistant for farmers. "
        "Answer questions clearly with actionable steps for Indian farmer contexts when relevant—"
        "soil preparation, irrigation, crop rotation, pest and weed management, fertilizer guidance, "
        "and safety. Keep answers concise but thorough."
    )

    reply, error = groq.chat(
        user_message=message,
        history=history,
        system_prompt=system_prompt,
        temperature=0.4,
    )

    # Always return 200 with structured response; the frontend can surface error text if any
    return jsonify({
        'reply': reply,
        'error': error,
    }), 200


@bp.route('/scan/save', methods=['POST'])
@jwt_required()
def save_scan_result():
    """
    Persist a scan result provided by the client (e.g., from realtime detect or live capture).
    Accepts JSON with fields:
      - image: base64 data URL (optional). If provided, saved to UPLOAD_FOLDER like /scan/upload
      - weed_name: string (optional)
      - recommendations: string (optional)
      - confidence: float (optional)
    Returns { history_id, scan_count }
    """
    current_user_id = int(get_jwt_identity())
    user: User = User.query.get(current_user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json(silent=True) or {}
    image_data = data.get('image')  # data URL or base64
    weed_name = data.get('weed_name')
    recommendations = data.get('recommendations')
    confidence = data.get('confidence')

    upload_root = current_app.config.get('UPLOAD_FOLDER')
    if not upload_root:
        return jsonify({'error': 'UPLOAD_FOLDER not configured'}), 500

    # Save image if provided
    image_path = None
    if image_data:
        try:
            # decode regardless of data URL prefix
            if ',' in image_data and image_data.strip().startswith('data:'):
                b64 = image_data.split(',', 1)[1]
            else:
                b64 = image_data
            img_bytes = base64.b64decode(b64)
            img_array = np.frombuffer(img_bytes, dtype=np.uint8)
            img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
            if img is None:
                return jsonify({'error': 'Failed to decode image'}), 400

            user_folder = os.path.join(upload_root, f'user_{user.id}')
            ensure_upload_dir(user_folder)
            filename = secure_filename(f"{uuid.uuid4().hex}.jpg")
            image_path = os.path.join(user_folder, filename)
            cv2.imwrite(image_path, img)
        except Exception as e:
            return jsonify({'error': f'Failed to save image: {str(e)}'}), 500

    # Update user scan count similar to /scan/upload
    try:
        last_count = (
            db.session.query(func.max(ScanHistory.scan_count_at_scan))
            .filter(ScanHistory.user_id == user.id)
            .scalar()
        ) or 0
    except Exception:
        last_count = user.scan_count or 0

    next_count = max((user.scan_count or 0) + 1, (last_count or 0) + 1)
    user.scan_count = next_count

    history = ScanHistory(
        user_id=user.id,
        image_path=image_path,
        weed_name=weed_name,
        recommendations=recommendations,
        detected_at=datetime.utcnow(),
        scan_count_at_scan=next_count,
    )

    try:
        db.session.add(history)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'Failed to save scan history'}), 500

    return jsonify({
        'message': 'Scan saved',
        'history_id': history.id,
        'scan_count': user.scan_count,
    }), 200