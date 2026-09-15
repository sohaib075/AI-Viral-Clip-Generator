from gemini_client import generate_json

def extract_highlights(transcript_data, num_clips=10):
    """
    Uses Google Gemini API to identify the most engaging highlights
    from the transcript and returns their start and end times.
    Raises if the analysis fails, rather than inventing a highlight.
    """
    segments = transcript_data.get("segments", [])
    print(f"Analyzing {len(segments)} segments with Gemini API...")
    if not segments:
        return []

    # Prepare the payload for the LLM
    text_content = ""
    for idx, seg in enumerate(segments):
        text_content += f"[{idx}] {seg['start']:.2f} - {seg['end']:.2f}: {seg['text']}\n"

    prompt = f"""
You are an expert viral content editor. Analyze the ENTIRE following transcript from a video.
Identify the most engaging, viral, and stand-alone highlights from beginning to end.
You can return up to {num_clips} clips, but only if they are genuinely good.

CRITICAL QUALITY RULES:
1. Scan the ENTIRE transcript, do not just look at the beginning. We want highlights from the middle and end of the video too.
2. Focus on QUALITY and RELEVANCE. Each clip MUST be meaningful and contextually complete.
3. There is no strict length limit—clips can be longer than 60 seconds if necessary to preserve context.

Formatting Rules:
1. Return ONLY a valid JSON array of objects.
2. Each object must have:
   - "title": A catchy, viral title for the clip (max 5 words)
   - "start_time": The start timestamp (in seconds, as a float)
   - "end_time": The end timestamp (in seconds, as a float)
   - "score": A virality score from 1 to 100
   - "reasoning": A 1 sentence explanation of why this clip is highly engaging.
   - "emphasized_words": An array of strings representing the most important 2-5 words in this clip that should be highlighted.
   - "metadata": An object containing platform-specific engaging content based on the clip:
       - "tiktok": {{"title": "...", "description": "...", "hashtags": ["...", "..."]}}
       - "instagram": {{"title": "...", "description": "...", "hashtags": ["...", "..."]}}
       - "youtube_shorts": {{"title": "...", "description": "...", "hashtags": ["...", "..."]}}
       - "linkedin": {{"post": "...", "hashtags": ["...", "..."]}}
       - "x": {{"tweet": "...", "hashtags": ["...", "..."]}}
3. Output nothing but the JSON array.

Transcript:
{text_content}
"""

    highlights = generate_json(prompt)

    # The model occasionally wraps the array in an object, e.g. {"clips": [...]}
    if isinstance(highlights, dict):
        highlights = next((v for v in highlights.values() if isinstance(v, list)), [])
    if not isinstance(highlights, list):
        raise RuntimeError("AI analysis returned an unexpected format.")
    highlights = [h for h in highlights if isinstance(h, dict)]
    print(f"Gemini identified {len(highlights)} viral clips!")
    return highlights

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
