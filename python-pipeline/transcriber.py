import os
from groq import Groq

def transcribe_audio(audio_path):
    """
    Transcribes audio using the blazing fast Groq API (Whisper large-v3).
    """
    print(f"Uploading audio to Groq API: {audio_path}")
    
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY environment variable is not set. Please get one from console.groq.com")

    client = Groq(api_key=api_key)

    try:
        with open(audio_path, "rb") as file:
            transcription = client.audio.transcriptions.create(
                file=(os.path.basename(audio_path), file.read()),
                model="whisper-large-v3",
                response_format="verbose_json",  # Gets timestamps
            )
        
        # Groq verbose_json returns a dict-like object with segments
        print("Transcription complete via Groq!")
        
        segments = []
        if hasattr(transcription, 'segments'):
            for seg in transcription.segments:
                segments.append({
                    "start": seg.start,
                    "end": seg.end,
                    "text": seg.text.strip()
                })
        
        return {
            "text": transcription.text,
            "segments": segments
        }
    except Exception as e:
        print(f"Error during Groq transcription: {e}")
        return None

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    
    test_file = "../temp/extracted_audio.mp3"
    if os.path.exists(test_file):
        result = transcribe_audio(test_file)
        if result:
            print("Transcript length:", len(result["text"]))
            print("First segment:", result["segments"][0] if result["segments"] else "None")
