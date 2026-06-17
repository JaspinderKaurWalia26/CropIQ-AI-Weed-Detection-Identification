import React, { useState, useRef, useEffect, useContext } from "react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FiUpload, FiRotateCcw } from "react-icons/fi";

import Layout from "../components/dashboard/Layout";
import "../styles/UploadImage.css";
import "../styles/Markdown.css";
import { LanguageContext } from "../../context/LanguageContext";

const UploadImage = () => {
  const { language, translate } = useContext(LanguageContext);
  const translationsCache = useRef({});
  const [translating, setTranslating] = useState(false);

  // Helper: Translate with caching
  const translateCached = async (text) => {
    if (!text) return "";
    if (language === "en") return text;
    const cacheKey = `${text}_${language}`;
    if (translationsCache.current[cacheKey]) return translationsCache.current[cacheKey];

    const translated = await translate(text);
    translationsCache.current[cacheKey] = translated;
    return translated;
  };

  // Capture a frame from the live camera and analyze it via the same upload endpoint
  const captureAndAnalyzeLive = async () => {
    if (!showCamera) {
      setError("Live camera is not running.");
      return;
    }
    const liveCanvas = liveCanvasRef.current;
    if (!liveCanvas || liveCanvas.width === 0 || liveCanvas.height === 0) {
      setError("Live preview is not ready.");
      return;
    }
    const token = getToken();
    if (!token) {
      setError(translatedTexts.notLoggedIn);
      return;
    }

    try {
      setIsUploading(true);
      setError(null);
      setResult(null);

      // Show analyzing message in chat
      setChatMessages((prev) => [
        ...prev,
        { sender: "bot", text: translatedTexts.analyzing, originalText: staticTexts.analyzing },
      ]);

      // Get a snapshot from the live canvas as JPEG
      const dataUrl = liveCanvas.toDataURL("image/jpeg", 0.9);
      setCapturedImage(dataUrl);

      // Use realtime detect endpoint like ScanWeeds/LiveCapture
      const detectResp = await fetch(`${API_BASE}/api/realtime/detect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ image: dataUrl, conf: CONF }),
      });
      const detectData = await detectResp.json();
      if (!detectResp.ok) {
        throw new Error(detectData?.error || "Detect failed");
      }

      const dets = Array.isArray(detectData?.detections) ? detectData.detections : [];
      const top = dets
        .filter((d) => d && typeof d.confidence === "number")
        .sort((a, b) => b.confidence - a.confidence)[0] || null;

      const weedName = top?.label || "Unknown";
      const confidence = typeof top?.confidence === "number" ? top.confidence : null;

      // Fetch recommendations for the detected weed
      let recommendations = null;
      if (weedName && weedName !== "Unknown") {
        const recResp = await fetch(`${API_BASE}/api/realtime/recommend`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ weeds: [weedName] }),
        });
        if (recResp.ok) {
          const recData = await recResp.json();
          const recText = recData?.recommendations?.[weedName] || "";
          recommendations = recText ? await translateCached(recText) : null;
        }
      }

      const resultData = { weed_name: weedName, confidence, recommendations };
      setResult(resultData);
      // Save to scan history
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

      // Build chat message consistent with handleScan
      let resultMessage = `✅ Analysis Complete!\n\n**Weed Identified:** ${resultData.weed_name || "Unknown"}\n`;
      if (typeof resultData.confidence === "number") {
        resultMessage += `**Confidence:** ${(resultData.confidence * 100).toFixed(2)}%\n\n`;
      }
      if (resultData.recommendations) {
        resultMessage += `**Organic Removal Methods:**\n${resultData.recommendations}`;
      }
      setChatMessages((prev) => [...prev, { sender: "bot", text: resultMessage, originalText: resultMessage }]);
    } catch (err) {
      const errorMsg = err.message || "Something went wrong";
      setError(errorMsg);
      setChatMessages((prev) => [
        ...prev,
        { sender: "bot", text: `${translatedTexts.errorPrefix} ${errorMsg}`, originalText: `${staticTexts.errorPrefix} ${errorMsg}` },
      ]);
    } finally {
      setIsUploading(false);
    }
  };

  // UI state
  const [capturedImage, setCapturedImage] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  // Realtime camera state
  const [showCamera, setShowCamera] = useState(false);
  const [recs, setRecs] = useState({});
  const uniqueWeedsRef = useRef(new Set());
  const [uniqueWeedsList, setUniqueWeedsList] = useState([]);
  const videoRef = useRef(null);
  const liveCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const detectIntervalRef = useRef(null);
  const rafRef = useRef(null);
  const streamRef = useRef(null);

  // Chat state
  // (chat input not used on this page)
  const [chatMessages, setChatMessages] = useState([
    {
      sender: "bot",
      text: "Hello! I'm your Weed Detection Assistant 🌱\n\nI can help you identify weeds in your field and provide organic removal recommendations. Please upload an image of the weed you'd like me to analyze.",
      originalText: "Hello! I'm your Weed Detection Assistant 🌱\n\nI can help you identify weeds in your field and provide organic removal recommendations. Please upload an image of the weed you'd like me to analyze."
    },
  ]);
  const [isTyping] = useState(false);

  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const API_BASE = process.env.REACT_APP_API_BASE || "http://127.0.0.1:5000";

  const getToken = () =>
    sessionStorage.getItem("access_token") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token");

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isTyping]);

  // ------------------------------
  // Realtime camera helpers
  // ------------------------------
  const DETECT_INTERVAL_MS = 350;
  const SEND_WIDTH = 640;
  const CONF = 0.25;

  const sendDetect = async (dataUrl) => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/api/realtime/detect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ image: dataUrl, conf: CONF }),
    });
    if (!res.ok) throw new Error("detect failed");
    return res.json();
  };

  const fetchRecs = async (weedsArr) => {
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
    if (!res.ok) throw new Error("recommend failed");
    const data = await res.json();
    return data.recommendations || {};
  };

  const drawBoxes = (ctx, detections, scaleX, scaleY) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.strokeStyle = "#00ff00";
    ctx.fillStyle = "rgba(0,255,0,0.85)";
    ctx.lineWidth = 2;
    ctx.font = "14px Arial";
    (detections || []).forEach((d) => {
      const b = d.box || { x1: 0, y1: 0, x2: 0, y2: 0 };
      const x1 = Math.round(b.x1 * scaleX);
      const y1 = Math.round(b.y1 * scaleY);
      const x2 = Math.round(b.x2 * scaleX);
      const y2 = Math.round(b.y2 * scaleY);
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      const label = `${d.label || ""} ${(d.confidence ?? 0).toFixed(2)}`;
      const w = ctx.measureText(label).width + 10;
      const h = 18;
      const top = Math.max(y1 - h, 0);
      ctx.fillRect(x1, top, w, h);
      const old = ctx.fillStyle;
      ctx.fillStyle = "#000";
      ctx.fillText(label, x1 + 5, top + 14);
      ctx.fillStyle = old;
    });
  };

  const startCamera = async () => {
    try {
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
      } catch (e) {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      streamRef.current = stream;
      setShowCamera(true);

      const attachWhenReady = async () => {
        const v = videoRef.current;
        const liveCanvas = liveCanvasRef.current;
        const overlay = overlayCanvasRef.current;
        if (!v || !liveCanvas || !overlay) {
          rafRef.current = requestAnimationFrame(attachWhenReady);
          return;
        }
        v.srcObject = stream;
        await new Promise((resolve) => {
          if (v.readyState >= 1) return resolve();
          v.onloadedmetadata = () => resolve();
        });
        await v.play();

        const aspect = (v.videoWidth || 16) / (v.videoHeight || 9);
        const targetW = 800;
        const targetH = Math.round(targetW / aspect);
        [liveCanvas, overlay].forEach((c) => {
          c.width = targetW;
          c.height = targetH;
        });
        const liveCtx = liveCanvas.getContext("2d");
        const overlayCtx = overlay.getContext("2d");

        const sendCanvas = document.createElement("canvas");
        const scale = SEND_WIDTH / targetW;
        sendCanvas.width = SEND_WIDTH;
        sendCanvas.height = Math.round(targetH * scale);
        const sendCtx = sendCanvas.getContext("2d");

        const renderLoop = () => {
          try {
            if (v.videoWidth > 0 && v.videoHeight > 0) {
              liveCtx.drawImage(v, 0, 0, liveCanvas.width, liveCanvas.height);
            }
          } catch {}
          rafRef.current = requestAnimationFrame(renderLoop);
        };
        renderLoop();

        const detectTick = async () => {
          try {
            sendCtx.drawImage(liveCanvas, 0, 0, sendCanvas.width, sendCanvas.height);
            const dataUrl = sendCanvas.toDataURL("image/jpeg", 0.6);
            const resp = await sendDetect(dataUrl);
            const sx = liveCanvas.width / resp.width;
            const sy = liveCanvas.height / resp.height;
            drawBoxes(overlayCtx, resp.detections, sx, sy);
            const s = uniqueWeedsRef.current;
            (resp.detections || []).forEach((d) => d.label && s.add(d.label));
            setUniqueWeedsList(Array.from(s));
          } catch {}
        };

        detectIntervalRef.current = setInterval(detectTick, DETECT_INTERVAL_MS);
      };
      attachWhenReady();
    } catch (err) {
      setError("Unable to access camera.");
    }
  };

  const stopCamera = () => {
    setShowCamera(false);
    if (detectIntervalRef.current) {
      clearInterval(detectIntervalRef.current);
      detectIntervalRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    const ctx = overlayCanvasRef.current?.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
  };

  // Recommendations polling while camera is running
  useEffect(() => {
    if (!showCamera) return;
    const timer = setInterval(async () => {
      const arr = Array.from(uniqueWeedsRef.current);
      if (!arr.length) return;
      try {
        const token = getToken();
        const res = await fetch(`${API_BASE}/api/realtime/recommend`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ weeds: arr }),
        });
        if (res.ok) {
          const data = await res.json();
          setRecs(data.recommendations || {});
        }
      } catch (e) {}
    }, 4000);
    return () => clearInterval(timer);
  }, [showCamera, API_BASE]);

  // Static texts
  const staticTexts = {
    title: "🌿 Weed Detection Assistant",
    description:
      "Upload an image of weeds from your field for instant analysis and organic removal recommendations",
    uploadText: "Click to Upload Weed Image",
    uploadSubtext: "Supports JPG, PNG, WebP • Max 5MB",
    chooseAnother: "Choose Another",
    analyzeImage: "Analyze Image",
    analyzing: "🔄 Analyzing...",
    uploadImagePrompt: "Please choose an image first.",
    notLoggedIn: "You are not logged in. Please login to scan.",
    errorPrefix: "❌ Sorry, I encountered an error:"
  };

  const [translatedTexts, setTranslatedTexts] = useState(staticTexts);

  // Consolidated translation effect - translate everything at once
  useEffect(() => {
    const translateEverything = async () => {
      setTranslating(true);

      try {
        // Translate static texts
        const newTexts = {};
        const staticPromises = Object.keys(staticTexts).map(async (key) => {
          const cacheKey = `${staticTexts[key]}_${language}`;
          if (translationsCache.current[cacheKey]) {
            newTexts[key] = translationsCache.current[cacheKey];
          } else {
            const translated = language === "en" ? staticTexts[key] : await translate(staticTexts[key]);
            translationsCache.current[cacheKey] = translated;
            newTexts[key] = translated;
          }
        });

        // Translate chat messages
        const messagePromises = chatMessages.map(async (msg) => {
          const originalText = msg.originalText || msg.text;
          const cacheKey = `${originalText}_${language}`;
          if (translationsCache.current[cacheKey]) {
            return { ...msg, text: translationsCache.current[cacheKey], originalText };
          } else {
            const translated = language === "en" ? originalText : await translate(originalText);
            translationsCache.current[cacheKey] = translated;
            return { ...msg, text: translated, originalText };
          }
        });

        // Wait for ALL translations to complete
        await Promise.all([...staticPromises, ...messagePromises]);

        // Update states only after all translations are done
        setTranslatedTexts(newTexts);

        const updatedMessages = await Promise.all(messagePromises);
        setChatMessages(updatedMessages);
      } catch (err) {
        console.error("Translation error:", err);
      } finally {
        setTranslating(false);
      }
    };

    translateEverything();
  }, [language]); // Only depend on language

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCapturedImage(event.target.result);
        setChatMessages((prev) => [
          ...prev,
          { sender: "user", text: "I've uploaded an image of a weed for analysis.", originalText: "I've uploaded an image of a weed for analysis." },
        ]);
      };
      reader.readAsDataURL(file);
      setSelectedFile(file);
      setResult(null);
      setError(null);
    } else {
      alert("Please select a valid image file.");
    }
  };

  const handleScan = async () => {
    if (!selectedFile) {
      setError(translatedTexts.uploadImagePrompt);
      return;
    }
    const token = getToken();
    if (!token) {
      setError(translatedTexts.notLoggedIn);
      return;
    }

    try {
      setIsUploading(true);
      setError(null);
      setResult(null);

      // Add analyzing message to chat
      setChatMessages((prev) => [
        ...prev,
        { sender: "bot", text: translatedTexts.analyzing, originalText: staticTexts.analyzing },
      ]);

      const formData = new FormData();
      formData.append("image", selectedFile);

      const resp = await fetch(`${API_BASE}/api/scan/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const payload = await resp.json();
      if (!resp.ok) {
        throw new Error(payload?.error || payload?.msg || "Upload failed");
      }

      let resultData = payload.data || payload;

      // Translate recommendations before showing
      if (resultData?.recommendations) {
        const translatedReco = await translateCached(resultData.recommendations);
        resultData = { ...resultData, recommendations: translatedReco };
      }

      setResult(resultData);

      // Prepare chat message
      let resultMessage = `✅ Analysis Complete!\n\n**Weed Identified:** ${resultData.weed_name || "Unknown"}\n`;
      if (resultData?.confidence !== undefined) {
        resultMessage += `**Confidence:** ${(resultData.confidence * 100).toFixed(2)}%\n\n`;
      }
      if (resultData?.recommendations) {
        resultMessage += `**Organic Removal Methods:**\n${resultData.recommendations}`;
      }

      setChatMessages((prev) => [
        ...prev,
        { sender: "bot", text: resultMessage, originalText: resultMessage },
      ]);
    } catch (err) {
      const errorMsg = err.message || "Something went wrong";
      setError(errorMsg);
      setChatMessages((prev) => [
        ...prev,
        { sender: "bot", text: `${translatedTexts.errorPrefix} ${errorMsg}`, originalText: `${staticTexts.errorPrefix} ${errorMsg}` },
      ]);
    } finally {
      setIsUploading(false);
    }
  };

  const resetSelection = () => {
    setCapturedImage(null);
    setSelectedFile(null);
    setResult(null);
    setError(null);
    setChatMessages((prev) => [
      ...prev,
      { sender: "user", text: "I'd like to upload a different image.", originalText: "I'd like to upload a different image." },
      { sender: "bot", text: "Sure! Please upload another weed image for analysis.", originalText: "Sure! Please upload another weed image for analysis." },
    ]);
  };

  const triggerFileInput = () => fileInputRef.current?.click();

  return (
    <Layout>
      {/* Translation Loader Overlay */}
      {translating && (
        <div className="uploadimage-loader-overlay">
          <div className="uploadimage-translation-spinner"></div>
          <p>Translating...</p>
        </div>
      )}

      <div className="uploadimage-container">
        <div className="uploadimage-header">
          <h1 className="uploadimage-title">{translatedTexts.title}</h1>
          <p className="uploadimage-description">{translatedTexts.description}</p>
        </div>

        <div className="uploadimage-chat-interface">
          <div className="uploadimage-chat-messages">

            {chatMessages.map((msg, index) => (
              <div key={index} className={`uploadimage-message uploadimage-message-${msg.sender}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
              </div>
            ))}

            {!capturedImage && (
              <div className="uploadimage-upload-area" onClick={triggerFileInput}>
                <div className="uploadimage-upload-icon"><FiUpload size={48} /></div>
                <div className="uploadimage-upload-text">{translatedTexts.uploadText}</div>
                <div className="uploadimage-upload-subtext">{translatedTexts.uploadSubtext}</div>
              </div>
            )}

            {/* Live camera section */}
            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                {!showCamera ? (
                  <button className="uploadimage-btn uploadimage-btn-primary" onClick={startCamera}>
                    Open Camera (Live Scan)
                  </button>
                ) : (
                  <>
                    <button className="uploadimage-btn uploadimage-btn-secondary" onClick={stopCamera}>
                      Stop Camera
                    </button>
                    <button
                      className="uploadimage-btn uploadimage-btn-primary"
                      onClick={captureAndAnalyzeLive}
                      disabled={isUploading}
                    >
                      {isUploading ? translatedTexts.analyzing : "Capture Photo & Analyze"}
                    </button>
                  </>
                )}
                {showCamera && (
                  <span style={{ color: "#2e7d32" }}>Live camera running…</span>
                )}
              </div>
              {showCamera && (
                <div style={{ display: "flex", gap: 16 }}>
                  <div style={{ position: "relative" }}>
                    <video ref={videoRef} style={{ display: "none" }} playsInline muted />
                    <canvas ref={liveCanvasRef} style={{ border: "1px solid #ccc" }} />
                    <canvas ref={overlayCanvasRef} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }} />
                  </div>
                  <div style={{ width: 360, maxHeight: 520, overflow: "auto", padding: 8, border: "1px solid #ddd" }}>
                    <h3>Recommendations</h3>
                    {uniqueWeedsList.length > 0 && (
                      <div style={{ marginBottom: 8, fontSize: 13 }}>
                        <strong>Detected:</strong> {uniqueWeedsList.join(", ")}
                      </div>
                    )}
                    {Object.keys(recs).length === 0 && <div>No weeds detected yet.</div>}
                    {Object.entries(recs).map(([weed, text]) => (
                      <div key={weed} style={{ marginBottom: 12 }}>
                        <strong>{weed}</strong>
                        <div style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {capturedImage && (
              <div className="uploadimage-upload-area has-image">
                <img src={capturedImage} alt="Uploaded Weed" className="uploadimage-captured-image" />
                <div className="uploadimage-action-buttons">
                  <button className="uploadimage-btn uploadimage-btn-secondary" onClick={resetSelection}>
                    <FiRotateCcw size={18} /> {translatedTexts.chooseAnother}
                  </button>
                  <button className="uploadimage-btn uploadimage-btn-primary" onClick={handleScan} disabled={isUploading}>
                    {isUploading ? translatedTexts.analyzing : translatedTexts.analyzeImage}
                  </button>
                </div>
              </div>
            )}

            {result && (
              <div className="uploadimage-reco-card">
                <h3 className="reco-title">{result.weed_name || "Weed Detection Result"}</h3>
                {typeof result.confidence !== "undefined" && result.confidence !== null && (
                  <div className="reco-confidence">
                    <div className="reco-confidence-bar">
                      <div
                        className="reco-confidence-fill"
                        style={{ width: `${Math.max(0, Math.min(100, (result.confidence * 100))).toFixed(2)}%` }}
                      />
                    </div>
                    <span className="reco-confidence-value">{(result.confidence * 100).toFixed(2)}%</span>
                  </div>
                )}
                {result.recommendations && (
                  <div className="reco-section">
                    <h4 className="reco-section-title">{translatedTexts.analyzeImage}</h4>
                    <div className="reco-section-content markdown-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.recommendations}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="uploadimage-message uploadimage-message-bot">
                ❌ {error}
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} className="uploadimage-file-input" />
      </div>
    </Layout>
  );
};

export default UploadImage;