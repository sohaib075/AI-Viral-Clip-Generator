import json
import os
import time

from google import genai

MODEL = 'gemini-2.5-flash'
# Waits between attempts for rate limits, overloaded servers and cut-off responses
RETRY_DELAYS = [5, 15]


def _parse_json(text):
    text = (text or '').strip()
    if not text:
        raise ValueError("Gemini returned an empty response (it may have been blocked by safety filters)")
    # Clean up markdown if the LLM accidentally added it
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return json.loads(text)


def generate_json(contents):
    """
    Asks Gemini for a JSON response and returns the parsed value. Transient failures are retried;
    if every attempt fails this raises, so callers never continue with made-up results.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not set. Get one from aistudio.google.com")

    client = genai.Client(api_key=api_key)
    last_error = None
    for attempt in range(len(RETRY_DELAYS) + 1):
        try:
            response = client.models.generate_content(
                model=MODEL,
                contents=contents,
                config={'response_mime_type': 'application/json'}
            )
            return _parse_json(response.text)
        except Exception as e:
            last_error = e
            if attempt < len(RETRY_DELAYS):
                print(f"Gemini request failed (attempt {attempt + 1}): {e}. Retrying in {RETRY_DELAYS[attempt]}s...")
                time.sleep(RETRY_DELAYS[attempt])

    raise RuntimeError(f"AI analysis failed: {last_error}")
