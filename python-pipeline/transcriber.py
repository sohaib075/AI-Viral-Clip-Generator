import os
import time
import glob
import concurrent.futures
from groq import Groq
import imageio_ffmpeg
import subprocess

RETRY_DELAYS = [5, 15, 45]

def retry_delay(error, attempt):
    """Waits longer each attempt, or as long as the API asks (Retry-After) when rate limited."""
    response = getattr(error, 'response', None)
    retry_after = response.headers.get('retry-after') if response is not None and hasattr(response, 'headers') else None
    try:
        if retry_after:
            return min(float(retry_after), 120)
    except ValueError:
        pass
    return RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)]

def transcribe_chunk(client, chunk_path, offset_seconds):
    """
    Transcribes a single audio chunk and offsets the timestamps.
    """
    max_retries = len(RETRY_DELAYS) + 1
    for attempt in range(max_retries):
        try:
            with open(chunk_path, "rb") as file:
                transcription = client.audio.transcriptions.create(
                    file=(os.path.basename(chunk_path), file.read()),
                    model="whisper-large-v3",
                    response_format="verbose_json",
                    temperature=0.0,
                    prompt="Please accurately transcribe all spoken content. Ensure every single word is captured with high accuracy without omitting any important words or sentences.",
                    timestamp_granularities=["word", "segment"]
                )
            
            segments = []
            words = []
            if hasattr(transcription, 'segments'):
                for seg in transcription.segments:
                    start_t = seg["start"] if isinstance(seg, dict) else seg.start
                    end_t = seg["end"] if isinstance(seg, dict) else seg.end
                    text_content = (seg["text"] if isinstance(seg, dict) else seg.text).strip()
                    
                    segments.append({
                        "start": start_t + offset_seconds,
                        "end": end_t + offset_seconds,
                        "text": text_content
                    })

            if hasattr(transcription, 'words') and transcription.words:
                for w in transcription.words:
                    start_t = w["start"] if isinstance(w, dict) else w.start
                    end_t = w["end"] if isinstance(w, dict) else w.end
                    word_text = w["word"] if isinstance(w, dict) else w.word
                    
                    words.append({
                        "start": start_t + offset_seconds,
                        "end": end_t + offset_seconds,
                        "word": word_text
                    })
            
            return {
                "text": transcription.text,
                "segments": segments,
                "words": words
            }
            
        except Exception as e:
            print(f"Error transcribing {os.path.basename(chunk_path)} (Attempt {attempt + 1}/{max_retries}): {e}")
            if attempt == max_retries - 1:
                return {"text": "", "segments": [], "words": [], "failed": True}
            time.sleep(retry_delay(e, attempt))

def transcribe_audio(audio_path):
    """
    Transcribes audio using the blazing fast Groq API (Whisper large-v3).
    Splits the audio into 5-minute chunks and processes them concurrently for massive speed gains.
    """
    print(f"Preparing audio for concurrent transcription: {audio_path}")
    
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY environment variable is not set. Please get one from console.groq.com")

    client = Groq(api_key=api_key, timeout=300.0)
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    
    # 1. Chunk the audio
    # 300 seconds = 5 minutes
    chunk_duration = 300
    base_dir = os.path.dirname(audio_path)
    base_name = os.path.splitext(os.path.basename(audio_path))[0]
    chunk_pattern = os.path.join(base_dir, f"{base_name}_chunk_%03d.mp3")
    
    # Clean up any existing chunks from previous failed runs
    for f in glob.glob(os.path.join(base_dir, f"{base_name}_chunk_*.mp3")):
        try: os.remove(f)
        except: pass

    # Run FFmpeg to split without re-encoding
    cmd = [
        ffmpeg_exe, "-y", "-i", audio_path,
        "-f", "segment", "-segment_time", str(chunk_duration),
        "-c", "copy", chunk_pattern
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    # Get sorted chunks
    chunks = sorted(glob.glob(os.path.join(base_dir, f"{base_name}_chunk_*.mp3")))
    
    if not chunks:
        print("Failed to chunk audio. Attempting single pass...")
        return transcribe_chunk(client, audio_path, 0)
        
    print(f"Split audio into {len(chunks)} chunks. Transcribing concurrently...")
    
    # 2. Transcribe concurrently
    all_text = []
    all_segments = []
    all_words = []
    
    def process_with_index(idx_and_chunk):
        idx, chunk_file = idx_and_chunk
        offset = idx * chunk_duration
        return transcribe_chunk(client, chunk_file, offset)

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        items = list(enumerate(chunks))
        results = list(executor.map(process_with_index, items))
        
    # 3. Merge results
    for res in results:
        if res.get("text"):
            all_text.append(res["text"])
        if res.get("segments"):
            all_segments.extend(res["segments"])
        if res.get("words"):
            all_words.extend(res["words"])
        
    # A chunk that failed every retry leaves a gap in the transcript; report it instead of hiding it
    failed_chunks = [os.path.basename(chunks[i]) for i, res in enumerate(results) if res.get("failed")]
    if failed_chunks:
        print(f"WARNING: {len(failed_chunks)} of {len(chunks)} chunks failed to transcribe: {failed_chunks}")

    # 4. Cleanup chunks
    for f in chunks:
        try: os.remove(f)
        except: pass

    print("Concurrent transcription complete!")
    return {
        "text": " ".join(all_text),
        "segments": all_segments,
        "words": all_words,
        "failed_chunks": failed_chunks
    }

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    
    test_file = "../temp/extracted_audio.mp3"
    if os.path.exists(test_file):
        result = transcribe_audio(test_file)
        if result:
            print("Transcript length:", len(result["text"]))
            print("First segment:", result["segments"][0] if result["segments"] else "None")
