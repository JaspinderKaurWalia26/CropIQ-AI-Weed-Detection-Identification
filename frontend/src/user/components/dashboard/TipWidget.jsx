'use client';

import React, { useContext, useEffect, useState, useRef } from "react";
import { AiOutlineInfoCircle } from "react-icons/ai";
import "../../styles/dashboard.css";
import { LanguageContext } from "../../../context/LanguageContext";

const TipWidget = () => {
  const { language, translate } = useContext(LanguageContext);
  const translationsCache = useRef({});

  const originalTexts = {
    widgetTitle: "Tip of the Day",
    loading: "Loading tip...",
    readMore: "Read More",
    fetchError: "Unable to fetch tip today."
  };
  const [translatedTexts, setTranslatedTexts] = useState({ ...originalTexts });

  const [tip, setTip] = useState(null);
  const fetched = useRef(false);

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
      const results = await Promise.all(
        Object.values(originalTexts).map(t => language === "en" ? t : translateCached(t))
      );
      const updated = {};
      Object.keys(originalTexts).forEach((key, i) => updated[key] = results[i]);
      setTranslatedTexts(updated);

      // Re-translate tip
      if (tip && tip.original) {
        const translatedTip = language === "en" ? tip.original : await translateCached(tip.original);
        setTip(prev => ({ ...prev, firstLine: translatedTip }));
      }
    };
    translateAll();
  }, [language]);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;

    const fetchTip = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/tip-of-the-day");
        const data = await response.json();
        const fetchedTip = {
          firstLine: data.firstLine || data.tip,
          original: data.firstLine || data.tip, // store original for re-translation
          speciesId: data.speciesId || null
        };

        // Translate if necessary
        fetchedTip.firstLine = language === "en" ? fetchedTip.original : await translateCached(fetchedTip.original);
        setTip(fetchedTip);
      } catch (err) {
        console.error(err);
        setTip({
          firstLine: translatedTexts.fetchError,
          original: translatedTexts.fetchError,
          speciesId: null
        });
      }
    };

    fetchTip();
  }, [language]);

  return (
    <section className="tip-widget">
      <div className="widget-header">
        <h3>{translatedTexts.widgetTitle}</h3>
        <AiOutlineInfoCircle className="tip-icon" size={50} color="#2e7d32" />
      </div>
      <div className="tip-content">
        <p>{tip ? tip.firstLine : translatedTexts.loading}</p>
        {tip && tip.speciesId && (
          <button
            className="read-more-btn"
            onClick={() =>
              window.open(
                `https://perenual.com/plant-database-search-guide/species/${tip.speciesId}/guide`,
                "_blank"
              )
            }
          >
            {translatedTexts.readMore}
          </button>
        )}
      </div>
    </section>
  );
};

export default TipWidget;
