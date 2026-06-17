'use client';

import React, { useContext, useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import "../../styles/dashboard.css";
import {
  FaTachometerAlt,
  FaSearch,
  FaUpload,
  FaHistory,
  FaUserEdit,
  FaSignOutAlt,
} from "react-icons/fa";
import pp from "../../../images/pp.jpeg";
import { LanguageContext } from "../../../context/LanguageContext";

const Sidebar = ({ userName = "Farmer", sidebarOpen, setSidebarOpen }) => {
  const { language, translate } = useContext(LanguageContext);

  const originalTexts = {
    dashboard: "Dashboard",
    scanFields: "Scan Fields",
    uploadImage: "Upload Image",
    scanHistory: "Scan History",
    editProfile: "Edit Profile",
    logout: "Logout",
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
      const results = await Promise.all(
        Object.values(originalTexts).map(t => language === "en" ? t : translateCached(t))
      );
      const updated = {};
      Object.keys(originalTexts).forEach((key, i) => updated[key] = results[i]);
      setTranslatedTexts(updated);
    };
    translateAll();
  }, [language]);

  return (
    <>
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-logo">
          <span className="sidebar-logo-icon">🌾</span>
          <h2>CropIQ</h2>
        </div>

        <div className="profile-section">
          <div className="avatar-container">
            <img src={pp} alt="Profile" className="avatar" />
            <div className="online-indicator"></div>
          </div>
          <h3>{userName}</h3>
        </div>

        <nav className="menu">
          <Link to="/dashboard" className="menu-item" onClick={() => setSidebarOpen(false)}>
            <FaTachometerAlt className="icon" /> {translatedTexts.dashboard}
          </Link>
          <Link to="/scanweeds" className="menu-item" onClick={() => setSidebarOpen(false)}>
            <FaSearch className="icon" /> {translatedTexts.scanFields}
          </Link>
          <Link to="/uploadimage" className="menu-item" onClick={() => setSidebarOpen(false)}>
            <FaUpload className="icon" /> {translatedTexts.uploadImage}
          </Link>
          <Link to="/scanhistory" className="menu-item" onClick={() => setSidebarOpen(false)}>
            <FaHistory className="icon" /> {translatedTexts.scanHistory}
          </Link>
        </nav>

        <div className="bottom-menu">
          <Link to="/dashboard/edit-profile" className="menu-item" onClick={() => setSidebarOpen(false)}>
            <FaUserEdit className="icon" /> {translatedTexts.editProfile}
          </Link>
          <Link to="/" className="menu-item" onClick={() => { localStorage.removeItem("isLoggedIn"); setSidebarOpen(false); }}>
            <FaSignOutAlt className="icon" /> {translatedTexts.logout}
          </Link>
        </div>
      </aside>

      {sidebarOpen && <div className="overlay active" onClick={() => setSidebarOpen(false)} />}
    </>
  );
};

export default Sidebar;
