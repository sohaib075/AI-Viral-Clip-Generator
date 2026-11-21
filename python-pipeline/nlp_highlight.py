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
You are an expert viral content editor. Analyze the ENTIRE following transcript from a video or live stream.
Identify the most engaging, viral, exciting, and entertaining highlights from beginning to end.
You can return up to {num_clips} clips, but only if they are genuinely good.

CRITICAL QUALITY & DURATION RULES:
1. DURATION: Each viral clip MUST be between 20 and 60 seconds long (optimal for vertical YouTube Shorts, TikTok, and Instagram Reels). NEVER output clips shorter than 15 seconds! A clip that lasts only 1-5 seconds cannot be used as a short video.
2. If a funny reaction, clutch moment, fight, or dialogue is short (e.g. 5-10 seconds), you MUST include the 10-15 seconds before it (the setup/buildup) and 10 seconds after (the reaction/aftermath) so the clip is at least 20 to 35 seconds long.
3. Completeness: Each clip must feel like a complete mini-story with a hook/setup, the main dialogue or action, and the resolution.
4. Scan the ENTIRE transcript from start to finish.

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

    # Clean and enforce minimum clip duration (at least 20s) so no 1s clips are produced
    valid_highlights = []
    for h in highlights:
        start_t = max(0.0, float(h.get("start_time") or 0.0))
        end_t = float(h.get("end_time") or 0.0)
        dur = end_t - start_t
        if dur < 20.0:
            needed = 25.0 - max(0.0, dur)
            start_t = max(0.0, start_t - (needed / 2.0))
            end_t = start_t + 25.0
        h["start_time"] = round(start_t, 2)
        h["end_time"] = round(end_t, 2)
        valid_highlights.append(h)

    print(f"Gemini identified {len(valid_highlights)} viral clips!")
    return valid_highlights

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
