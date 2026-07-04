import os
import asyncio
from downloader import download_video
from audio_extractor import extract_audio
from transcriber import transcribe_audio
from video_editor import process_clip
from google import genai
import json

async def process_auto_edit(job_id, video_url, layout, style, prompt, progress_callback, input_dir, processed_dir, clips_dir):
    progress_callback(5, "Initializing auto edit...")

    # 1. Download Video
    progress_callback(10, "Downloading video...")
    if video_url.startswith('file://'):
        import urllib.request
        raw_path = urllib.request.url2pathname(video_url[7:])
        base_name = os.path.basename(raw_path)
        video_path = os.path.join(input_dir, base_name)
        if os.path.exists(raw_path) and os.path.abspath(raw_path) != os.path.abspath(video_path):
            import shutil
            shutil.move(raw_path, video_path)
        else:
            video_path = raw_path
    else:
        video_path = download_video(video_url, input_dir)

    # 2. Audio and Transcription
    progress_callback(30, "Extracting audio and transcribing...")
    audio_path = extract_audio(video_path, processed_dir)
    transcript_data = transcribe_audio(audio_path)
    
    # 3. Generate Metadata via LLM based on prompt and transcript
    progress_callback(50, "Generating creative metadata based on prompt...")
    metadata = generate_metadata(transcript_data.get('text', ''), style, prompt)
    
    # 4. Basic Video Editing (Resizing & Subtitles)
    # We use moviepy directly for a basic edit to demonstrate the pipeline
    progress_callback(70, "Applying video edits (resizing, basic cuts)...")
    final_clip_path = await apply_video_edits(video_path, layout, style, prompt, transcript_data, clips_dir, job_id)
    
    progress_callback(95, "Finalizing...")
    return final_clip_path, metadata

def generate_metadata(transcript_text, style, prompt):
    try:
        api_key = os.environ.get("GEMINI_API_KEY")
        client = genai.Client(api_key=api_key)
        
        sys_prompt = f"""
        You are an expert video editor and social media manager.
        The user wants to edit a video with the following style: {style}.
        They provided this custom prompt: "{prompt}"
        
        Based on the transcript, generate a catchy Title, Description, and Hashtags for social media.
        Return ONLY a JSON object with 'title', 'description', and 'hashtags' (list of strings).
        """
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=sys_prompt + "\n\nTranscript:\n" + (transcript_text[:2000] if transcript_text else "No transcript available."),
            config={"response_mime_type": "application/json"}
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"Metadata generation failed: {e}")
        return {
            "title": f"Awesome {style} Video",
            "description": "Auto generated video edit.",
            "hashtags": ["#viral", f"#{style.replace(' ', '')}"]
        }

async def apply_video_edits(video_path, layout, style, prompt, transcript_data, clips_dir, job_id):
    import ffmpeg
    import imageio_ffmpeg
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    
    # We will take the first 30 seconds for demonstration
    duration = 30.0
    
    output_filename = f"auto_{job_id}.mp4"
    output_path = os.path.join(clips_dir, output_filename)
    
    vf_filter = "scale=1920:1080" # Default fallback
    if layout == '9:16':
        vf_filter = "crop=min(iw\\,ih*9/16):min(ih\\,iw*16/9),scale=1080:1920"
    elif layout == '1:1':
        vf_filter = "crop=min(iw\\,ih):min(ih\\,iw),scale=1080:1080"
    elif layout == '16:9':
        vf_filter = "crop=min(iw\\,ih*16/9):min(ih\\,iw*9/16),scale=1920:1080"
        
    try:
        (
            ffmpeg
            .input(video_path, t=duration)
            .output(
                output_path,
                vf=vf_filter,
                vcodec="libx264",
                acodec="aac",
                preset="ultrafast",
                crf=23,
                pix_fmt="yuv420p"
            )
            .overwrite_output()
            .run(cmd=ffmpeg_exe, quiet=True)
        )
        return output_path
    except Exception as e:
        print(f"Error applying video edits: {e}")
        # fallback if error
        return video_path
