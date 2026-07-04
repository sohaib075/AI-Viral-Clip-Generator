import os
import asyncio
import json
import ffmpeg
import imageio_ffmpeg
from google import genai
from downloader import download_video
from audio_extractor import extract_audio
from transcriber import transcribe_audio
from video_editor import create_ass

ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

def load_style_config(style_name):
    config_path = os.path.join(os.path.dirname(__file__), 'style_configs.json')
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            configs = json.load(f)
            return configs.get(style_name, configs.get("Cinematic"))
    except:
        return {
            "fontName": "Arial Black",
            "fontSize": 60,
            "primaryColor": "&H00FFFFFF",
            "highlightColor": "&H0000FFFF",
            "colorFilter": "eq=contrast=1.1:saturation=1.2",
            "zoomFrequency": "medium"
        }

def analyze_storyline_and_metadata(transcript_data, style, prompt):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("No GEMINI_API_KEY, using fallback metadata.")
        return fallback_metadata(transcript_data, style)
        
    client = genai.Client(api_key=api_key)
    
    text_content = ""
    for idx, seg in enumerate(transcript_data.get("segments", [])):
        text_content += f"[{idx}] {seg['start']:.2f} - {seg['end']:.2f}: {seg['text']}\n"
        
    sys_prompt = f"""
    You are an expert video editor and social media manager.
    The user wants to edit a video with the following style: {style}.
    They provided this custom prompt: "{prompt}"
    
    Based on the transcript, do two things:
    1. Identify the most engaging storyline by selecting a sequence of segment indices to keep. Remove boring parts or filler.
    2. Generate a catchy Title, Description, and Hashtags for social media.
    
    Return ONLY a JSON object with:
    - 'kept_segment_indices': [list of integers]
    - 'title': '...'
    - 'description': '...'
    - 'hashtags': ['...', '...']
    - 'zoom_indices': [list of integers representing segments that should have a punch-in zoom effect]
    """
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=sys_prompt + "\n\nTranscript:\n" + (text_content[:3000] if text_content else "No transcript available."),
            config={"response_mime_type": "application/json"}
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"Gemini analysis failed: {e}")
        return fallback_metadata(transcript_data, style)

def fallback_metadata(transcript_data, style):
    segs = transcript_data.get("segments", [])
    indices = list(range(len(segs))) if len(segs) < 10 else list(range(10))
    return {
        "kept_segment_indices": indices,
        "title": f"Awesome {style} Edit",
        "description": "Auto generated video edit.",
        "hashtags": ["#viral", f"#{style.replace(' ', '')}"],
        "zoom_indices": [i for i in indices if i % 3 == 0]
    }

def process_auto_edit(job_id, video_url, layout, style, prompt, progress_callback, input_dir, processed_dir, clips_dir):
    progress_callback(5, "Initializing advanced editor...")

    # Load Config
    style_config = load_style_config(style)

    # 1. Download Video
    progress_callback(10, "Downloading high-quality video...")
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

    # 2. Audio & Transcription
    progress_callback(25, "Extracting audio and performing word-level transcription...")
    audio_path = extract_audio(video_path, processed_dir)
    transcript_data = transcribe_audio(audio_path)
    
    # 3. AI Analysis (Storyline & Metadata)
    progress_callback(45, "AI analyzing storyline and pacing...")
    analysis = analyze_storyline_and_metadata(transcript_data, style, prompt)
    
    kept_indices = analysis.get("kept_segment_indices", [])
    zoom_indices = set(analysis.get("zoom_indices", []))
    
    if not kept_indices:
        kept_indices = [0]
    
    segments = transcript_data.get("segments", [])
    kept_segments = [segments[i] for i in kept_indices if i < len(segments)]
    
    # 4. Generate Subtitles
    progress_callback(60, "Generating animated subtitles and VFX plan...")
    
    # We create a pseudo clip_data for the ASS generator
    clip_data = {
        "start": kept_segments[0]["start"] if kept_segments else 0.0,
        "end": kept_segments[-1]["end"] if kept_segments else 15.0,
        "segments": kept_segments,
        "words": [w for seg in kept_segments for w in seg.get("words", [])],
        "layout": layout
    }
    
    ass_path = os.path.join(processed_dir, f"subtitles_{job_id}.ass")
    create_ass(clip_data, ass_path, is_vertical=(layout != 'horizontal'), style_config=style_config)
    
    # 5. FFmpeg Assembly (Cuts, Zooms, Color, Subtitles)
    progress_callback(75, "Rendering final professional cut (Color, VFX, Subtitles)...")
    
    output_filename = f"advanced_{job_id}.mp4"
    output_path = os.path.join(clips_dir, output_filename)
    
    # Build complex filtergraph for concat and VFX
    try:
        inputs = []
        filter_streams = []
        
        input_vid = ffmpeg.input(video_path)
        
        # Determine base resolution
        is_vertical = (layout == '9:16')
        target_w = 1080 if is_vertical else 1920
        target_h = 1920 if is_vertical else 1080
        
        # We will extract each kept segment, apply filters, and concat
        concat_v = []
        concat_a = []
        
        for idx, seg in enumerate(kept_segments):
            start = seg['start']
            end = seg['end']
            duration = end - start
            if duration <= 0.2:
                continue # Skip micro segments
                
            # Extract video part
            v_part = input_vid.video.trim(start=start, end=end).setpts('PTS-STARTPTS')
            a_part = input_vid.audio.filter('atrim', start=start, end=end).filter('asetpts', 'PTS-STARTPTS')
            
            # Apply Layout Crop/Scale
            if layout == '9:16':
                v_part = v_part.filter('crop', 'min(iw,ih*9/16)', 'min(ih,iw*16/9)').filter('scale', target_w, target_h)
            elif layout == '1:1':
                v_part = v_part.filter('crop', 'min(iw,ih)', 'min(ih,iw)').filter('scale', 1080, 1080)
                target_w, target_h = 1080, 1080
            else:
                v_part = v_part.filter('crop', 'min(iw,ih*16/9)', 'min(ih,iw*9/16)').filter('scale', target_w, target_h)
                
            # Apply Zoom if designated
            if kept_indices[idx] in zoom_indices:
                # 10% punch in
                v_part = v_part.filter('scale', int(target_w*1.1), int(target_h*1.1)).filter('crop', target_w, target_h)
                
            # Apply Color Grading
            if style_config.get("colorFilter"):
                v_part = v_part.filter_('eq', **dict(kv.split('=') for kv in style_config["colorFilter"].replace('eq=', '').split(':')))
                
            concat_v.append(v_part)
            concat_a.append(a_part)
            
        if not concat_v:
             raise Exception("No valid segments to concat.")
             
        joined_v = ffmpeg.concat(*concat_v, v=1, a=0)
        joined_a = ffmpeg.concat(*concat_a, v=0, a=1)
        
        base_output_path = output_path.replace(".mp4", "_base.mp4")
        
        # Render Base Concat
        (
            ffmpeg
            .output(joined_v, joined_a, base_output_path, vcodec="libx264", acodec="aac", preset="fast", crf=23, pix_fmt="yuv420p")
            .overwrite_output()
            .run(cmd=ffmpeg_exe, quiet=True)
        )
        
        # Overlay Subtitles (Pass 2)
        ass_path_ffmpeg = ass_path.replace('\\', '/').replace(':', '\\:')
        (
            ffmpeg
            .input(base_output_path)
            .output(
                output_path, 
                vf=f"subtitles='{ass_path_ffmpeg}'",
                vcodec="libx264",
                acodec="copy",
                preset="fast",
                crf=23,
                pix_fmt="yuv420p"
            )
            .overwrite_output()
            .run(cmd=ffmpeg_exe, quiet=True)
        )
        
        # Cleanup base clip
        try:
            os.remove(base_output_path)
        except:
            pass
        
    except Exception as e:
        print(f"Error rendering video: {e}")
        if hasattr(e, 'stderr') and e.stderr:
            print("FFMPEG STDERR:")
            print(e.stderr.decode('utf-8', errors='ignore'))
        import traceback
        traceback.print_exc()
        # Fallback to simple render if complex graph fails
        progress_callback(80, "Complex render failed, using fallback render...")
        try:
             (
                 ffmpeg
                 .input(video_path, t=30)
                 .output(output_path, vf="scale=1920:1080", vcodec="libx264", acodec="aac", preset="ultrafast")
                 .overwrite_output()
                 .run(cmd=ffmpeg_exe, quiet=True)
             )
        except Exception as e2:
             print(f"Fallback render failed: {e2}")
             return video_path, analysis
             
    progress_callback(100, "Finalizing professional edit...")
    return output_path, analysis
