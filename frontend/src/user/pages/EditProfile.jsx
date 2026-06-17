import React, { useEffect, useState, useRef, useContext } from "react";
import { useNavigate } from "react-router-dom";
import API_URL from "../../config";
import Layout from "../components/dashboard/Layout";
import "../styles/EditProfile.css";
import { LanguageContext } from "../../context/LanguageContext";

const EditProfile = () => {
  const { language, translate } = useContext(LanguageContext);
  const translationsCache = useRef({});

  const navigate = useNavigate();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [translating, setTranslating] = useState(false); // ADD THIS LINE

  const getStorage = () => (localStorage.getItem("access_token") ? localStorage : sessionStorage);
  const token = (localStorage.getItem("access_token") || sessionStorage.getItem("access_token")) ?? "";

  // Original texts for UI
  const originalTexts = {
    pageTitle: "Edit Profile",
    loadingProfile: "Loading profile...",
    firstName: "First Name",
    lastName: "Last Name",
    username: "Username",
    email: "Email",
    emailHelp: "Email cannot be changed.",
    saveChanges: "Save Changes",
    saving: "Saving...",
    profileUpdated: "Profile updated successfully",
  };

  const [translatedTexts, setTranslatedTexts] = useState({ ...originalTexts });

  // Cached translation helper
  const translateCached = async (text) => {
    if (!text) return "";
    if (language === "en") return text;
    const cacheKey = `${text}_${language}`;
    if (translationsCache.current[cacheKey]) return translationsCache.current[cacheKey];
    const translated = await translate(text);
    translationsCache.current[cacheKey] = translated;
    return translated;
  };

  // Translate UI texts on language change
  useEffect(() => {
    const translateAll = async () => {
      setTranslating(true); // ADD THIS LINE
      
      try {
        const keys = Object.keys(originalTexts);
        const results = await Promise.all(keys.map(k => translateCached(originalTexts[k])));
        const updated = {};
        keys.forEach((key, i) => updated[key] = results[i]);
        setTranslatedTexts(updated);
      } catch (err) {
        console.error("Translation error:", err);
      } finally {
        setTranslating(false); // ADD THIS LINE
      }
    };
    translateAll();
  }, [language]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!token) {
        navigate("/", { replace: true });
        return;
      }
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_URL}/api/auth/profile`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.status === 401) {
          getStorage().removeItem("access_token");
          getStorage().removeItem("user");
          getStorage().removeItem("isLoggedIn");
          navigate("/", { replace: true });
          return;
        }

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load profile");

        const u = data?.user || {};
        setForm({
          first_name: u.first_name || "",
          last_name: u.last_name || "",
          username: u.username || "",
          email: u.email || "",
        });
      } catch (e) {
        setError(e.message || "Something went wrong loading profile");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [token, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        username: form.username,
      };

      const res = await fetch(`${API_URL}/api/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.status === 401) {
        getStorage().removeItem("access_token");
        getStorage().removeItem("user");
        getStorage().removeItem("isLoggedIn");
        navigate("/", { replace: true });
        return;
      }
      if (!res.ok) throw new Error(data?.error || "Failed to update profile");

      getStorage().setItem("user", JSON.stringify(data.user));
      setSuccess(translatedTexts.profileUpdated);

      setTimeout(() => navigate("/dashboard"), 1000);
    } catch (e) {
      setError(e.message || "Something went wrong while saving");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="edit-profile-loading">
          <div className="loading-spinner"></div>
          <p>{translatedTexts.loadingProfile}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Translation Loader Overlay */}
      {translating && (
        <div className="editprofile-loader-overlay">
          <div className="editprofile-translation-spinner"></div>
          <p>Translating...</p>
        </div>
      )}

      <div className="edit-profile-container">
        <div className="edit-profile-card">
          <div className="edit-profile-header">
            <h2>{translatedTexts.pageTitle}</h2>
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <form onSubmit={handleSubmit} className="edit-profile-form">
            <div className="form-group">
              <label htmlFor="first_name" className="form-label">{translatedTexts.firstName}</label>
              <input
                id="first_name"
                name="first_name"
                type="text"
                value={form.first_name}
                onChange={handleChange}
                required
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="last_name" className="form-label">{translatedTexts.lastName}</label>
              <input
                id="last_name"
                name="last_name"
                type="text"
                value={form.last_name}
                onChange={handleChange}
                required
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="username" className="form-label">{translatedTexts.username}</label>
              <input
                id="username"
                name="username"
                type="text"
                value={form.username}
                onChange={handleChange}
                required
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="email" className="form-label">{translatedTexts.email}</label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                disabled
                className="form-input disabled"
              />
              <small className="form-help">{translatedTexts.emailHelp}</small>
            </div>

            <button
              type="submit"
              disabled={saving}
              className={`submit-btn ${saving ? "loading" : ""}`}
            >
              {saving ? (
                <>
                  <div className="btn-spinner"></div>
                  {translatedTexts.saving}
                </>
              ) : (
                translatedTexts.saveChanges
              )}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default EditProfile;