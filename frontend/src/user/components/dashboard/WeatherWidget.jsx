'use client';

import React, { useEffect, useState, useContext, useRef } from "react";
import "../../styles/dashboard.css";
import { WiDaySunnyOvercast } from "react-icons/wi";
import { LanguageContext } from "../../../context/LanguageContext";

const WeatherWidget = () => {
  const { language, translate } = useContext(LanguageContext);
  const translationsCache = useRef({});

  const [weather, setWeather] = useState(null);
  const [error, setError] = useState("");

  const originalTexts = {
    widgetTitle: "Weather Forecast",
    loadingText: "Loading weather...",
    errorLocationDenied: "Location access denied.",
    errorFetch: "Unable to fetch weather data.",
    errorGeoUnsupported: "Geolocation not supported by this browser.",
    humidityLabel: "Humidity",
    windLabel: "Wind",
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

  // Translate static texts whenever language changes
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

  useEffect(() => {
    if (!navigator.geolocation) {
      setError(translatedTexts.errorGeoUnsupported);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        try {
          const apiKey = process.env.REACT_APP_OPENWEATHER_KEY;
          const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
          const response = await fetch(url);
          const data = await response.json();

          setWeather({
            temp: Math.round(data.main.temp),
            condition: data.weather[0].main,
            humidity: data.main.humidity,
            wind: data.wind.speed,
            location: `${data.name}, ${data.sys.country}`,
          });
        } catch (err) {
          setError(translatedTexts.errorFetch);
        }
      },
      () => {
        setError(translatedTexts.errorLocationDenied);
      }
    );
  }, [translatedTexts]); // Re-run if translations change

  return (
    <section className="weather-widget">
      <div className="widget-header">
        <h3>{translatedTexts.widgetTitle}</h3>
        <WiDaySunnyOvercast className="weather-icon" size={50} color="#2e7d32" />
      </div>
      <div className="weather-content">
        {error ? (
          <p>{error}</p>
        ) : weather ? (
          <>
            <div className="weather-main">
              <div className="temperature">{weather.temp}°C</div>
              <div className="weather-condition">{weather.condition}</div>
            </div>
            <div className="weather-details">
              <p><span className="icon location-icon"></span> {weather.location}</p>
              <p><span className="icon humidity-icon"></span> {translatedTexts.humidityLabel}: {weather.humidity}%</p>
              <p><span className="icon wind-icon"></span> {translatedTexts.windLabel}: {weather.wind} km/h</p>
            </div>
          </>
        ) : (
          <p>{translatedTexts.loadingText}</p>
        )}
      </div>
    </section>
  );
};

export default WeatherWidget;
