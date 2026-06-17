'use client';

import React, { useEffect, useState, useContext } from "react";
import Sidebar from "./Sidebar";
import CropAssistant from "./CropAssistant";
import Navbar from "./Navbar";
import { FaBars } from "react-icons/fa";
import "../../styles/dashboard.css";
import { LanguageContext } from "../../../context/LanguageContext"; // ✅ Import context

const Layout = ({ children }) => {
  const { language } = useContext(LanguageContext); // ✅ Get current language
  const [userName, setUserName] = useState("Farmer");
  const [greeting, setGreeting] = useState("Welcome");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user") || sessionStorage.getItem("user");
      if (raw) {
        const u = JSON.parse(raw);
        const name = u?.first_name || u?.firstName || u?.username || u?.email || "Farmer";
        setUserName(name);
      }
    } catch {}

    const computeGreetingIST = () => {
      const now = new Date();
      const hoursIST = Number(
        new Intl.DateTimeFormat("en-IN", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })
          .format(now)
      );
      if (hoursIST < 12) return "Good Morning";
      if (hoursIST < 17) return "Good Afternoon";
      return "Good Evening";
    };
    setGreeting(computeGreetingIST());
  }, []);

  return (
    <div className="dashboard-container">
      {/* Mobile Menu Toggle Button */}
      <button 
        className="mobile-menu-toggle" 
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle Menu"
      >
        <FaBars />
      </button>

      {/* Sidebar with mobile support */}
      <Sidebar 
        userName={userName} 
        sidebarOpen={sidebarOpen} 
        setSidebarOpen={setSidebarOpen}
      />

      <main className="main-content">
        {/* Navbar now responds to language context */}
        <Navbar userName={userName} greeting={greeting} />
        {children}
      </main>
      
      {/* Right Sidebar: Crop Assistant also responds to language context */}
      <aside className="right-sidebar">
        <CropAssistant />
      </aside>
    </div>
  );
};

export default Layout;
