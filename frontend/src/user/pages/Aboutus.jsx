'use client';

import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Leaf, Cpu, Camera, Globe, TrendingUp, Users, Target, Zap, Shield, BarChart3 } from 'lucide-react';
import '../styles/AboutUs.css';
import backgroundImage from '../../images/background.jpg';
import LanguageSelector from '../components/LanguageSelector';
import { LanguageContext } from '../../context/LanguageContext';

const AboutUs = () => {
  const navigate = useNavigate();
  const { language, translate } = useContext(LanguageContext);
  const [animate, setAnimate] = useState(false);
  const [loading, setLoading] = useState(false);

  // Translated states
  const [translatedHero, setTranslatedHero] = useState({});
  const [translatedFeatures, setTranslatedFeatures] = useState([]);
  const [translatedIntroCards, setTranslatedIntroCards] = useState([]);
  const [translatedTechnology, setTranslatedTechnology] = useState({});
  const [translatedVision, setTranslatedVision] = useState({});
  const [translatedFooter, setTranslatedFooter] = useState({});
  const [translatedIntroTitle, setTranslatedIntroTitle] = useState("");
  const [translatedFeaturesHeader, setTranslatedFeaturesHeader] = useState("");
  const [translatedFeaturesSub, setTranslatedFeaturesSub] = useState("");

  // Cache translations per text + language
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
    const timer = setTimeout(() => setAnimate(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const goToLogin = () => navigate('/login');

  // Original content
  const heroText = {
    title: "CropIQ",
    subtitle: "Empowering Agriculture through Precision Weed Identification",
    description: "Transforming traditional farming with cutting-edge AI technology to help farmers identify, manage, and eliminate weeds efficiently while promoting sustainable agricultural practices.",
    loginButton: "Go to Login"
  };

  const features = [
    { icon: <Zap />, title: "Real-Time Weed Detection", description: "Instantly identify weeds using advanced AI technology with high accuracy and speed." },
    { icon: <Camera />, title: "Camera & Upload Support", description: "Capture images directly or upload existing photos for immediate weed analysis." },
    { icon: <Globe />, title: "Multilingual Support", description: "Access CropIQ in multiple languages to serve farmers across diverse regions." },
    { icon: <Leaf />, title: "Eco-Friendly Solutions", description: "Get sustainable weed management recommendations that protect your crops and environment." },
    { icon: <BarChart3 />, title: "Farmer-Friendly Dashboard", description: "Intuitive interface designed specifically for farmers with clear insights and actionable data." },
    { icon: <Shield />, title: "Precision Agriculture", description: "Reduce herbicide usage and costs with targeted weed identification and treatment plans." }
  ];

  const introCards = [
    { icon: <Users size={48} />, title: "Built for Farmers", description: "CropIQ is designed with farmers at its heart, providing an accessible and powerful tool that simplifies weed management and enhances crop productivity." },
    { icon: <Target size={48} />, title: "Precision Focused", description: "Our mission is to deliver accurate, real-time weed identification that enables targeted interventions and reduces unnecessary chemical usage." },
    { icon: <TrendingUp size={48} />, title: "Sustainable Growth", description: "We believe in farming practices that protect the environment while maximizing yields and profitability for future generations." }
  ];

  const technologyText = {
    heading: "Advanced AI Technology",
    subheading: "Powered by cutting-edge deep learning models",
    model: "Hybrid Deep Learning Model",
    description: "CropIQ leverages a hybrid deep learning architecture combining YOLOv9 and YOLOv11 models to achieve unprecedented accuracy in weed detection. Real-time processing identifies multiple weed species simultaneously.",
    stats: { detection: "Detection Accuracy", processing: "Processing Time", species: "Weed Species" },
    footer: "The hybrid architecture ensures robust performance across small farms and large-scale operations."
  };

  const visionText = {
    heading: "Our Vision",
    description: "At CropIQ, we envision a future where every farmer has access to intelligent, affordable, and sustainable weed management solutions. We're committed to bridging the gap between traditional farming wisdom and modern technology."
  };

  const footerText = {
    logo: "CropIQ",
    tagline: "Precision Weed Identification for Sustainable Agriculture"
  };

  const inlineTexts = {
    introTitle: "Why Choose CropIQ?",
    featuresHeader: "Key Features",
    featuresSub: "Comprehensive tools designed to make weed management effortless and effective"
  };

  // Translate everything when language changes
  useEffect(() => {
    const translateAll = async () => {
      setLoading(true);

      try {
        const heroPromise = Promise.all(Object.values(heroText).map(translateCached));
        const featuresPromise = Promise.all(features.map(f => Promise.all([translateCached(f.title), translateCached(f.description)])));
        const introPromise = Promise.all(introCards.map(c => Promise.all([translateCached(c.title), translateCached(c.description)])));
        const techPromise = Promise.all([
          translateCached(technologyText.heading),
          translateCached(technologyText.subheading),
          translateCached(technologyText.model),
          translateCached(technologyText.description),
          translateCached(technologyText.stats.detection),
          translateCached(technologyText.stats.processing),
          translateCached(technologyText.stats.species),
          translateCached(technologyText.footer)
        ]);
        const visionPromise = Promise.all([translateCached(visionText.heading), translateCached(visionText.description)]);
        const footerPromise = Promise.all([translateCached(footerText.logo), translateCached(footerText.tagline)]);
        const inlinePromise = Promise.all([translateCached(inlineTexts.introTitle), translateCached(inlineTexts.featuresHeader), translateCached(inlineTexts.featuresSub)]);

        const [heroTrans, featuresTrans, introTrans, techTrans, visionTrans, footerTrans, inlineTrans] = await Promise.all([
          heroPromise, featuresPromise, introPromise, techPromise, visionPromise, footerPromise, inlinePromise
        ]);

        setTranslatedHero({
          title: heroTrans[0],
          subtitle: heroTrans[1],
          description: heroTrans[2],
          loginButton: heroTrans[3]
        });

        setTranslatedFeatures(features.map((f, i) => ({
          ...f,
          title: featuresTrans[i][0],
          description: featuresTrans[i][1]
        })));

        setTranslatedIntroCards(introCards.map((c, i) => ({
          ...c,
          title: introTrans[i][0],
          description: introTrans[i][1]
        })));

        setTranslatedTechnology({
          heading: techTrans[0],
          subheading: techTrans[1],
          model: techTrans[2],
          description: techTrans[3],
          stats: { detection: techTrans[4], processing: techTrans[5], species: techTrans[6] },
          footer: techTrans[7]
        });

        setTranslatedVision({ heading: visionTrans[0], description: visionTrans[1] });
        setTranslatedFooter({ logo: footerTrans[0], tagline: footerTrans[1] });
        setTranslatedIntroTitle(inlineTrans[0]);
        setTranslatedFeaturesHeader(inlineTrans[1]);
        setTranslatedFeaturesSub(inlineTrans[2]);

      } catch (err) {
        console.error("Translation error:", err);
      } finally {
        setLoading(false);
      }
    };

    translateAll();
  }, [language]);

  return (
    <div className="about-container">
      <LanguageSelector position="top-right" theme="light" />

      {/* Loader */}
      {loading && (
        <div className="loader-overlay">
          <div className="spinner"></div>
          <p>Translating...</p>
        </div>
      )}

      {/* Background */}
      <div className="about-full-background" style={{ backgroundImage: `url(${backgroundImage})` }}>
        <div className="about-full-overlay"></div>
      </div>

      {/* Hero Section */}
      <section className="about-hero-section">
        <div className={`about-hero-content ${animate ? "animate" : ""}`}>
          <div className="about-hero-icon"><Leaf size={60} /></div>
          <h1>{translatedHero.title}</h1>
          <p className="about-hero-subtitle">{translatedHero.subtitle}</p>
          <p className="about-hero-description">{translatedHero.description}</p>
          <button className="about-login-btn" onClick={goToLogin}>{translatedHero.loginButton}</button>
        </div>
      </section>

      {/* Intro Cards */}
      <section className="about-intro-section">
        <div className="about-section-content">
          <h2 className="about-intro-title">{translatedIntroTitle}</h2>
          <div className="about-intro-grid">
            {translatedIntroCards.map((card, index) => (
              <div key={index} className={`about-intro-card ${animate ? "animate" : ""}`} style={{ animationDelay: `${0.2 + index * 0.15}s` }}>
                <div className="about-intro-icon">{card.icon}</div>
                <div className="about-intro-text">
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Technology Section */}
      <section className="about-section about-technology">
        <div className="about-section-content">
          <div className="about-section-header">
            <Cpu size={40} className="about-section-icon" />
            <h2>{translatedTechnology.heading}</h2>
            <p>{translatedTechnology.subheading}</p>
          </div>
          <div className="about-tech-card">
            <div className="about-tech-content">
              <h3>{translatedTechnology.model}</h3>
              <p>{translatedTechnology.description}</p>
              <div className="about-tech-stats">
                <div className="about-tech-stat"><div className="about-tech-number">95%+</div><div className="about-tech-label">{translatedTechnology.stats?.detection}</div></div>
                <div className="about-tech-stat"><div className="about-tech-number">&lt;5s</div><div className="about-tech-label">{translatedTechnology.stats?.processing}</div></div>
                <div className="about-tech-stat"><div className="about-tech-number">20+</div><div className="about-tech-label">{translatedTechnology.stats?.species}</div></div>
              </div>
              <p className="about-tech-footer">{translatedTechnology.footer}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="about-section about-features">
        <div className="about-section-content">
          <div className="about-section-header">
            <h2>{translatedFeaturesHeader}</h2>
            <p>{translatedFeaturesSub}</p>
          </div>
          <div className="about-features-grid">
            {translatedFeatures.map((feature, index) => (
              <div key={index} className="about-feature-card">
                <div className="about-feature-icon-wrapper">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Vision Section */}
      <section className="about-section about-vision">
        <div className="about-section-content">
          <div className="about-vision-card">
            <div className="about-vision-icon"><Leaf size={56} /></div>
            <h2>{translatedVision.heading}</h2>
            <p>{translatedVision.description}</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="about-footer">
        <div className="about-footer-content">
          <div className="about-footer-logo"><Leaf size={32} /><span>{translatedFooter.logo}</span></div>
          <p className="about-footer-text">{translatedFooter.tagline}</p>
          <p className="about-footer-copyright">© 2025 CropIQ. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default AboutUs;
