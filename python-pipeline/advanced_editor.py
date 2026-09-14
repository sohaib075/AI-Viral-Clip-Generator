import os
import json
import ffmpeg
import imageio_ffmpeg
from google import genai
from downloader import download_video, resolve_local_upload
from audio_extractor import extract_audio
from transcriber import transcribe_audio
from video_editor import create_ass

ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

# Output resolution for each supported layout
LAYOUT_SIZES = {
    '9:16': (1080, 1920),
    '1:1': (1080, 1080),
    '16:9': (1920, 1080),
}

MIN_SEGMENT_SECONDS = 0.2

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
        analysis = json.loads(response.text)
        if not isinstance(analysis, dict):
            raise ValueError("Expected a JSON object")
        return analysis
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

def build_edit_plan(segments, kept_indices):
    """
    Returns [(segment_index, segment)] for the segments to keep, in the order chosen.
    Invalid indices and micro segments are dropped.
    """
    def usable(i):
        return (isinstance(i, int) and 0 <= i < len(segments)
                and segments[i]['end'] - segments[i]['start'] > MIN_SEGMENT_SECONDS)

    plan = [(i, segments[i]) for i in kept_indices if usable(i)]
    if not plan:
        plan = [(i, segments[i]) for i in range(min(len(segments), 10)) if usable(i)]
    return plan

def build_subtitle_clip_data(plan, all_words, layout):
    """
    The kept segments are joined back to back, so segment and word times are shifted
    onto that new timeline. Otherwise captions drift after every removed gap.
    """
    out_segments = []
    out_words = []
    offset = 0.0
    for _, seg in plan:
        seg_start, seg_end = seg['start'], seg['end']
        shift = offset - seg_start
        out_segments.append({"start": seg_start + shift, "end": seg_end + shift, "text": seg['text']})
        for w in all_words:
            if w['end'] > seg_start and w['start'] < seg_end:
                out_words.append({
                    "start": max(w['start'], seg_start) + shift,
                    "end": min(w['end'], seg_end) + shift,
                    "word": w['word']
                })
        offset += seg_end - seg_start

    return {
        "start": 0.0,
        "end": offset,
        "segments": out_segments,
        "words": out_words,
        "layout": layout
    }

def parse_eq_filter(color_filter):
    # "eq=contrast=1.1:saturation=1.2" -> {"contrast": "1.1", "saturation": "1.2"}
    params = color_filter[3:] if color_filter.startswith('eq=') else color_filter
    return dict(kv.split('=', 1) for kv in params.split(':') if '=' in kv)

def process_auto_edit(job_id, video_url, layout, style, prompt, progress_callback, input_dir, processed_dir, clips_dir):
    progress_callback(5, "Initializing advanced editor...")

    # Load Config
    style_config = load_style_config(style)

    # 1. Download Video
    progress_callback(10, "Downloading high-quality video...")
    if video_url.startswith('file://'):
        video_path = resolve_local_upload(video_url, input_dir)
    else:
        video_path = download_video(video_url, input_dir)

    # 2. Audio & Transcription
    progress_callback(25, "Extracting audio and performing word-level transcription...")
    audio_path = extract_audio(video_path, processed_dir)
    transcript_data = transcribe_audio(audio_path)

    segments = transcript_data.get("segments", [])
    if not segments:
        raise Exception("Transcription failed: no speech was transcribed.")

    # 3. AI Analysis (Storyline & Metadata)
    progress_callback(45, "AI analyzing storyline and pacing...")
    analysis = analyze_storyline_and_metadata(transcript_data, style, prompt)

    plan = build_edit_plan(segments, analysis.get("kept_segment_indices") or [])
    if not plan:
        raise Exception("No usable speech segments to edit.")
    zoom_indices = set(analysis.get("zoom_indices") or [])

    target_w, target_h = LAYOUT_SIZES.get(layout, LAYOUT_SIZES['16:9'])

    # 4. Generate Subtitles
    progress_callback(60, "Generating animated subtitles and VFX plan...")
    clip_data = build_subtitle_clip_data(plan, transcript_data.get("words", []), layout)
    ass_path = os.path.join(processed_dir, f"subtitles_{job_id}.ass")
    create_ass(clip_data, ass_path, is_vertical=(target_h > target_w), style_config=style_config,
               play_res=(target_w, target_h))

    # 5. FFmpeg Assembly (Cuts, Zooms, Color, Subtitles)
    progress_callback(75, "Rendering final professional cut (Color, VFX, Subtitles)...")

    output_filename = f"advanced_{job_id}.mp4"
    output_path = os.path.join(clips_dir, output_filename)
    base_output_path = output_path.replace(".mp4", "_base.mp4")

    try:
        input_vid = ffmpeg.input(video_path)
        concat_v = []
        concat_a = []

        # Extract each kept segment, apply filters, and concat
        for seg_index, seg in plan:
            start = seg['start']
            end = seg['end']

            # Extract video part
            v_part = input_vid.video.trim(start=start, end=end).setpts('PTS-STARTPTS')
            a_part = input_vid.audio.filter('atrim', start=start, end=end).filter('asetpts', 'PTS-STARTPTS')

            # Apply Layout Crop/Scale
            if layout == '9:16':
                v_part = v_part.filter('crop', 'min(iw,ih*9/16)', 'min(ih,iw*16/9)')
            elif layout == '1:1':
                v_part = v_part.filter('crop', 'min(iw,ih)', 'min(ih,iw)')
            else:
                v_part = v_part.filter('crop', 'min(iw,ih*16/9)', 'min(ih,iw*9/16)')
            v_part = v_part.filter('scale', target_w, target_h)

            # Apply Zoom if designated
            if seg_index in zoom_indices:
                # 10% punch in
                v_part = v_part.filter('scale', int(target_w*1.1), int(target_h*1.1)).filter('crop', target_w, target_h)

            # Apply Color Grading
            if style_config.get("colorFilter"):
                v_part = v_part.filter_('eq', **parse_eq_filter(style_config["colorFilter"]))

            concat_v.append(v_part)
            concat_a.append(a_part)

        joined_v = ffmpeg.concat(*concat_v, v=1, a=0)
        joined_a = ffmpeg.concat(*concat_a, v=0, a=1)

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
    except ffmpeg.Error as e:
        # Fail the job with ffmpeg's reason rather than shipping an unedited fallback as a success
        stderr = e.stderr.decode('utf-8', errors='ignore').strip() if e.stderr else ''
        print(f"FFMPEG STDERR:\n{stderr}")
        reason = stderr.splitlines()[-1] if stderr else str(e)
        raise Exception(f"Rendering failed: {reason}") from e
    finally:
        # Cleanup base clip
        try:
            os.remove(base_output_path)
        except OSError:
            pass

    progress_callback(100, "Finalizing professional edit...")
    return output_path, analysis
