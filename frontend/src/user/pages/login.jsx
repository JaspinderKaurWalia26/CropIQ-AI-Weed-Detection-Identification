'use client';

import React, { useState, useEffect, useContext, useRef } from "react";
import "../styles/login.css";
import { useNavigate } from "react-router-dom";
import backgroundImage from "../../images/background.jpg";
import API_URL from "../../config.js"; 
import LanguageSelector from "../components/LanguageSelector.jsx";
import { LanguageContext } from "../../context/LanguageContext";

const Login = () => {
  const navigate = useNavigate();
  const { language, translate } = useContext(LanguageContext);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  // Original English texts
  const originalTexts = {
    welcomeTitle: "Welcome to CropIQ",
    welcomeSubtitle: "Smart farming solutions for the modern agriculturist",
    feature1Title: "Weed Detection",
    feature1Desc: "Identify weeds with AI-powered analysis",
    feature2Title: "Crop Analytics",
    feature2Desc: "Monitor crop health and growth patterns",
    feature3Title: "Weather Insights",
    feature3Desc: "Get accurate farm-specific forecasts",
    loginHeader: "Enter your credentials to access the dashboard",
    loginButton: "Login to Dashboard",
    rememberMe: "Remember me",
    signupPrompt: "Not a user?",
    signupText: "Sign Up",
    footerText: "© 2025 CropIQ. All rights reserved.",
    loginFailed: "Login failed. Please check your credentials.",
    loginError: "Something went wrong. Please try again."
  };

  const [translatedTexts, setTranslatedTexts] = useState({ ...originalTexts });

  // Cache translations per language
  const translationsCache = useRef({});

  const translateCached = async (text) => {
    if (language === "en") return text;
    const cacheKey = `${text}_${language}`;
    if (translationsCache.current[cacheKey]) return translationsCache.current[cacheKey];
    const translated = await translate(text);
    translationsCache.current[cacheKey] = translated;
    return translated;
  };

  // Animate left side
  useEffect(() => {
    const timer = setTimeout(() => setAnimate(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Translate texts whenever language changes
  useEffect(() => {
    const translateAll = async () => {
      setLoading(true);
      try{
        const keys = Object.keys(originalTexts);
        const results = await Promise.all(keys.map(key => translateCached(originalTexts[key])));
        const updated = {};
        keys.forEach((key, i) => updated[key] = results[i]);
        setTranslatedTexts(updated);
      }catch (err) {
      console.error("Translation error:", err);
    } finally {
      setLoading(false); 
    }
      };
      translateAll();
    }, [language]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        const msg = data.error || translatedTexts.loginFailed;
        const translatedMsg = await translateCached(msg);
        setError(translatedMsg);
        setIsLoading(false);
        return;
      }

      // Clear previous storage
      [window.localStorage, window.sessionStorage].forEach((s) => {
        ["access_token", "token", "user", "isLoggedIn"].forEach((key) => s.removeItem(key));
      });

      // Save token & user info
      const storage = rememberMe ? window.localStorage : window.sessionStorage;
      storage.setItem("access_token", data.access_token);
      storage.setItem("user", JSON.stringify(data.user));
      storage.setItem("isLoggedIn", "true");

      setIsLoading(false);
      navigate("/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      const translatedMsg = await translateCached(translatedTexts.loginError);
      setError(translatedMsg);
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      {loading && (
      <div className="login-loader-overlay">
        <div className="login-translation-spinner"></div>
        <p>Translating...</p>
      </div>
    )}
      {/* Left side */}
      <div className="login-left">
        <div
          className="login-background"
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            top: 0,
            left: 0,
            backgroundImage: `url(${backgroundImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center 30%",
            backgroundRepeat: "no-repeat",
          }}
        >
          <div className="login-background-overlay"></div>
          <div className={`login-welcome-content ${animate ? "animate" : ""}`}>
            <h1>{translatedTexts.welcomeTitle}</h1>
            <p>{translatedTexts.welcomeSubtitle}</p>
            <div className="login-feature-list">
              <div className="login-feature">
                <div className="login-feature-icon-container"><span className="signup-feature-icon">🌱</span></div>
                <div className="login-feature-text">
                  <h4>{translatedTexts.feature1Title}</h4>
                  <p>{translatedTexts.feature1Desc}</p>
                </div>
              </div>
              <div className="login-feature">
                <div className="login-feature-icon-container"><span className="login-feature-icon">📊</span></div>
                <div className="login-feature-text">
                  <h4>{translatedTexts.feature2Title}</h4>
                  <p>{translatedTexts.feature2Desc}</p>
                </div>
              </div>
              <div className="login-feature">
                <div className="login-feature-icon-container"><span className="login-feature-icon">🌦️</span></div>
                <div className="login-feature-text">
                  <h4>{translatedTexts.feature3Title}</h4>
                  <p>{translatedTexts.feature3Desc}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side form */}
      <div className="login-right">
        <div className="login-card">
          <LanguageSelector position="top-right" theme="light" />

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-logo">
              <span className="login-logo-icon">🌾</span>
              <h2>CropIQ</h2>
            </div>

            <h3>{translatedTexts.loginHeader}</h3>

            <div className="login-form-group">
              <label htmlFor="email">Email</label>
              <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <div className="login-form-group">
              <label htmlFor="password">Password</label>
              <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>

            {error && <p className="login-error">{error}</p>}

            <div className="login-form-options">
              <label className="login-remember-me">
                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                <span>{translatedTexts.rememberMe}</span>
              </label>
            </div>

            <button type="submit" className={`login-button ${isLoading ? "loading" : ""}`} disabled={isLoading}>
              {isLoading ? <div className="login-spinner"></div> : translatedTexts.loginButton}
            </button>

            <div className="login-signup-link">
              {translatedTexts.signupPrompt} <a href="/signup">{translatedTexts.signupText}</a>
            </div>
          </form>

          <div className="login-footer">
            <p>{translatedTexts.footerText}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
