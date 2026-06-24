import os
import json
from google import genai

def extract_highlights(transcript_data, num_clips=3):
    """
    Uses Google Gemini API to identify the most engaging highlights 
    from the transcript and returns their start and end times.
    """
    print(f"Analyzing {len(transcript_data['segments'])} segments with Gemini API...")
    
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not set. Get one from aistudio.google.com")

    client = genai.Client(api_key=api_key)
    
    # We use gemini-2.5-flash as it is lightning fast and free
    
    # Prepare the payload for the LLM
    text_content = ""
    for idx, seg in enumerate(transcript_data["segments"]):
        text_content += f"[{idx}] {seg['start']:.2f} - {seg['end']:.2f}: {seg['text']}\n"
        
    prompt = f"""
You are an expert viral content editor. Analyze the following transcript from a video.
Identify up to {num_clips} of the most engaging, viral, and stand-alone highlights. 

CRITICAL QUALITY RULES:
1. Focus entirely on QUALITY and RELEVANCE, not quantity. If there is only 1 truly great moment, only return 1. Do not generate random segments just to hit the limit.
2. Each clip MUST be meaningful and contextually complete. It should have a clear beginning, middle, and end, making sense even to viewers who haven't seen the original video.
3. There is no strict length limit—clips can be longer than 60 seconds if necessary to preserve context.

Formatting Rules:
1. Return ONLY a valid JSON array of objects.
2. Each object must have:
   - "title": A catchy, viral title for the clip (max 5 words)
   - "start_time": The start timestamp (in seconds, as a float)
   - "end_time": The end timestamp (in seconds, as a float)
   - "score": A virality score from 1 to 100
   - "reasoning": A 1 sentence explanation of why this clip is highly engaging.
3. No markdown blocks, just the raw JSON array.

Transcript:
{text_content}
"""

    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )
        result_text = response.text.strip()
        
        # Clean up markdown if the LLM accidentally added it
        if result_text.startswith("```json"):
            result_text = result_text[7:]
        if result_text.endswith("```"):
            result_text = result_text[:-3]
            
        highlights = json.loads(result_text)
        print(f"Gemini identified {len(highlights)} viral clips!")
        return highlights
        
    except Exception as e:
        print(f"Error during Gemini highlight extraction: {e}")
        # Fallback to a mock segment if API fails
        first_seg = transcript_data["segments"][0]
        return [{
            "title": "Interesting Moment",
            "start_time": first_seg["start"],
            "end_time": min(first_seg["start"] + 30, transcript_data["segments"][-1]["end"]),
            "score": 85,
            "reasoning": "Fallback highlight."
        }]

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    
    mock_data = {
        "text": "This is a test. Wow this is amazing.",
        "segments": [
            {"start": 0.0, "end": 2.0, "text": "This is a test."},
            {"start": 2.0, "end": 5.0, "text": "Wow this is amazing."}
        ]
    }
    
    res = extract_highlights(mock_data, 1)
    print(res)
