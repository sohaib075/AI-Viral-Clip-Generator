import os
import json
from google import genai
from dotenv import load_dotenv

load_dotenv()
api_key = os.environ.get("GEMINI_API_KEY")

client = genai.Client(api_key=api_key)

try:
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents="Say hello"
    )
    print("Success:")
    print(response.text)
except Exception as e:
    print("Error:")
    print(e)
