'use client';

import React, { useState, useEffect, useContext, useRef } from "react";
import "../styles/signup.css";
import { useNavigate, Link } from "react-router-dom";
import backgroundImage from "../../images/background.jpg";
import API_URL from "../../config.js";
import LanguageSelector from "../components/LanguageSelector.jsx";
import { LanguageContext } from "../../context/LanguageContext";

const Signup = () => {
  const navigate = useNavigate();
  const { language, translate } = useContext(LanguageContext);

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [loading, setLoading] = useState(false);

  // Original English texts
  const originalTexts = {
    welcomeTitle: "Join CropIQ",
    welcomeSubtitle: "Become part of the smart farming revolution",
    feature1Title: "Precision Agriculture",
    feature1Desc: "AI-powered insights for better yields",
    feature2Title: "Data Analytics",
    feature2Desc: "Monitor and optimize your farm's performance",
    feature3Title: "Secure & Private",
    feature3Desc: "Your data is always protected",
    signupHeader: "Create your account to get started",
    createButton: "Create Account",
    loginPrompt: "Already have an account?",
    loginText: "Login",
    footerText: "© 2025 CropIQ. All rights reserved.",
    firstNamePlaceholder: "Enter your first name",
    lastNamePlaceholder: "Enter your last name",
    usernamePlaceholder: "Choose a username",
    emailPlaceholder: "Enter your email",
    passwordPlaceholder: "Enter your password",
    confirmPasswordPlaceholder: "Confirm your password",
    passwordsMismatch: "Passwords do not match!",
    registerFailed: "Failed to register user",
    registerError: "Registration failed. Please try again.",
    registerSuccess: "Registration successful! Redirecting to login..."
  };

  const [translatedTexts, setTranslatedTexts] = useState({ ...originalTexts });

  // Cache translations
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

  // Translate texts when language changes
  useEffect(() => {
    const translateAll = async () => {
      setLoading(true);
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
}, [language]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      const translatedMsg = await translateCached(translatedTexts.passwordsMismatch);
      alert(translatedMsg);
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: formData.first_name,
          last_name: formData.last_name,
          username: formData.username,
          email: formData.email,
          password: formData.password,
        }),
      });

      if (!res.ok) {
        const translatedMsg = await translateCached(translatedTexts.registerFailed);
        throw new Error(translatedMsg);
      }

      const data = await res.json();

      if (data?.access_token) localStorage.setItem("access_token", data.access_token);
      if (data?.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
        localStorage.setItem("isLoggedIn", "true");
      }

      setIsLoading(false);

      const successMsg = await translateCached(translatedTexts.registerSuccess);
      alert(successMsg);

      navigate("/login");
    } catch (err) {
      console.error("Registration error:", err);
      setIsLoading(false);

      const translatedMsg = await translateCached(err.message || translatedTexts.registerError);
      alert(translatedMsg);
    }
  };

  return (
    <div className="signup-container">
      {loading && (
      <div className="signup-loader-overlay">
        <div className="signup-translation-spinner"></div>
        <p>Translating...</p>
      </div>
    )}
      {/* Left side */}
      <div className="signup-left">
        <div
          className="login-background"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        >
          <div className="signup-background-overlay"></div>
        </div>
        <div className={`signup-welcome-content ${animate ? "animate" : ""}`}>
          <h1>{translatedTexts.welcomeTitle}</h1>
          <p>{translatedTexts.welcomeSubtitle}</p>
          <div className="signup-feature-list">
            <div className="signup-feature">
              <div className="signup-feature-icon-container"><span className="signup-feature-icon">🌱</span></div>
              <div className="signup-feature-text">
                <h4>{translatedTexts.feature1Title}</h4>
                <p>{translatedTexts.feature1Desc}</p>
              </div>
            </div>
            <div className="signup-feature">
              <div className="signup-feature-icon-container"><span className="signup-feature-icon">📊</span></div>
              <div className="signup-feature-text">
                <h4>{translatedTexts.feature2Title}</h4>
                <p>{translatedTexts.feature2Desc}</p>
              </div>
            </div>
            <div className="signup-feature">
              <div className="signup-feature-icon-container"><span className="signup-feature-icon">🔒</span></div>
              <div className="signup-feature-text">
                <h4>{translatedTexts.feature3Title}</h4>
                <p>{translatedTexts.feature3Desc}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side */}
      <div className="signup-right">
        <div className="signup-form-container">
          <LanguageSelector position="top-right" theme="light" />
          <form className="signup-form" onSubmit={handleSubmit}>
            <div className="signup-logo">
              <span className="signup-logo-icon">🌾</span>
              <h2>CropIQ</h2>
            </div>

            <h3>{translatedTexts.signupHeader}</h3>

            <div className="signup-form-fields">
              <div className="signup-form-group">
                <label htmlFor="first_name">First Name</label>
                <input type="text" name="first_name" id="first_name"
                  placeholder={translatedTexts.firstNamePlaceholder}
                  value={formData.first_name} onChange={handleChange} required />
              </div>

              <div className="signup-form-group">
                <label htmlFor="last_name">Last Name</label>
                <input type="text" name="last_name" id="last_name"
                  placeholder={translatedTexts.lastNamePlaceholder}
                  value={formData.last_name} onChange={handleChange} required />
              </div>

              <div className="signup-form-group">
                <label htmlFor="username">Username</label>
                <input type="text" name="username" id="username"
                  placeholder={translatedTexts.usernamePlaceholder}
                  value={formData.username} onChange={handleChange} required />
              </div>

              <div className="signup-form-group">
                <label htmlFor="email">Email</label>
                <input type="email" name="email" id="email"
                  placeholder={translatedTexts.emailPlaceholder}
                  value={formData.email} onChange={handleChange} required />
              </div>

              <div className="signup-form-group">
                <label htmlFor="password">Password</label>
                <input type="password" name="password" id="password"
                  placeholder={translatedTexts.passwordPlaceholder}
                  value={formData.password} onChange={handleChange} required />
              </div>

              <div className="signup-form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input type="password" name="confirmPassword" id="confirmPassword"
                  placeholder={translatedTexts.confirmPasswordPlaceholder}
                  value={formData.confirmPassword} onChange={handleChange} required />
              </div>
            </div>

            <button type="submit" className={`signup-button ${isLoading ? "loading" : ""}`} disabled={isLoading}>
              {isLoading ? <div className="signup-spinner"></div> : translatedTexts.createButton}
            </button>

            <div className="signup-login-link">
              {translatedTexts.loginPrompt} <Link to="/login">{translatedTexts.loginText}</Link>
            </div>
          </form>
        </div>

        <div className="signup-footer">
          <p>{translatedTexts.footerText}</p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
