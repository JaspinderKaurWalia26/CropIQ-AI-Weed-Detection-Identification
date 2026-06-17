import React, { useState, useEffect, useContext, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/dashboard/Sidebar";
import Navbar from "../components/dashboard/Navbar";
import WeatherWidget from "../components/dashboard/WeatherWidget";
import TipWidget from "../components/dashboard/TipWidget";
import ActivityCards from "../components/dashboard/ActivityCards";
import HistoryWidget from "../components/dashboard/HistoryWidget";
import CropAssistant from "../components/dashboard/CropAssistant";
import { FaBars } from "react-icons/fa";
import "../styles/dashboard.css";
import { LanguageContext } from "../../context/LanguageContext";

const Dashboard = () => {
  const navigate = useNavigate();
  const { language, translate } = useContext(LanguageContext);
  const translationsCache = useRef({});

  const [activeCard, setActiveCard] = useState(null);
  const [userName, setUserName] = useState("Farmer");
  const [greeting, setGreeting] = useState("Welcome");
  const [stats, setStats] = useState({ total_scans: 0, detected_scans: 0 });
  const [recentWeeds, setRecentWeeds] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Static texts
  const originalTexts = {
    widgetsRow: "Widgets Row",
    historyRow: "History Row",
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

  useEffect(() => {
    const translateAll = async () => {
      const keys = Object.keys(originalTexts);
      const results = await Promise.all(keys.map(k => translateCached(originalTexts[k])));
      const updated = {};
      keys.forEach((key, i) => updated[key] = results[i]);
      setTranslatedTexts(updated);
    };
    translateAll();
  }, [language]);

  const API_BASE = process.env.REACT_APP_API_BASE || "http://127.0.0.1:5000";
  const getToken = () =>
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("access_token") ||
    sessionStorage.getItem("token");

  const computeGreetingIST = () => {
    const now = new Date();
    const hoursIST = Number(
      new Intl.DateTimeFormat("en-IN", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }).format(now)
    );
    if (hoursIST < 12) return "Good Morning";
    if (hoursIST < 17) return "Good Afternoon";
    return "Good Evening";
  };

  useEffect(() => {
    const isLoggedIn =
      localStorage.getItem("isLoggedIn") === "true" ||
      sessionStorage.getItem("isLoggedIn") === "true";
    if (!isLoggedIn) navigate("/");

    try {
      const raw = localStorage.getItem("user") || sessionStorage.getItem("user");
      if (raw) {
        const u = JSON.parse(raw);
        const name = u?.first_name || u?.firstName || u?.username || u?.email || "Farmer";
        setUserName(name);
      }
    } catch {}

    setGreeting(computeGreetingIST());
  }, [navigate]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    (async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/scan/stats`, { headers: { Authorization: `Bearer ${token}` } });
        const payload = await resp.json();
        if (resp.ok) setStats({ total_scans: payload.total_scans || 0, detected_scans: payload.detected_scans || 0 });
      } catch {}
    })();

    (async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/scan/history?page=1&per_page=5`, { headers: { Authorization: `Bearer ${token}` } });
        const payload = await resp.json();
        if (resp.ok) {
          const items = (payload.items || []).map((h) => ({
            id: h.id,
            weedName: h.weed_name || h.weedName || "Detected Weed",
            detectedAt: h.detected_at || h.detectedAt || h.dateTime,
          }));
          setRecentWeeds(items);
        }
      } catch {}
    })();
  }, []);

  const handleCardClick = (index) => {
    setActiveCard(index === activeCard ? null : index);
  };

  return (
    <div className="dashboard-container">
      <button className="mobile-menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle Menu">
        <FaBars />
      </button>

      <Sidebar userName={userName} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <main className="main-content">
        <Navbar greeting={greeting} userName={userName} />

        {/* Dashboard widgets */}
        <div className="widgets-row">
          <WeatherWidget />
          <TipWidget />
        </div>

        <ActivityCards
          activeCard={activeCard}
          handleCardClick={handleCardClick}
          detectedCount={stats.detected_scans}
          totalCount={stats.total_scans}
        />

        <div className="history-row">
          <HistoryWidget recentWeeds={recentWeeds} />
        </div>
      </main>

      <aside className="right-sidebar">
        <CropAssistant />
      </aside>
    </div>
  );
};

export default Dashboard;
