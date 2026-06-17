import React, { useContext } from "react";
import { LanguageContext } from "../../context/LanguageContext";
import "../styles/LanguageSelector.css";

const LanguageSelector = ({ position = "top-right", theme = "light" }) => {
  const { language, changeLanguage } = useContext(LanguageContext);

  const handleLanguageChange = (e) => {
    changeLanguage(e.target.value);
  };

  return (
    <div className={`language-selector ${position} ${theme}`}>
      <select value={language} onChange={handleLanguageChange}>
        <option value="en">English</option>
        <option value="hi">Hindi</option>
        <option value="pa">Punjabi</option>
      </select>
    </div>
  );
};

export default LanguageSelector;