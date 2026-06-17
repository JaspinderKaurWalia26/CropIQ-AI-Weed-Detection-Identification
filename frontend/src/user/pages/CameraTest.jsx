import React, { useEffect, useRef, useState } from "react";

function CameraTest() {
  const videoRef = useRef(null);
  const [error, setError] = useState("");
  const [streaming, setStreaming] = useState(false);

  const start = async () => {
    setError("");
    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch (e1) {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStreaming(true);
      }
    } catch (e) {
      setError(`${e?.name || "Error"}: ${e?.message || e}`);
    }
  };

  const stop = () => {
    try {
      const v = videoRef.current;
      const s = v && v.srcObject;
      if (s) {
        s.getTracks().forEach(t => t.stop());
        v.srcObject = null;
      }
    } catch {}
    setStreaming(false);
  };

  useEffect(() => {
    return () => stop();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h2>Camera Test</h2>
      <p>Click Start to request camera and show the live preview.</p>
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <button onClick={start} disabled={streaming}>Start</button>
        <button onClick={stop} disabled={!streaming}>Stop</button>
      </div>
      {error && (
        <div style={{ color: "#b00020", marginBottom: 12 }}>{error}</div>
      )}
      <div style={{ width: "100%", maxWidth: 640, aspectRatio: "16 / 9", background: "#111", borderRadius: 8, overflow: "hidden" }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      <div style={{ marginTop: 12, color: "#666" }}>
        Requirements: use https or http://localhost, allow camera permission, ensure no other app uses the camera.
      </div>
    </div>
  );
}

export default CameraTest;
