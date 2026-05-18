import os
import requests
from utils.logger import get_logger

logger = get_logger(__name__)

class GeminiClient:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            logger.warning("GEMINI_API_KEY not found in environment!")

    def generate_content(self, prompt: str, system_instruction: str = None) -> str:
        if not self.api_key:
            return "Error: GEMINI_API_KEY is not configured."

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={self.api_key}"
        payload = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        }
        if system_instruction:
            payload["systemInstruction"] = {
                "parts": [{"text": system_instruction}]
            }

        try:
            res = requests.post(url, json=payload, timeout=30)
            if res.status_code != 200:
                logger.error(f"Gemini API error: {res.text}")
                return f"Error: Gemini API returned status code {res.status_code}."

            data = res.json()
            try:
                return data["candidates"][0]["content"]["parts"][0]["text"]
            except (KeyError, IndexError):
                logger.error(f"Unexpected Gemini API response structure: {data}")
                return "Error: Unexpected response structure from Gemini API."
        except Exception as e:
            logger.error(f"Failed to generate content: {e}")
            return f"Error: Failed to call Gemini API: {str(e)}"

    def ask(self, prompt: str) -> str:
        return self.generate_content(prompt)
