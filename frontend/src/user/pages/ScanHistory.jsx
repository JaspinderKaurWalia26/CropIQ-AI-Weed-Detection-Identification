import React, { useEffect, useMemo, useState, useContext, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Layout from "../components/dashboard/Layout";
import "../styles/ScanHistory.css";
import "../styles/Markdown.css";
import { LanguageContext } from "../../context/LanguageContext";

function ScanHistory() {
  const { language, translate } = useContext(LanguageContext);
  const translationsCache = useRef({});

  const API_BASE = process.env.REACT_APP_API_BASE || "http://127.0.0.1:5000";

  const getToken = () =>
    sessionStorage.getItem("access_token") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token");

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [perPage] = useState(9);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeItem, setActiveItem] = useState(null);
  const [translating, setTranslating] = useState(false); // ADD THIS LINE

  const hasMore = useMemo(() => items.length < total, [items.length, total]);

  // Multilingual static texts
  const originalTexts = {
    pageTitle: "Scan History",
    pageSubtitle: "Review your past detections and recommended actions.",
    noRecommendations: "No recommendations available.",
    noRecommendationsModal: "No recommendations provided.",
    loadMore: "Load more",
    loading: "Loading...",
    endOfList: "End of history",
    historyEmpty: "No scans yet. Upload an image to get started.",
    close: "Close",
    notLoggedIn: "You are not logged in. Please login to view scan history.",
    chatNotLoggedIn: "You are not logged in. Please login to chat.",
  };
  const [translatedTexts, setTranslatedTexts] = useState({ ...originalTexts });

  const translateCached = async (text) => {
    if (!text) return "";
    if (language === "en") return text;
    const cacheKey = `${text}_${language}`;
    if (translationsCache.current[cacheKey]) return translationsCache.current[cacheKey];
    const translated = await translate(text);
    translationsCache.current[cacheKey] = translated;
    return translated;
  };

  // Re-translate static texts when language changes
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

  // Map API item
  const mapItem = (raw) => {
    const weedName = raw.weed_name || raw.weedName || raw.name;
    const recommendations = raw.recommendations;
    const detectedAt = raw.detected_at || raw.dateTime || raw.date || raw.timestamp;
    return {
      id: raw.id,
      weedName: weedName || "Unknown Weed",
      recommendations: recommendations || "",
      translatedRecommendations: recommendations || "", // placeholder, will be translated
      detectedAt: detectedAt,
      imagePath: raw.image_path || raw.imagePath || null,
    };
  };

  // Translate recommendation text
  const translateRecommendation = async (text) => {
    if (!text) return "";
    if (language === "en") return text;
    const cacheKey = `${text}_${language}`;
    if (translationsCache.current[cacheKey]) return translationsCache.current[cacheKey];
    const translated = await translate(text);
    translationsCache.current[cacheKey] = translated;
    return translated;
  };

  // Format date
  const formatDateTime = (value) => {
    if (value === null || value === undefined || value === "") return "";
    try {
      let dt;
      if (typeof value === "number") {
        const millis = value < 1e12 ? value * 1000 : value;
        dt = new Date(millis);
      } else if (typeof value === "string") {
        const s = value.trim();
        if (/^\d+$/.test(s)) {
          const num = parseInt(s, 10);
          const millis = num < 1e12 ? num * 1000 : num;
          dt = new Date(millis);
        } else {
          const norm = s.replace(" ", "T");
          dt = new Date(norm + "Z");
        }
      } else {
        dt = new Date(value);
      }
      if (isNaN(dt.getTime())) return String(value);
      return new Intl.DateTimeFormat("en-IN", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
        timeZoneName: "short",
      }).format(dt);
    } catch {
      return String(value);
    }
  };

  // Strip markdown for preview
  const stripMarkdown = (text) => {
    if (!text) return "";
    return text
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/#{1,6}\s/g, "")
      .replace(/`(.*?)`/g, "$1")
      .replace(/\[(.*?)\]\(.*?\)/g, "$1")
      .replace(/^\s*[-*+]\s/gm, "• ")
      .replace(/^\s*\d+\.\s/gm, "• ")
      .trim();
  };

  // Fetch history page
  const fetchPage = async (nextPage = 1) => {
    const token = getToken();
    if (!token) {
      setError(translatedTexts.notLoggedIn);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const resp = await fetch(`${API_BASE}/api/scan/history?page=${nextPage}&per_page=${perPage}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await resp.json();
      if (!resp.ok) throw new Error(payload?.error || payload?.msg || "Failed to load history");

      const mapped = (payload.items || []).map(mapItem);

      // Translate recommendations immediately
      const translatedMapped = await Promise.all(
        mapped.map(async (item) => ({
          ...item,
          translatedRecommendations: await translateRecommendation(item.recommendations),
        }))
      );

      setItems((prev) => (nextPage === 1 ? translatedMapped : [...prev, ...translatedMapped]));
      setTotal(payload.total || translatedMapped.length);
      setPage(payload.page || nextPage);
    } catch (e) {
      setError(e.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  // Re-translate all recommendations when language changes
  useEffect(() => {
    const translateAllItems = async () => {
      setTranslating(true); // ADD THIS LINE
      
      try {
        const updated = await Promise.all(
          items.map(async (item) => ({
            ...item,
            translatedRecommendations: await translateRecommendation(item.recommendations),
          }))
        );
        setItems(updated);
      } catch (err) {
        console.error("Translation error:", err);
      } finally {
        setTranslating(false); // ADD THIS LINE
      }
    };
    if (items.length > 0) translateAllItems();
  }, [language]);

  useEffect(() => {
    fetchPage(1);
  }, []);

  return (
    <Layout>
      {/* Translation Loader Overlay */}
      {translating && (
        <div className="scanhistory-loader-overlay">
          <div className="scanhistory-translation-spinner"></div>
          <p>Translating...</p>
        </div>
      )}

      <div className="history-page">
        <div className="history-header">
          <h2>{translatedTexts.pageTitle}</h2>
          <p className="history-subtitle">{translatedTexts.pageSubtitle}</p>
        </div>

        {error && <div className="history-error">{error}</div>}
        
        <div className="card-grid">
          {items.map((item) => (
            <article key={item.id} className="scan-card" onClick={() => setActiveItem(item)}>
              <div className="scan-card-body">
                <div className="scan-meta">
                  <span className="scan-date">{formatDateTime(item.detectedAt)}</span>
                </div>
                <h3 className="scan-title">{item.weedName}</h3>
                {item.recommendations ? (
                  <p className="scan-preview" title="Click to read full recommendations">
                    {stripMarkdown(item.translatedRecommendations)}
                  </p>
                ) : (
                  <p className="scan-preview muted">{translatedTexts.noRecommendations}</p>
                )}
              </div>
            </article>
          ))}
        </div>

        <div className="history-actions">
          {hasMore && (
            <button className="btn-load" onClick={() => fetchPage(page + 1)} disabled={loading}>
              {loading ? translatedTexts.loading : translatedTexts.loadMore}
            </button>
          )}
          {!hasMore && items.length > 0 && <div className="end-of-list">{translatedTexts.endOfList}</div>}
        </div>

        {loading && items.length === 0 && <div className="history-loading">{translatedTexts.loading}</div>}
        {!loading && items.length === 0 && !error && <div className="history-empty">{translatedTexts.historyEmpty}</div>}

        {activeItem && (
          <div className="modal-backdrop" onClick={() => setActiveItem(null)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <header className="modal-header">
                <div>
                  <div className="modal-date">{formatDateTime(activeItem.detectedAt)}</div>
                  <h3 className="modal-title">{activeItem.weedName}</h3>
                </div>
                <button className="modal-close" onClick={() => setActiveItem(null)} aria-label={translatedTexts.close}>
                  ✕
                </button>
              </header>
              <section className="modal-content">
                {activeItem.recommendations ? (
                  <div className="markdown-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{activeItem.translatedRecommendations}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="muted">{translatedTexts.noRecommendationsModal}</p>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default ScanHistory;