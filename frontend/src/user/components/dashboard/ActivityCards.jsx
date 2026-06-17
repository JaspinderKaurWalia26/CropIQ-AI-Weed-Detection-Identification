'use client';

import React, { useContext, useEffect, useState, useRef } from "react";
import "../../styles/dashboard.css";

import { AiOutlineScan } from "react-icons/ai"; // Total Scans
import { GiGrass } from "react-icons/gi";       // Weeds Detected
import { LanguageContext } from "../../../context/LanguageContext";

const ActivityCards = ({ activeCard, handleCardClick, detectedCount = 0, totalCount = 0 }) => {
  const { language, translate } = useContext(LanguageContext);

  // Original texts
  const originalTexts = {
    weedsDetected: "Weeds Detected",
    totalScans: "Total Scans",
  };

  const [translatedTexts, setTranslatedTexts] = useState({ ...originalTexts });
  const translationsCache = useRef({});

  const translateCached = async (text) => {
    if (language === "en") return text;
    const cacheKey = `${text}_${language}`;
    if (translationsCache.current[cacheKey]) return translationsCache.current[cacheKey];
    const translated = await translate(text);
    translationsCache.current[cacheKey] = translated;
    return translated;
  };

  useEffect(() => {
    const translateAll = async () => {
      const keys = Object.keys(originalTexts);
      const results = await Promise.all(keys.map(key => translateCached(originalTexts[key])));
      const updated = {};
      keys.forEach((key, i) => updated[key] = results[i]);
      setTranslatedTexts(updated);
    };
    translateAll();
  }, [language]);

  return (
    <section className="activity-cards">
      <div
        className={`card ${activeCard === 0 ? "active" : ""}`}
        onClick={() => handleCardClick(0)}
      >
        <GiGrass className="card-icon weeds-icon" />
        <div className="card-content">
          <h4>{translatedTexts.weedsDetected}</h4>
          <span className="count">{detectedCount}</span>
        </div>
      </div>

      <div
        className={`card ${activeCard === 1 ? "active" : ""}`}
        onClick={() => handleCardClick(1)}
      >
        <AiOutlineScan className="card-icon scans-icon" />
        <div className="card-content">
          <h4>{translatedTexts.totalScans}</h4>
          <span className="count">{totalCount}</span>
        </div>
      </div>
    </section>
  );
};

export default ActivityCards;
