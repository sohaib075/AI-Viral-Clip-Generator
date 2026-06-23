import os
from dotenv import load_dotenv

def test_apis():
    print("🚀 Starting API Validation Test...\n")
    load_dotenv()
    
    # 1. Test Groq
    groq_key = os.environ.get("GROQ_API_KEY")
    if not groq_key or "your_groq" in groq_key:
        print("❌ Groq API Key is missing or invalid.")
    else:
        print("✅ Groq API Key detected!")
        # We can't fully test transcription without an audio file, but detecting the key is good.
        
    # 2. Test Gemini
    gemini_key = os.environ.get("GEMINI_API_KEY")
    if not gemini_key or "your_gemini" in gemini_key:
        print("❌ Gemini API Key is missing or invalid.")
    else:
        print("✅ Gemini API Key detected!")
        try:
            from google import genai
            client = genai.Client(api_key=gemini_key)
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents="Say 'Gemini API is successfully connected!'"
            )
            print(f"🤖 Gemini says: {response.text.strip()}")
            print("✅ Gemini API is fully working!")
        except Exception as e:
            print(f"❌ Gemini API Error: {e}")
            
    print("\n🎉 Test Complete! If everything is green, your AI engine is ready!")

if __name__ == "__main__":
    test_apis()
