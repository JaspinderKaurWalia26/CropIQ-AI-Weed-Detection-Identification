import os
import requests
from typing import Optional, Tuple


StringErrorTuple = Tuple[Optional[str], Optional[str]]


class GroqClient:
    """
    Client wrapper for Groq API (OpenAI-compatible) to fetch organic weed removal methods.

    Environment variables:
      - GROQ_API_KEY: API key for Groq
      - GROQ_MODEL: model name, e.g. 'llama-3.1-8b-instant' (set in .env)
      - GROQ_API_BASE: optional base URL; default 'https://api.groq.com/openai/v1'
    """

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None, base_url: Optional[str] = None):
        self.api_key = api_key or os.getenv('GROQ_API_KEY')
        self.model = model or os.getenv('GROQ_MODEL', 'llama-3.1-8b-instant')
        self.base_url = base_url or os.getenv('GROQ_API_BASE', 'https://api.groq.com/openai/v1')

    def get_recommendations(self, weed_name: str) -> StringErrorTuple:
        if not weed_name:
            return None, 'Missing weed name'
        if not self.api_key:
            return None, 'GROQ_API_KEY is not configured'

        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json',
        }

        prompt = (
            f"You are an agronomy assistant. Provide concise, step-by-step, organic and sustainable methods to remove the weed: '{weed_name}'. "
            "Include manual/mechanical options, mulching, crop management, cultural practices, and safety precautions. Limit to 8-12 bullet points."
        )

        payload = {
            'model': self.model,
            'messages': [
                {"role": "system", "content": "You are a precise agronomy assistant."},
                {"role": "user", "content": prompt}
            ],
            'temperature': 0.3,
        }

        try:
            url = f"{self.base_url}/chat/completions"
            resp = requests.post(url, headers=headers, json=payload, timeout=30)
            if resp.status_code != 200:
                return None, f"Groq API error {resp.status_code}: {resp.text}"
            data = resp.json()
            content = data.get('choices', [{}])[0].get('message', {}).get('content')
            if not content:
                return None, 'Groq API returned empty content'
            return content.strip(), None
        except Exception as e:
            return None, str(e)

    def chat(self, user_message: str, history: Optional[list] = None, system_prompt: Optional[str] = None,
             temperature: float = 0.3) -> StringErrorTuple:
        """
        General chat completion helper.

        Args:
            user_message: The latest user message content.
            history: Optional list of prior messages as dicts with keys 'role' and 'content'.
            system_prompt: Optional system message defining assistant behavior.
            temperature: Sampling temperature.

        Returns:
            (content, error)
        """
        if not user_message:
            return None, 'Missing user message'
        if not self.api_key:
            return None, 'GROQ_API_KEY is not configured'

        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json',
        }

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        if history:
            # Ensure roles and content are strings and valid
            for m in history:
                role = m.get('role')
                content = m.get('content')
                if role in ("user", "assistant") and isinstance(content, str):
                    messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": user_message})

        payload = {
            'model': self.model,
            'messages': messages,
            'temperature': temperature,
        }

        try:
            url = f"{self.base_url}/chat/completions"
            resp = requests.post(url, headers=headers, json=payload, timeout=30)
            if resp.status_code != 200:
                return None, f"Groq API error {resp.status_code}: {resp.text}"
            data = resp.json()
            content = data.get('choices', [{}])[0].get('message', {}).get('content')
            if not content:
                return None, 'Groq API returned empty content'
            return content.strip(), None
        except Exception as e:
            return None, str(e)
