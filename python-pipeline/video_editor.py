import os
import re
import uuid
import ffmpeg

from media_utils import run_ffmpeg, remove_files

def verify_ass_file(ass_path):
    if not os.path.exists(ass_path):
        return False
    with open(ass_path, 'r', encoding='utf-8') as f:
        content = f.read()
        if "Dialogue:" not in content:
            return False
    return True

def verify_video_file(video_path):
    if not os.path.exists(video_path):
        return False
    if os.path.getsize(video_path) < 1000:
        return False
    return True

def split_segment(segment, max_words=3):
    """
    Splits a segment into smaller segments with a maximum word count.
    Distributes start and end timestamps proportionally based on word count.
    """
    text = segment.get("text", "").strip()
    words = text.split()
    if not words:
        return []
    if len(words) <= max_words:
        return [segment]
        
    start = segment.get("start", 0.0)
    end = segment.get("end", 0.0)
    duration = end - start
    if duration <= 0:
        return [segment]
        
    total_words = len(words)
    split_segs = []
    
    # Split words into chunks of max_words size
    chunks = [words[i:i + max_words] for i in range(0, total_words, max_words)]
    
    current_time = start
    for chunk in chunks:
        chunk_text = " ".join(chunk)
        chunk_word_count = len(chunk)
        chunk_duration = (chunk_word_count / total_words) * duration
        
        split_segs.append({
            "start": current_time,
            "end": current_time + chunk_duration,
            "text": chunk_text
        })
        current_time += chunk_duration
        
    return split_segs

def create_srt(clip_data, output_path):
    """
    Creates a synchronized SRT file.
    """
    with open(output_path, 'w', encoding='utf-8') as f:
        clip_start = clip_data.get('start', clip_data.get('start_time', 0.0))
        clip_end = clip_data.get('end', clip_data.get('end_time', 0.0))
        segments = clip_data.get('segments', [])
        
        def format_time(ms):
            s, ms = divmod(ms, 1000)
            m, s = divmod(s, 60)
            h, m = divmod(m, 60)
            return f"{int(h):02d}:{int(m):02d}:{int(s):02d},{int(ms):03d}"
            
        if not segments:
            end_ms = int((clip_end - clip_start) * 1000)
            f.write("1\n")
            f.write(f"{format_time(0)} --> {format_time(end_ms)}\n")
            f.write(f"{clip_data.get('text', clip_data.get('title', 'Clip Highlight')).strip()}\n\n")
            return output_path
            
        split_segments = []
        for seg in segments:
            split_segments.extend(split_segment(seg, max_words=3))
            
        for i, seg in enumerate(split_segments):
            seg_start_relative = max(0.0, seg['start'] - clip_start)
            seg_end_relative = max(0.0, seg['end'] - clip_start)
            
            clip_duration = clip_end - clip_start
            if seg_end_relative > clip_duration:
                seg_end_relative = clip_duration
                
            if seg_start_relative >= seg_end_relative:
                continue
                
            start_ms = int(seg_start_relative * 1000)
            end_ms = int(seg_end_relative * 1000)
            
            f.write(f"{i+1}\n")
            f.write(f"{format_time(start_ms)} --> {format_time(end_ms)}\n")
            f.write(f"{seg['text'].strip()}\n\n")
            
    return output_path

def slugify(text):
    import re
    if not text:
        return "clip"
    text = text.lower().strip()
    text = re.sub(r'[\s\-]+', '_', text)
    text = re.sub(r'[^\w]', '', text)
    text = text.strip('_')
    return text[:30] if text else "clip"

def extract_thumbnail(video_path, time_offset, output_path):
    """Saves one frame as a JPEG. Returns the path, or None if no frame could be written."""
    try:
        run_ffmpeg(
            ffmpeg
            .input(video_path, ss=time_offset)
            .output(output_path, vframes=1, format='image2', vcodec='mjpeg')
        )
        return output_path if os.path.exists(output_path) else None
    except Exception as e:
        print(f"Error extracting thumbnail: {e}")
        return None

def create_ass(clip_data, output_path, is_vertical=True, style_config=None, play_res=None):
    """
    Creates an ASS file with exact word timings if available, customized by style_config.
    play_res optionally sets the (width, height) the subtitles are laid out for;
    by default it is 1080x1920 for vertical and 1920x1080 otherwise.
    """
    clip_start = clip_data.get('start', clip_data.get('start_time', 0.0))
    clip_end = clip_data.get('end', clip_data.get('end_time', 0.0))
    clip_duration = clip_end - clip_start
    
    words_data = clip_data.get('words', [])
    segments = clip_data.get('segments', [])
    
    if clip_duration <= 0:
        if words_data:
            clip_start = max(0.0, words_data[0].get('start', 0.0))
            clip_end = max(clip_start + 1.0, words_data[-1].get('end', 1.0))
            clip_duration = clip_end - clip_start
        elif segments:
            clip_start = max(0.0, segments[0].get('start', 0.0))
            clip_end = max(clip_start + 1.0, segments[-1].get('end', 1.0))
            clip_duration = clip_end - clip_start
        else:
            clip_duration = 15.0
    
    # Defaults and config overrides
    config = style_config or {}
    theme = config.get('theme', 'Modern')
    font_name = config.get('fontName', 'Arial Black')
    font_size = config.get('fontSize', 64 if is_vertical else 44)
    primary_color = config.get('primaryColor', '&H00FFFFFF')  # Default White
    highlight_color = config.get('highlightColor', '&H0000FFFF')  # Default Yellow
    margin_v = config.get('marginV', 500 if is_vertical else 80)
    
    def format_ass_time(sec):
        if sec < 0: sec = 0
        # Round once to whole centiseconds so e.g. 59.999s becomes 0:01:00.00
        total_cs = int(round(sec * 100))
        h = total_cs // 360000
        m = (total_cs // 6000) % 60
        s = (total_cs // 100) % 60
        cs = total_cs % 100
        return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

    if play_res:
        play_res_x, play_res_y = play_res
    else:
        play_res_x = 1080 if is_vertical else 1920
        play_res_y = 1920 if is_vertical else 1080

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("[Script Info]\n")
        f.write(f"Title: {theme} Subtitles\n")
        f.write("ScriptType: v4.00+\n")
        f.write(f"PlayResX: {play_res_x}\n")
        f.write(f"PlayResY: {play_res_y}\n")
        f.write("ScaledBorderAndShadow: yes\n\n")

        f.write("[V4+ Styles]\n")
        f.write("Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n")
        # Base Style
        f.write(f"Style: Default,{font_name},{font_size},{primary_color},&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,4,2,2,40,40,{margin_v},1\n\n")

        f.write("[Events]\n")
        f.write("Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n")

        if not words_data:
            # Fallback to segments if no words (e.g. mock data or error)
            if not segments:
                text = clip_data.get('text', clip_data.get('title', 'Clip Highlight')).strip()
                f.write(f"Dialogue: 0,{format_ass_time(0)},{format_ass_time(clip_duration)},Default,,0,0,0,,{text}\n")
                return output_path

            split_segments = []
            for seg in segments:
                split_segments.extend(split_segment(seg, max_words=3))

            for seg in split_segments:
                seg_start_relative = max(0.0, seg['start'] - clip_start)
                seg_end_relative = max(0.0, min(seg['end'] - clip_start, clip_duration))
                if seg_start_relative >= seg_end_relative: continue
                f.write(f"Dialogue: 0,{format_ass_time(seg_start_relative)},{format_ass_time(seg_end_relative)},Default,,0,0,0,,{seg['text'].strip()}\n")
            return output_path

        # Word-level perfect timing processing
        # We group words into small phrases (e.g. 3 words max) so the screen isn't just 1 word at a time,
        # but we highlight the specific active word using its exact start/end.
        current_phrase = []
        phrase_start = 0.0
        
        for w in words_data:
            w_start = w['start'] - clip_start
            w_end = w['end'] - clip_start
            w_text = str(w.get('word', '')).strip()
            if not w_text:
                continue  # Whisper occasionally emits empty word tokens

            if w_start < 0:
                if w_end > 0: w_start = 0.0
                else: continue
            if w_end > clip_duration:
                w_end = clip_duration
                
            if w_start >= clip_duration:
                continue

            current_phrase.append({"word": w_text, "start": w_start, "end": w_end})
            
            # End phrase if we hit 3 words or there's a big gap
            if len(current_phrase) >= 3 or w_text[-1] in ".?!":
                # Render phrase word by word
                for idx, active_w in enumerate(current_phrase):
                    line_start = active_w["start"]
                    line_end = active_w["end"]
                    
                    # Extend phrase visibility duration if it's the last word?
                    # In ASS, we write multiple Dialogue lines overlapping in time? No, we write one Dialogue line per active word time.
                    
                    # For perfect sync, we just show the phrase during the active word's time? No, usually a 3-word phrase is shown for the duration of all 3 words,
                    # and we color the active word during its specific time window.
                    pass
                
                # To do progressive highlighting properly in ASS:
                # We emit one dialogue line for each word's duration. The line contains the full phrase, but only the active word is highlighted.
                phrase_overall_start = current_phrase[0]["start"]
                phrase_overall_end = current_phrase[-1]["end"]
                
                # Ensure continuous display (fill tiny gaps between words in the same phrase)
                for idx, active_w in enumerate(current_phrase):
                    active_start = active_w["start"]
                    active_end = active_w["end"]
                    
                    # If there's a gap to the next word, maybe fill it. But whisper timestamps are usually tight.
                    formatted_words = []
                    for inner_idx, inner_w in enumerate(current_phrase):
                        if inner_idx == idx:
                            # Highlighted active word
                            formatted_words.append(f"{{\\c{highlight_color}&\\fscx115\\fscy115}}{inner_w['word']}{{\\r}}")
                        else:
                            formatted_words.append(inner_w['word'])
                            
                    line_text = " ".join(formatted_words)
                    f.write(f"Dialogue: 0,{format_ass_time(active_start)},{format_ass_time(active_end)},Default,,0,0,0,,{line_text}\n")

                current_phrase = []
                
        # Flush any remaining words
        if current_phrase:
            for idx, active_w in enumerate(current_phrase):
                active_start = active_w["start"]
                active_end = active_w["end"]
                
                formatted_words = []
                for inner_idx, inner_w in enumerate(current_phrase):
                    if inner_idx == idx:
                        formatted_words.append(f"{{\\c{highlight_color}&\\fscx115\\fscy115}}{inner_w['word']}{{\\r}}")
                    else:
                        formatted_words.append(inner_w['word'])
                        
                line_text = " ".join(formatted_words)
                f.write(f"Dialogue: 0,{format_ass_time(active_start)},{format_ass_time(active_end)},Default,,0,0,0,,{line_text}\n")

    return output_path

def process_clip(video_path, clip_data, clips_dir, subtitles_dir, job_id, clip_index):
    """
    Cuts the BASE video and generates the default FINAL video with burned subtitles simultaneously.
    """
    title = clip_data.get('title', f"Clip {clip_index + 1}")
    slugified_title = slugify(title)
    seq_str = f"{clip_index + 1:02d}"
    
    base_clip_filename = f"Clip_{seq_str}_{slugified_title}_{job_id}_base.mp4"
    final_clip_filename = f"Clip_{seq_str}_{slugified_title}_{job_id}_final.mp4"
    thumbnail_filename = f"Thumbnail_{seq_str}_{slugified_title}_{job_id}.jpg"
    srt_filename = f"Sub_{seq_str}_{slugified_title}_{job_id}.srt"
    
    base_clip_path = os.path.join(clips_dir, base_clip_filename)
    final_clip_path = os.path.join(clips_dir, final_clip_filename)
    thumbnail_path = os.path.join(clips_dir, thumbnail_filename)
    srt_path = os.path.join(subtitles_dir, srt_filename)
    
    start_time = clip_data.get('start', clip_data.get('start_time', 0.0))
    end_time = clip_data.get('end', clip_data.get('end_time', 0.0))
    duration = end_time - start_time
    
    layout = clip_data.get('layout', 'vertical')
    is_vertical = (layout != 'horizontal')

    if is_vertical:
        vf_filter = f"crop=min(iw\\,ih*9/16):min(ih\\,iw*16/9),scale=1080:1920"
    else:
        # Fit inside 16:9 without stretching, padding the rest
        vf_filter = "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2"

    try:
        run_ffmpeg(
            ffmpeg
            .input(video_path, ss=start_time, t=duration)
            .output(
                base_clip_path,
                vf=vf_filter,
                vcodec="libx264",
                acodec="aac",
                preset="ultrafast",
                crf=23,
                pix_fmt="yuv420p"
            )
        )

        if not verify_video_file(base_clip_path):
            raise Exception("Base video verification failed: missing or empty output.")

        # Very short clips (e.g. a highlight at the very end of the source) have no frame at 1s
        thumbnail_path = extract_thumbnail(base_clip_path, min(1.0, duration / 2), thumbnail_path)
        
        create_srt(clip_data, srt_path)
        
        # Automatically burn default subtitles for the final clip
        default_style = {'theme': 'Modern', 'fontName': 'Arial Black'}
        burn_subtitles(base_clip_path, clip_data, default_style, final_clip_path)
        
        if not verify_video_file(final_clip_path):
            raise Exception("Final video verification failed: missing or empty output.")
            
        return final_clip_path, base_clip_path, srt_path, thumbnail_path
    except Exception as e:
        print(f"Error processing clip {clip_index}: {str(e)}")
        raise e

def burn_ass_file(input_path, ass_path, output_path, preset="ultrafast"):
    """
    Renders input_path with the ASS subtitles burned in. ffmpeg runs inside the subtitle file's folder and
    refers to it by a plain name, so drive letters, spaces or apostrophes in the install path can't break
    the filter. The video is written to a temporary name first, so a failed or concurrent render never
    leaves a half-written file at output_path.
    """
    ass_name = os.path.basename(ass_path)
    if not re.fullmatch(r'[\w.-]+', ass_name):
        raise ValueError(f"Unsafe subtitle file name: {ass_name}")

    temp_output = f"{os.path.splitext(output_path)[0]}.rendering_{uuid.uuid4().hex}.mp4"
    try:
        run_ffmpeg(
            ffmpeg
            .input(input_path)
            .output(
                temp_output,
                vf=f"subtitles={ass_name}",
                vcodec="libx264",
                acodec="copy", # Copy audio
                preset=preset,
                crf=23,
                pix_fmt="yuv420p"
            ),
            cwd=os.path.dirname(ass_path)
        )
        os.replace(temp_output, output_path)
    finally:
        remove_files(temp_output)
    return output_path

def burn_subtitles(base_clip_path, clip_data, style_config, output_path):
    """
    Takes a base clip and burns custom subtitles into it.
    """
    layout = clip_data.get('layout', 'vertical')
    is_vertical = (layout != 'horizontal')

    # Create ASS file with a unique, filter-safe name next to the output
    output_stem = re.sub(r'[^\w.-]', '_', os.path.splitext(os.path.basename(output_path))[0])
    ass_path = os.path.join(os.path.dirname(output_path), f"{output_stem}_{uuid.uuid4().hex[:8]}.ass")
    try:
        create_ass(clip_data, ass_path, is_vertical=is_vertical, style_config=style_config)

        if not verify_ass_file(ass_path):
            raise Exception("ASS file verification failed: empty or missing Dialogue events.")

        return burn_ass_file(base_clip_path, ass_path, output_path)
    finally:
        remove_files(ass_path)

if __name__ == '__main__':
    pass
