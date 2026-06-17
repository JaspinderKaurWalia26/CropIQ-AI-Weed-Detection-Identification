'use client';

import React, { useEffect, useState, useRef, useContext } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/dashboard.css";
import { AiOutlineHistory } from "react-icons/ai";
import { LanguageContext } from "../../../context/LanguageContext";

const HistoryWidget = ({ recentWeeds = [] }) => {
  const navigate = useNavigate();
  const { language, translate } = useContext(LanguageContext);

  const [translatedWeeds, setTranslatedWeeds] = useState([]);
  const translationsCache = useRef({});

  const originalTexts = {
    widgetTitle: "Recent Scans",
    emptyText: "No recent detections.",
    detectedLabel: "Detected •",
    viewAllBtn: "View All Scans"
  };
  const [translatedTexts, setTranslatedTexts] = useState({ ...originalTexts });

  const translateCached = async (text) => {
    if (language === "en") return text;
    const cacheKey = `${text}_${language}`;
    if (translationsCache.current[cacheKey]) return translationsCache.current[cacheKey];
    const translated = await translate(text);
    translationsCache.current[cacheKey] = translated;
    return translated;
  };

  // Translate static texts & recent weeds whenever language changes
  useEffect(() => {
    const translateAll = async () => {
      // Translate static texts
      const results = await Promise.all(Object.values(originalTexts).map(t => translateCached(t)));
      const updatedTexts = {};
      Object.keys(originalTexts).forEach((key, i) => updatedTexts[key] = results[i]);
      setTranslatedTexts(updatedTexts);

      // Translate recent weed names
      const weedNames = await Promise.all(recentWeeds.map(async (w) => ({
        ...w,
        weedName: await translateCached(w.weedName)
      })));
      setTranslatedWeeds(weedNames);
    };
    translateAll();
  }, [language, recentWeeds]);

  const fmt = (value) => {
    try {
      const dt = new Date(value);
      return new Intl.DateTimeFormat("en-IN", {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      }).format(dt);
    } catch {
      return String(value);
    }
  };

  return (
    <section className="history-widget">
      <div className="widget-header">
        <h3>{translatedTexts.widgetTitle}</h3>
        <AiOutlineHistory className="history-icon" size={50} color="#2e7d32" />
      </div>
      <div className="history-list">
        {translatedWeeds.length === 0 ? (
          <div className="history-empty">{translatedTexts.emptyText}</div>
        ) : (
          translatedWeeds.slice(0, 5).map((item) => (
            <div key={item.id} className="history-item">
              <div className="status-indicator warning"></div>
              <div className="history-details">
                <p>{item.weedName}</p>
                <span>{translatedTexts.detectedLabel} {fmt(item.detectedAt)}</span>
              </div>
            </div>
          ))
        )}
      </div>
      <button className="view-all-btn" onClick={() => navigate("/scanhistory")}>
        {translatedTexts.viewAllBtn}
      </button>
    </section>
  );
};

export default HistoryWidget;
