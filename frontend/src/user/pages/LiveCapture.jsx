import React, { useEffect, useRef, useState, useContext } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Layout from "../components/dashboard/Layout";
import "../styles/Markdown.css";
import { LanguageContext } from "../../context/LanguageContext";

function LiveCapture() {
  const { language, translate } = useContext(LanguageContext);
  const translationsCache = useRef({});

  const [translating, setTranslating] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [error, setError] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const API_BASE = process.env.REACT_APP_API_BASE || "http://127.0.0.1:5000";
  const getToken = () =>
    sessionStorage.getItem("access_token") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token");

  const tCached = async (text) => {
    if (!text) return "";
    if (language === "en") return text;
    const key = `${text}_${language}`;
    if (translationsCache.current[key]) return translationsCache.current[key];
    const tr = await translate(text);
    translationsCache.current[key] = tr;
    return tr;
  };

  const staticTexts = {
    title: "📸 Live Capture Scanner",
    description: "Open your camera, capture a clear photo of the weed, and get instant analysis with recommendations.",
    openCamera: "Open Camera",
    stopCamera: "Stop Camera",
    captureAnalyze: "Capture Photo & Analyze",
    analyzing: "Analyzing...",
    notLoggedIn: "You are not logged in. Please login to scan.",
  };
  const [texts, setTexts] = useState(staticTexts);

  useEffect(() => {
    const translateAll = async () => {
      setTranslating(true);
      try {
        const keys = Object.keys(staticTexts);
        const vals = await Promise.all(keys.map(k => tCached(staticTexts[k])));
        const m = {}; keys.forEach((k, i) => m[k] = vals[i]);
        setTexts(m);
      } catch(e) {}
      finally { setTranslating(false); }
    };
    translateAll();
  }, [language]);

  // Auto-start camera on mount for immediate live preview
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      setError(null);
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch (e) {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      setShowCamera(true);
      const v = videoRef.current;
      if (!v) return;
      v.srcObject = stream;
      await new Promise(resolve => {
        if (v.readyState >= 1) return resolve();
        v.onloadedmetadata = () => resolve();
      });
      await v.play();
    } catch (e) {
      setError("Unable to access camera. Please allow permission or use a supported browser.");
    }
  };

  const stopCamera = () => {
    setShowCamera(false);
    try {
      const s = streamRef.current;
      if (s) s.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      const v = videoRef.current; if (v) v.srcObject = null;
    } catch {}
  };

  const captureAndAnalyze = async () => {
    if (!showCamera || !videoRef.current) return;
    const token = getToken();
    if (!token) { setError(texts.notLoggedIn); return; }
    try {
      setIsBusy(true);
      setError(null);
      setResult(null);
      const v = videoRef.current;
      if (v.videoWidth === 0 || v.videoHeight === 0) { setError("Camera not ready."); setIsBusy(false); return; }
      const canvas = document.createElement("canvas");
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      setCapturedImage(dataUrl);
      // Send to realtime detect endpoint (like ScanWeeds)
      const detectResp = await fetch(`${API_BASE}/api/realtime/detect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ image: dataUrl, conf: 0.25 }),
      });
      const detectData = await detectResp.json();
      if (!detectResp.ok) throw new Error(detectData?.error || 'Detect failed');

      const dets = Array.isArray(detectData?.detections) ? detectData.detections : [];
      const top = dets
        .filter(d => d && typeof d.confidence === 'number')
        .sort((a, b) => b.confidence - a.confidence)[0] || null;

      let weedName = top?.label || 'Unknown';
      let confidence = typeof top?.confidence === 'number' ? top.confidence : null;

      // Fetch recommendations for the detected weed (if known)
      let recommendations = null;
      if (weedName && weedName !== 'Unknown') {
        const recResp = await fetch(`${API_BASE}/api/realtime/recommend`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ weeds: [weedName] }),
        });
        if (recResp.ok) {
          const recData = await recResp.json();
          const recText = recData?.recommendations?.[weedName] || '';
          recommendations = recText ? await tCached(recText) : null;
        }
      }

      const resObj = { weed_name: weedName, confidence, recommendations };
      setResult(resObj);
      // save to scan history
      try {
        await fetch(`${API_BASE}/api/scan/save`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ image: dataUrl, weed_name: weedName, confidence, recommendations }),
        });
      } catch (_) {}
    } catch(e) {
      setError(e.message || "Something went wrong");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Layout>
      {isBusy && (
        <div className="uploadimage-loader-overlay" style={{ background: 'rgba(0,0,0,0.45)' }}>
          <div className="uploadimage-translation-spinner"></div>
          <p>{texts.analyzing}</p>
        </div>
      )}
      {translating && (
        <div className="uploadimage-loader-overlay">
          <div className="uploadimage-translation-spinner"></div>
          <p>Translating...</p>
        </div>
      )}
      <div className="uploadimage-container" style={{ padding: 20 }}>
        <div className="uploadimage-header">
          <h1 className="uploadimage-title">{texts.title}</h1>
          <p className="uploadimage-description">{texts.description}</p>
        </div>

        <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 12 }}>
          {!showCamera ? (
            <button className="uploadimage-btn uploadimage-btn-primary" onClick={startCamera}>
              {texts.openCamera}
            </button>
          ) : (
            <>
              <button className="uploadimage-btn uploadimage-btn-secondary" onClick={stopCamera}>
                {texts.stopCamera}
              </button>
              <button className="uploadimage-btn uploadimage-btn-primary" onClick={captureAndAnalyze} disabled={isBusy}>
                {isBusy ? texts.analyzing : texts.captureAnalyze}
              </button>
            </>
          )}
        </div>

        {showCamera && (
          <div style={{ position: "relative", width: "100%", maxWidth: 800, aspectRatio: "16 / 9", border: "1px solid #ddd", borderRadius: 8, overflow: "hidden" }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        )}

        {error && (
          <div className="uploadimage-message uploadimage-message-bot" style={{ marginTop: 12 }}>❌ {error}</div>
        )}

        {capturedImage && (
          <div style={{ marginTop: 16, display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ width: 320 }}>
              <img src={capturedImage} alt="Captured" style={{ width: '100%', border: '1px solid #ddd', borderRadius: 8 }} />
            </div>
            {result && (
              <div className="uploadimage-reco-card" style={{ flex: 1, minWidth: 300 }}>
                <h3 className="reco-title" style={{ marginTop: 0 }}>{result.weed_name || "Weed Detection Result"}</h3>
                {typeof result.confidence !== "undefined" && result.confidence !== null && (
                  <div className="reco-confidence">
                    <div className="reco-confidence-bar">
                      <div className="reco-confidence-fill" style={{ width: `${Math.max(0, Math.min(100, (result.confidence * 100))).toFixed(2)}%` }} />
                    </div>
                    <span className="reco-confidence-value">{(result.confidence * 100).toFixed(2)}%</span>
                  </div>
                )}
                {result.recommendations && (
                  <div className="reco-section">
                    <h4 className="reco-section-title">Recommendations</h4>
                    <div className="reco-section-content markdown-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.recommendations}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {result && !capturedImage && (
          <div className="uploadimage-reco-card" style={{ marginTop: 16 }}>
            <h3 className="reco-title">{result.weed_name || "Weed Detection Result"}</h3>
            {typeof result.confidence !== "undefined" && result.confidence !== null && (
              <div className="reco-confidence">
                <div className="reco-confidence-bar">
                  <div className="reco-confidence-fill" style={{ width: `${Math.max(0, Math.min(100, (result.confidence * 100))).toFixed(2)}%` }} />
                </div>
                <span className="reco-confidence-value">{(result.confidence * 100).toFixed(2)}%</span>
              </div>
            )}
            {result.recommendations && (
              <div className="reco-section">
                <h4 className="reco-section-title">Recommendations</h4>
                <div className="reco-section-content markdown-body">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.recommendations}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default LiveCapture;
