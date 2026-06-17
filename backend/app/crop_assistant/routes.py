from flask import request, jsonify
from app.crop_assistant import bp
import os
import requests
from dotenv import load_dotenv

load_dotenv()  

GROQ_API_KEY = os.environ.get("GROQ_ASSISTANT_API_KEY")

@bp.route("/ask", methods=["POST"])
def ask_crop_assistant():
    """
    Handles user queries from frontend and returns Groq AI response.
    Maintains conversation context using chatHistory from frontend.
    """
    data = request.get_json()
    question = data.get("question", "").strip()
    chat_history = data.get("chatHistory", [])

    if not question:
        return jsonify({"error": "Question is required."}), 400

    try:
        
        conversation = [
            {"role": "system", "content": "You are CropIQ, a helpful farming assistant. Answer user questions concisely and practically."}
        ]

        for msg in chat_history:
            role = "user" if msg["sender"] == "user" else "assistant"
            conversation.append({"role": role, "content": msg["text"]})

        conversation.append({"role": "user", "content": question})

        url = "https://api.groq.com/openai/v1/responses"
        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": "openai/gpt-oss-20b",
            "input": f"""
                You are CropIQ, a helpful farming assistant.
                Answer the user question: {question}
                - Use bullet points or short sentences .
                - Write in **short, complete sentences**.
                - Do **not end with open questions or unfinished sentences**.
                - End with a natural conclusion.
            """,
            "temperature": 0.7
        }

        response = requests.post(url, headers=headers, json=payload)
        result = response.json()

        answer = ""
        for item in result.get("output", []):
            if item.get("type") == "message":
                for content in item.get("content", []):
                    if content.get("type") == "output_text":
                        answer = content.get("text", "").strip()
                        break

        if not answer:
            answer = "Sorry, I couldn't generate a response."

        return jsonify({"answer": answer})

    except Exception as e:
        print("Groq API error:", e)
        return jsonify({"error": "Failed to fetch response from Groq API."}), 500
