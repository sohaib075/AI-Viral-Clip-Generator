import os
from moviepy import VideoFileClip
import ffmpeg

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
    Creates a synchronized SRT file with phrase-by-phrase timing.
    Timestamps are shifted to be relative to the start of the generated clip.
    Subtitles are split into short, punchy 3-word chunks for vertical social media.
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
            # Fallback if no segments found
            end_ms = int((clip_end - clip_start) * 1000)
            f.write("1\n")
            f.write(f"{format_time(0)} --> {format_time(end_ms)}\n")
            f.write(f"{clip_data.get('text', clip_data.get('title', 'Clip Highlight')).strip()}\n\n")
            return output_path
            
        # Split segments to keep subtitles short and punchy (3 words max)
        split_segments = []
        for seg in segments:
            split_segments.extend(split_segment(seg, max_words=3))
            
        for i, seg in enumerate(split_segments):
            # Shift timestamps to start at 00:00:00 for the newly cut video
            seg_start_relative = max(0.0, seg['start'] - clip_start)
            seg_end_relative = max(0.0, seg['end'] - clip_start)
            
            # If the segment goes beyond the clip duration, clamp it
            clip_duration = clip_end - clip_start
            if seg_end_relative > clip_duration:
                seg_end_relative = clip_duration
                
            # Skip if the segment doesn't make sense (e.g., negative duration)
            if seg_start_relative >= seg_end_relative:
                continue
                
            start_ms = int(seg_start_relative * 1000)
            end_ms = int(seg_end_relative * 1000)
            
            f.write(f"{i+1}\n")
            f.write(f"{format_time(start_ms)} --> {format_time(end_ms)}\n")
            f.write(f"{seg['text'].strip()}\n\n")
            
    return output_path

def slugify(text):
    """
    Converts a string to a clean alphanumeric-and-underscore path-safe string.
    """
    import re
    if not text:
        return "clip"
    text = text.lower().strip()
    text = re.sub(r'[\s\-]+', '_', text)
    text = re.sub(r'[^\w]', '', text)
    text = text.strip('_')
    return text[:30] if text else "clip"

def extract_thumbnail(video_path, time_offset, output_path):
    """
    Extracts a single frame from the video at the given timestamp and saves it as a JPG.
    """
    import imageio_ffmpeg
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    try:
        (
            ffmpeg
            .input(video_path, ss=time_offset)
            .output(output_path, vframes=1, format='image2', vcodec='mjpeg')
            .overwrite_output()
            .run(cmd=ffmpeg_exe, quiet=True)
        )
        return output_path
    except Exception as e:
        print(f"Error extracting thumbnail: {e}")
        return None

def create_ass(clip_data, output_path, is_vertical=True):
    """
    Creates an Advanced SubStation Alpha (ASS) file with:
    - Bold modern Arial Black typography.
    - Centered bottom-aligned placement raised for vertical layouts (MarginV=500).
    - Perfect word-by-word progressive highlights (Yellow & enlarged active word).
    Timestamps are shifted relative to the start of the clip.
    """
    clip_start = clip_data.get('start', clip_data.get('start_time', 0.0))
    clip_end = clip_data.get('end', clip_data.get('end_time', 0.0))
    segments = clip_data.get('segments', [])

    def format_ass_time(sec):
        if sec < 0:
            sec = 0
        h = int(sec // 3600)
        m = int((sec % 3600) // 60)
        s = int(sec % 60)
        cs = int(round((sec - int(sec)) * 100))
        if cs == 100:
            cs = 99
        return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

    # Layout parameters based on format
    if is_vertical:
        play_res_x = 1080
        play_res_y = 1920
        font_size = 64
        margin_v = 500  # Elevated above mobile overlays
    else:
        play_res_x = 1920
        play_res_y = 1080
        font_size = 44
        margin_v = 80   # Standard bottom placement

    with open(output_path, 'w', encoding='utf-8') as f:
        # 1. Script Info Section
        f.write("[Script Info]\n")
        f.write("Title: AI Viral Clips Premium Subtitles\n")
        f.write("ScriptType: v4.00+\n")
        f.write(f"PlayResX: {play_res_x}\n")
        f.write(f"PlayResY: {play_res_y}\n")
        f.write("ScaledBorderAndShadow: yes\n\n")

        # 2. Styles Section
        f.write("[V4+ Styles]\n")
        f.write("Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n")
        f.write(f"Style: Default,Arial Black,{font_size},&H00FFFFFF,&H0000FFFF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,4,2,2,40,40,{margin_v},1\n\n")

        # 3. Events Section
        f.write("[Events]\n")
        f.write("Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n")

        if not segments:
            duration = clip_end - clip_start
            text = clip_data.get('text', clip_data.get('title', 'Clip Highlight')).strip()
            f.write(f"Dialogue: 0,{format_ass_time(0)},{format_ass_time(duration)},Default,,0,0,0,,{text}\n")
            return output_path

        split_segments = []
        for seg in segments:
            split_segments.extend(split_segment(seg, max_words=3))

        for seg in split_segments:
            seg_start_relative = max(0.0, seg['start'] - clip_start)
            seg_end_relative = max(0.0, seg['end'] - clip_start)
            clip_duration = clip_end - clip_start
            if seg_end_relative > clip_duration:
                seg_end_relative = clip_duration

            if seg_start_relative >= seg_end_relative:
                continue

            text = seg['text'].strip()
            words = text.split()
            if not words:
                continue

            num_words = len(words)
            seg_duration = seg_end_relative - seg_start_relative
            clip_duration = clip_end - clip_start

            # Calculate weights based on character length and punctuation pauses
            import re
            weights = []
            for w in words:
                clean_w = re.sub(r'[^\w]', '', w)
                w_len = len(clean_w) if clean_w else 1
                
                # Check for punctuation pauses at the end of the word
                if w.endswith(('.', '?', '!')):
                    w_len += 4
                elif w.endswith((',', ';', ':', '-')):
                    w_len += 2
                weights.append(w_len)
                
            total_weight = sum(weights)
            if total_weight <= 0:
                total_weight = 1
                
            current_offset = 0.0
            
            for w_idx in range(num_words):
                w_dur = (weights[w_idx] / total_weight) * seg_duration
                w_start = seg_start_relative + current_offset
                w_end = w_start + w_dur
                current_offset += w_dur

                if w_idx == num_words - 1:
                    w_end = seg_end_relative

                # Boundary Validation & Clamping
                w_start = max(0.0, min(w_start, clip_duration))
                w_end = max(0.0, min(w_end, clip_duration))
                
                # Enforce minimum duration of 50ms if clamped together
                if w_start >= w_end:
                    if w_start < clip_duration - 0.05:
                        w_end = w_start + 0.05
                    elif w_start > 0.05:
                        w_start = w_end - 0.05
                    else:
                        continue # Skip if segment is completely invalid

                formatted_words = []
                for idx, w in enumerate(words):
                    if idx == w_idx:
                        # Highlight active word (Yellow and 15% size pop)
                        formatted_words.append(f"{{\\c&H0000FFFF&\\fscx115\\fscy115}}{w}{{\\r}}")
                    else:
                        formatted_words.append(w)

                line_text = " ".join(formatted_words)
                f.write(f"Dialogue: 0,{format_ass_time(w_start)},{format_ass_time(w_end)},Default,,0,0,0,,{line_text}\n")

    return output_path

def process_clip(video_path, clip_data, clips_dir, subtitles_dir, job_id, clip_index):
    """
    Cuts the video, scales to target layout format, and burns animated subtitles
    using a single optimized FFmpeg pass while ensuring cross-platform playability.
    Saves outputs in organized folders with unique, descriptive filenames.
    """
    title = clip_data.get('title', f"Clip {clip_index + 1}")
    slugified_title = slugify(title)
    seq_str = f"{clip_index + 1:02d}"
    
    # Filenames following convention:
    # Sub_[Seq]_[Slugified_Title]_[JobId].srt / .ass
    # Clip_[Seq]_[Slugified_Title]_[JobId].mp4
    # Thumbnail_[Seq]_[Slugified_Title]_[JobId].jpg
    srt_filename = f"Sub_{seq_str}_{slugified_title}_{job_id}.srt"
    ass_filename = f"Sub_{seq_str}_{slugified_title}_{job_id}.ass"
    clip_filename = f"Clip_{seq_str}_{slugified_title}_{job_id}.mp4"
    thumbnail_filename = f"Thumbnail_{seq_str}_{slugified_title}_{job_id}.jpg"
    
    srt_path = os.path.join(subtitles_dir, srt_filename)
    ass_path = os.path.join(subtitles_dir, ass_filename)
    final_output_path = os.path.join(clips_dir, clip_filename)
    thumbnail_path = os.path.join(clips_dir, thumbnail_filename)
    
    # Extract times
    start_time = clip_data.get('start', clip_data.get('start_time', 0.0))
    end_time = clip_data.get('end', clip_data.get('end_time', 0.0))
    duration = end_time - start_time
    
    # Create SRT and ASS files
    create_srt(clip_data, srt_path)
    
    layout = clip_data.get('layout', 'vertical')
    is_vertical = (layout != 'horizontal')
    create_ass(clip_data, ass_path, is_vertical=is_vertical)
    
    ass_path_ffmpeg = ass_path.replace('\\', '/').replace(':', '\\:')
    
    import imageio_ffmpeg
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    
    # Determine crop & scale layout
    if is_vertical:
        # Crop to 9:16 and scale to 1080x1920
        vf_filter = (
            f"crop=min(iw\\,ih*9/16):min(ih\\,iw*16/9),"
            f"scale=1080:1920,"
            f"subtitles='{ass_path_ffmpeg}'"
        )
    else:
        # Scale to 1920x1080 (no crop)
        vf_filter = (
            f"scale=1920:1080,"
            f"subtitles='{ass_path_ffmpeg}'"
        )
    
    try:
        (
            ffmpeg
            .input(video_path, ss=start_time, t=duration)
            .output(
                final_output_path, 
                vf=vf_filter,
                vcodec="libx264",
                acodec="aac",
                preset="ultrafast",
                crf=23,
                pix_fmt="yuv420p"  # Ensure compatibility with all mobile devices (iOS/Android)
            )
            .overwrite_output()
            .run(cmd=ffmpeg_exe, quiet=True)
        )
        
        # Extract a thumbnail from the final rendered clip at 1.0 second mark (or 0.0 if short)
        thumb_time = 1.0 if duration > 1.0 else 0.0
        extract_thumbnail(final_output_path, thumb_time, thumbnail_path)
        
        return final_output_path, srt_path, thumbnail_path
    except ffmpeg.Error as e:
        print(f"Error processing clip {clip_index}: {e.stderr.decode() if e.stderr else str(e)}")
        raise e

if __name__ == '__main__':
    # Test
    pass
