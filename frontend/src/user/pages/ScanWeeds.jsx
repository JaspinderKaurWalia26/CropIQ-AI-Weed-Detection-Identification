// ScanWeeds.jsx
import React, { useState, useRef, useEffect, useContext } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useNavigate } from "react-router-dom";
import Layout from "../components/dashboard/Layout";
import "../styles/ScanWeeds.css";
import "../styles/Markdown.css";
import { LanguageContext } from "../../context/LanguageContext";

function ScanWeeds() {
  const { language, translate } = useContext(LanguageContext);
  const translationsCache = useRef({});
  const [translating, setTranslating] = useState(false); // ADD THIS LINE
  const [translatedRecs, setTranslatedRecs] = useState({});

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const videoRef = useRef(null);
  const liveCanvasRef = useRef(null); // deprecated; kept hidden
  const overlayRef = useRef(null);
  const sendCanvasRef = useRef(null);
  const detectTimerRef = useRef(null);
  const rafRef = useRef(null);
  const resizeObsRef = useRef(null);
  const detectActiveRef = useRef(false);
  const detectBusyRef = useRef(false);
  const weedCountsRef = useRef({});
  const lastTopRef = useRef(null);
  const scanBoxRef = useRef(null);
  const navigate = useNavigate();

  const [weedCounts, setWeedCounts] = useState({});
  const [showRecs, setShowRecs] = useState(false);
  const [recs, setRecs] = useState({});

  // Original texts
  const originalTexts = {
    title: "🌿 Weed Detection Scanner",
    description: "Capture clear images of weeds in your field for instant analysis and identification.",
    cameraStarting: "Starting camera...",
    openCamera: "📷 Open Camera",
    capturePhoto: "📸 Capture Photo",
    retakePhoto: "🔄 Retake Photo",
    dashboard: "🏠 Dashboard",
    photoCaptured: "✅ Photo captured! Ready for analysis",
    cameraActive: "📷 Camera active - Point at weed and capture",
    readyToScan: "Ready to scan - Click 'Open Camera' to begin",
    analysisNote: "Image captured successfully! Analysis would identify weed type and suggest treatment methods."
  };

  const saveScanHistory = async ({ image, weedName, recommendations, confidence }) => {
    try {
      const token = getToken();
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/scan/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ image, weed_name: weedName, recommendations, confidence }),
      });
      await res.json().catch(() => ({}));
    } catch (_) {}
  };

  // Translated texts state
  const [translatedTexts, setTranslatedTexts] = useState({ ...originalTexts });

  // Cached translation helper
  const translateCached = async (text) => {
    if (!text) return "";
    if (language === "en") return text;
    const cacheKey = `${text}_${language}`;
    if (translationsCache.current[cacheKey]) return translationsCache.current[cacheKey];
    const translated = await translate(text);
    translationsCache.current[cacheKey] = translated;
    return translated;
  };

  // Translate all UI texts when language changes
  useEffect(() => {
    const translateAll = async () => {
      setTranslating(true); // ADD THIS LINE
      
      try {
        const keys = Object.keys(originalTexts);
        const results = await Promise.all(keys.map(k => translateCached(originalTexts[k])));
        const updated = {};
        keys.forEach((key, i) => updated[key] = results[i]);
        setTranslatedTexts(updated);
      } catch (err) {
        console.error("Translation error:", err);
      } finally {
        setTranslating(false); // ADD THIS LINE
      }
    };
    translateAll();
  }, [language]);

  useEffect(() => {
  const translateRecommendations = async () => {
    const entries = Object.entries(recs);
    const results = await Promise.all(
      entries.map(async ([weed, text]) => {
        const translatedText = await translateCached(text);
        return [weed, translatedText];
      })
    );
    setTranslatedRecs(Object.fromEntries(results));
  };

  if (Object.keys(recs).length > 0) {
    translateRecommendations();
  } else {
    setTranslatedRecs({});
  }
}, [recs, language]);


  // Open camera
  const openCamera = async () => {
    try {
      setIsLoading(true);
      // Ensure the <video> and canvases are rendered before attaching the stream
      setIsCameraOpen(true);
      // reset session aggregates
      weedCountsRef.current = {};
      setWeedCounts({});
      setShowRecs(false);
      setRecs({});
      // Prefer back camera when available; gracefully fallback
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch (primaryErr) {
        console.warn("Primary getUserMedia failed, retrying with generic video:true", primaryErr);
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      // Wait for the video element to exist (rendered after isCameraOpen=true)
      const attachWhenReady = () => {
        const vEl = videoRef.current;
        if (!vEl) {
          rafRef.current = requestAnimationFrame(attachWhenReady);
          return;
        }
        vEl.srcObject = stream;
        vEl.onloadedmetadata = () => {
          // ensure play then size canvases and start render + detection
          vEl.play().then(() => {
            const v = vEl;
            const box = scanBoxRef.current;
            const ov = overlayRef.current;
            if (v && ov && box) {
              let w = box.clientWidth;
              let h = box.clientHeight;
              if (!w || !h) {
                // Fallback size in case box is not laid out yet
                const parent = box.parentElement;
                w = (parent?.clientWidth || 640);
                h = (parent?.clientHeight || 360);
              }
              ov.width = w;
              ov.height = h;

              // Offscreen canvas to send smaller frames
              const sendC = document.createElement('canvas');
              const SEND_W = 640;
              const aspect = v.videoWidth > 0 && v.videoHeight > 0 ? (v.videoHeight / v.videoWidth) : (h / w);
              sendC.width = SEND_W;
              sendC.height = Math.round(SEND_W * aspect);
              sendCanvasRef.current = sendC;

              // Keep canvases in sync with container size
              try {
                if (resizeObsRef.current) {
                  resizeObsRef.current.disconnect();
                  resizeObsRef.current = null;
                }
                const ro = new ResizeObserver((entries) => {
                  for (const entry of entries) {
                    const cw = Math.round(entry.contentRect.width || box.clientWidth);
                    const ch = Math.round(entry.contentRect.height || box.clientHeight);
                    if (cw && ch && (ov.width !== cw || ov.height !== ch)) {
                      ov.width = cw;
                      ov.height = ch;
                    }
                  }
                });
                ro.observe(box);
                resizeObsRef.current = ro;
              } catch (_) {}

              startDetectionLoop();
            }
            setIsLoading(false);
          });
        };
      };
      attachWhenReady();
    } catch (err) {
      console.error("Camera error:", err?.name || err, err);
      alert("Could not access camera. Please check permissions and make sure you're using HTTPS.");
      setIsLoading(false);
    }
  };

  // Capture photo removed; live-only

  // Stop camera
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    detectActiveRef.current = false;
    if (detectTimerRef.current) {
      try { clearTimeout(detectTimerRef.current); } catch {}
      detectTimerRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (resizeObsRef.current) {
      try { resizeObsRef.current.disconnect(); } catch {}
      resizeObsRef.current = null;
    }
    const ctx = overlayRef.current?.getContext('2d');
    if (ctx && overlayRef.current) ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    // capture a snapshot (prefer video, fallback to send canvas)
    let snapshot = null;
    try {
      const v = videoRef.current;
      if (v && v.videoWidth > 0 && v.videoHeight > 0) {
        const c = document.createElement('canvas');
        c.width = v.videoWidth; c.height = v.videoHeight;
        const cx = c.getContext('2d');
        cx.drawImage(v, 0, 0, c.width, c.height);
        snapshot = c.toDataURL('image/jpeg', 0.9);
      } else if (sendCanvasRef.current) {
        snapshot = sendCanvasRef.current.toDataURL('image/jpeg', 0.9);
      }
    } catch (_) {}

    setIsCameraOpen(false);
    // fetch rich recommendations, then save history
    (async () => {
      const counts = weedCountsRef.current || {};
      const weeds = Object.entries(counts)
        .filter(([, c]) => c > 0)
        .map(([label]) => label);
      const recMap = await fetchRecommendations(weeds);
      setRecs(recMap || {});
      setShowRecs(true);

      // decide top weed by frequency, fallback to lastTop
      let topWeed = null;
      let topCount = -1;
      for (const [label, c] of Object.entries(counts)) {
        if (c > topCount) { topCount = c; topWeed = label; }
      }
      if (!topWeed && lastTopRef.current?.label) {
        topWeed = (lastTopRef.current.label || 'unknown').toLowerCase();
      }
      const recText = topWeed ? (recMap?.[topWeed] || '') : '';
      const conf = typeof lastTopRef.current?.confidence === 'number' ? lastTopRef.current.confidence : null;
      if (snapshot || topWeed || recText) {
        await saveScanHistory({ image: snapshot, weedName: topWeed, recommendations: recText, confidence: conf });
      }
    })();
  };

  // Retake removed; live-only

  // Status text
  const getStatusText = () => {
    if (isCameraOpen) return translatedTexts.cameraActive;
    return translatedTexts.readyToScan;
  };

  const getStatusClass = () => {
    if (isCameraOpen) return "scanweeds-status-container scanweeds-status-active";
    return "scanweeds-status-container scanweeds-status-ready";
  };

  const getScanBoxClass = () => {
    if (isCameraOpen) return "scanweeds-scan-box scanweeds-video-active";
    return "scanweeds-scan-box";
  };

  // Backend integration for live detection
  const API_BASE = process.env.REACT_APP_API_BASE || "http://127.0.0.1:5000";
  const getToken = () =>
    sessionStorage.getItem("access_token") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token");

  const fetchRecommendations = async (weedsArr) => {
    if (!weedsArr?.length) return {};
    const token = getToken();
    const res = await fetch(`${API_BASE}/api/realtime/recommend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ weeds: weedsArr }),
    });
    if (!res.ok) return {};
    const data = await res.json();
    return data.recommendations || {};
  };

  const drawBoxes = (ctx, detections, scaleX, scaleY) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.font = '14px Arial';
    ctx.fillStyle = 'rgba(0,255,0,0.85)';
    (detections || []).forEach(d => {
      const b = d.box || { x1:0, y1:0, x2:0, y2:0 };
      const x1 = Math.round(b.x1 * scaleX);
      const y1 = Math.round(b.y1 * scaleY);
      const x2 = Math.round(b.x2 * scaleX);
      const y2 = Math.round(b.y2 * scaleY);
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      const label = `${d.label || ''} ${(d.confidence ?? 0).toFixed(2)}`;
      const w = ctx.measureText(label).width + 10;
      const h = 18;
      const top = Math.max(y1 - h, 0);
      ctx.fillRect(x1, top, w, h);
      const old = ctx.fillStyle;
      ctx.fillStyle = '#000';
      ctx.fillText(label, x1 + 5, top + 14);
      ctx.fillStyle = old;
    });
  };

  const startDetectionLoop = () => {
    const v = videoRef.current;
    const ov = overlayRef.current;
    const sendC = sendCanvasRef.current;
    if (!v || !ov || !sendC) return;
    const sendCtx = sendC.getContext('2d');
    const overlayCtx = ov.getContext('2d');
    const DETECT_MS = 10000; // model takes ~10s per response
    detectActiveRef.current = true;

    const tick = async () => {
      try {
        if (!detectActiveRef.current) return;
        if (detectBusyRef.current) return;
        if (!(v.videoWidth > 0 && v.videoHeight > 0)) return;
        detectBusyRef.current = true;
        // draw current video frame into offscreen canvas scaled to SEND width
        sendCtx.drawImage(v, 0, 0, sendC.width, sendC.height);
        const dataUrl = sendC.toDataURL('image/jpeg', 0.6);
        const token = getToken();
        const res = await fetch(`${API_BASE}/api/realtime/detect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ image: dataUrl, conf: 0.25 }),
        });
        if (res.ok) {
          const payload = await res.json();
          const sx = ov.width / payload.width;
          const sy = ov.height / payload.height;
          drawBoxes(overlayCtx, payload.detections, sx, sy);
          // accumulate detections by label
          const curr = { ...weedCountsRef.current };
          (payload.detections || []).forEach(d => {
            const label = (d.label || 'unknown').toLowerCase();
            curr[label] = (curr[label] || 0) + 1;
          });
          weedCountsRef.current = curr;
          setWeedCounts(curr);
          // track last top detection
          const top = (payload.detections || [])
            .filter(d => d && typeof d.confidence === 'number')
            .sort((a, b) => b.confidence - a.confidence)[0] || null;
          lastTopRef.current = top || null;
        }
      } catch (e) {
        // ignore transient errors
      }
      finally {
        detectBusyRef.current = false;
        if (detectActiveRef.current) {
          detectTimerRef.current = setTimeout(tick, DETECT_MS);
        }
      }
    };
    // start loop
    detectTimerRef.current = setTimeout(tick, DETECT_MS);
  };

  return (
    <Layout>
      {/* Translation Loader Overlay */}
      {translating && (
        <div className="scanweeds-loader-overlay">
          <div className="scanweeds-translation-spinner"></div>
          <p>Translating...</p>
        </div>
      )}

      <div className="scanweeds-scan-container">
        <div className="scanweeds-scan-card">
          <h2 className="scanweeds-scan-title">{translatedTexts.title}</h2>
          <p className="scanweeds-scan-description">{translatedTexts.description}</p>

          <div className={getStatusClass()}>
            {getStatusText()}
          </div>

          <div ref={scanBoxRef} className={getScanBoxClass()} style={{ position: 'relative' }}>
            {!isCameraOpen && (
              isLoading ? (
                <div className="scanweeds-camera-loading">
                  <div className="scanweeds-camera-spinner"></div>
                  <span>{translatedTexts.cameraStarting}</span>
                </div>
              ) : (
                <span className="scanweeds-camera-icon">📷</span>
              )
            )}
            {isCameraOpen && (
              <>
                {/* visible video as live preview */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="scanweeds-video-preview"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                {/* keep live canvas hidden (no longer used for preview) */}
                <canvas ref={liveCanvasRef} style={{ display: 'none' }} />
                {/* overlay canvas positioned over video */}
                <canvas ref={overlayRef} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
              </>
            )}
          </div>

          <div className="scanweeds-button-group">
            {!isCameraOpen && (
              <button className="scanweeds-scan-btn" onClick={openCamera} disabled={isLoading}>
                {isLoading ? "🔄 Starting..." : translatedTexts.openCamera}
              </button>
            )}
            {isCameraOpen && (
              <button className="scanweeds-scan-btn scanweeds-retake" onClick={stopCamera}>
                Stop
              </button>
            )}
            <button className="scanweeds-scan-btn scanweeds-dashboard" onClick={() => navigate("/dashboard")}>
              {translatedTexts.dashboard}
            </button>
          </div>

          {showRecs && (
            <div className="scanweeds-analysis-section">
              <p className="scanweeds-analysis-note">Recommendations from this scan:</p>
              {Object.keys(recs).length === 0 && (
                <div style={{ marginTop: 8 }}>No weeds detected during this session.</div>
              )}
              {Object.entries(translatedRecs).map(([weed, text]) => (
                <div key={weed} style={{ marginTop: 12, textAlign: 'left' }}>
                  <h4 style={{ margin: '0 0 6px 0' }}>
                    <span style={{ textTransform: 'capitalize' }}>{weed}</span>
                    {typeof weedCounts[weed] !== 'undefined' ? ` (x${weedCounts[weed]})` : ''}
                  </h4>
                  <div className="markdown-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </Layout>
  );
}

export default ScanWeeds;