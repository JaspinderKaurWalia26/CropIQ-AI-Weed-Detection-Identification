import API_URL from '../config';

export const translateText = async (text, targetLang) => {
    try {
        const response = await fetch(`${API_URL}/api/translate`, {  // <-- full endpoint here
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text, target_lang: targetLang }),
        });

        const data = await response.json();
        if (response.ok) {
            return data.translated_text;
        } else {
            console.error("Translation error:", data);
            return text; 
        }
    } catch (err) {
        console.error("Error calling translate API:", err);
        return text; 
    }
};
