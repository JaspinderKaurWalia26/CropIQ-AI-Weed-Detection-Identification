'use client';

import React, { useContext, useEffect, useState, useRef } from "react";
import "../../styles/dashboard.css";
import pp from "../../../images/pp.jpeg";
import LanguageSelector from "../LanguageSelector"; 
import { LanguageContext } from "../../../context/LanguageContext";

const Navbar = ({ pageTitle, greeting, userName }) => {
  const { language, translate } = useContext(LanguageContext);
  const name = userName || "Farmer";

  // Original texts
  const originalTexts = {
    greetingText: greeting || "Welcome",
    subtitle: "Here's your farm overview for today",
  };

  const [translatedTexts, setTranslatedTexts] = useState({ ...originalTexts });
  const [loading, setLoading] = useState(false); // ADD THIS LINE
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
      setLoading(true); // ADD THIS LINE
      
      try {
        const keys = Object.keys(originalTexts);
        const results = await Promise.all(keys.map(key => translateCached(originalTexts[key])));
        const updated = {};
        keys.forEach((key, i) => updated[key] = results[i]);
        setTranslatedTexts(updated);
      } catch (err) {
        console.error("Translation error:", err);
      } finally {
        setLoading(false); // ADD THIS LINE
      }
    };
    translateAll();
  }, [language, greeting]);

  const title = pageTitle || `${translatedTexts.greetingText}, ${name}!`;

  return (
    <header className="navbar">
      {/* Translation Loader for Navbar */}
      {loading && (
        <div className="navbar-loader-overlay">
          <div className="navbar-translation-spinner"></div>
          <p>Translating...</p>
        </div>
      )}

      <div className="welcome-section">
        <h2>{title}</h2>
        {!pageTitle && <p>{translatedTexts.subtitle}</p>}
      </div>

      <div className="nav-right">
        <LanguageSelector position="inline" theme="light" />

        <div className="nav-profile">
          <div className="profile-info">
            <span className="profile-name">{name}</span>
            <img src={pp} alt="Profile" className="nav-avatar" />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;