import { createContext, useState, useEffect, useRef } from "react";
import API_URL from "../config";

export const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  // Load initial language from localStorage if exists
  const initialLang = localStorage.getItem("language") || "en";
  const [language, setLanguage] = useState(initialLang);

  // Cache translations in memory
  const translationsCache = useRef({});

  // Function to translate text with caching
  const translate = async (text) => {
    if (language === "en") return text; // No translation for English

    const cacheKey = `${text}_${language}`;
    if (translationsCache.current[cacheKey]) {
      return translationsCache.current[cacheKey]; // Return cached
    }

    try {
      const response = await fetch(`${API_URL}/api/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, target_lang: language }),
      });

      const data = await response.json();
      if (data.translated_text) {
        translationsCache.current[cacheKey] = data.translated_text; // Update cache
        return data.translated_text;
      }
      return text; // fallback
    } catch (err) {
      console.error("Translation error:", err);
      return text; // fallback
    }
  };

  // Change language and persist to localStorage
  const changeLanguage = (lang) => {
    if (lang !== language) {
      setLanguage(lang);
      localStorage.setItem("language", lang);
    }
  };

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, translate }}>
      {children}
    </LanguageContext.Provider>
  );
};
