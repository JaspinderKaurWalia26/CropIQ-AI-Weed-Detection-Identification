'use client';

import React, { useState, useRef, useEffect, useContext } from "react";
import "../../styles/dashboard.css";
import { FiHelpCircle, FiSend } from "react-icons/fi";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LanguageContext } from "../../../context/LanguageContext";

const CropAssistant = () => {
  const { language, translate } = useContext(LanguageContext);
  const translationsCache = useRef({});

  const originalTexts = {
    header: "Crop Assistant",
    placeholder: "Ask me anything about crops...",
    typing: "Typing...",
    botGreeting: "Hello! I am your Crop Assistant. How can I help you today?",
    errorBot: "Failed to get a response from the assistant."
  };
  const [translatedTexts, setTranslatedTexts] = useState({ ...originalTexts });

  const [chatMessages, setChatMessages] = useState([]);
  const [chatMessage, setChatMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const chatBoxRef = useRef(null);

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

      // Update initial greeting if chat is empty
      if (chatMessages.length === 0) {
        setChatMessages([{ sender: "bot", text: updated.botGreeting, original: originalTexts.botGreeting }]);
      } else {
        // Re-translate all previous bot messages
        const newMessages = await Promise.all(
          chatMessages.map(async (msg) => {
            if (msg.sender === "bot") {
              const textToTranslate = language === "en" ? msg.original : msg.original;
              const translatedText = language === "en" ? msg.original : await translateCached(textToTranslate);
              return { ...msg, text: translatedText };
            }
            return msg;
          })
        );
        setChatMessages(newMessages);
      }
    };
    translateAll();
  }, [language]);

  useEffect(() => {
    if (chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
  }, [chatMessages]);

  const handleSendMessage = async () => {
    if (!chatMessage.trim()) return;
    const question = chatMessage;
    setChatMessage("");
    setLoading(true);
    setChatMessages(prev => [...prev, { sender: "user", text: question }]);

    try {
      const response = await fetch("http://localhost:5000/api/assistant/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, chatHistory: chatMessages }),
      });
      const data = await response.json();
      const translatedAnswer = await translateCached(data.answer);
      setChatMessages(prev => [...prev, { sender: "bot", text: translatedAnswer, original: data.answer }]);
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, { sender: "bot", text: translatedTexts.errorBot, original: originalTexts.errorBot }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="crop-assistant">
      <div className="assistant-header">
        <h3>{translatedTexts.header}</h3>
        <FiHelpCircle size={24} color="#2e7d32" />
      </div>

      <div className="chat-box" ref={chatBoxRef}>
        {chatMessages.map((msg, index) => (
          <div key={index} className={`chat-message ${msg.sender}`}>
            {msg.sender === "bot" ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {msg.text}
              </ReactMarkdown>
            ) : (
              <p>{msg.text}</p>
            )}
          </div>
        ))}
        {loading && <div className="chat-message bot"><p>{translatedTexts.typing}</p></div>}
      </div>

      <div className="chat-input-container">
        <textarea
          placeholder={translatedTexts.placeholder}
          value={chatMessage}
          onChange={(e) => setChatMessage(e.target.value)}
          onKeyDown={handleKeyPress}
        />
        <button onClick={handleSendMessage} className="send-button">
          <FiSend size={20} color="white" />
        </button>
      </div>
    </div>
  );
};

export default CropAssistant;
