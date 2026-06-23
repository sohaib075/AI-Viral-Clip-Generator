import os
from moviepy.editor import VideoFileClip
import ffmpeg

def create_srt(clip_data, output_path):
    """
    Creates an SRT file for a specific clip based on its transcript segment.
    Since we only have the overall segment text here, a robust implementation 
    would use the word-level timestamps from Whisper to generate the SRT.
    This is a simplified version.
    """
    with open(output_path, 'w', encoding='utf-8') as f:
        # SRT format
        # 1
        # 00:00:00,000 --> 00:00:05,000
        # Text
        start_ms = 0
        end_ms = int((clip_data['end'] - clip_data['start']) * 1000)
        
        def format_time(ms):
            s, ms = divmod(ms, 1000)
            m, s = divmod(s, 60)
            h, m = divmod(m, 60)
            return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
            
        f.write("1\n")
        f.write(f"{format_time(start_ms)} --> {format_time(end_ms)}\n")
        f.write(f"{clip_data['text'].strip()}\n")
    return output_path

def process_clip(video_path, clip_data, output_dir, clip_index):
    """
    Cuts the video, converts to 9:16, and burns subtitles.
    """
    base_name = os.path.basename(video_path)
    file_name_without_ext = os.path.splitext(base_name)[0]
    
    # 1. Cut video using MoviePy (or ffmpeg directly for speed)
    start_time = clip_data['start']
    end_time = clip_data['end']
    
    cut_video_path = os.path.join(output_dir, f"{file_name_without_ext}_cut_{clip_index}.mp4")
    
    with VideoFileClip(video_path) as video:
        clip = video.subclip(start_time, end_time)
        
        # 2. Crop to 9:16 (1080x1920)
        # Assuming original is 16:9 (1920x1080)
        w, h = clip.size
        target_w = int(h * 9 / 16)
        x_center = w / 2
        clip_cropped = clip.crop(x1=x_center - target_w/2, y1=0, x2=x_center + target_w/2, y2=h)
        clip_resized = clip_cropped.resize(height=1920, width=1080)
        
        # Write temporary cut file without subs
        temp_cut_path = os.path.join(output_dir, f"temp_{file_name_without_ext}_{clip_index}.mp4")
        clip_resized.write_videofile(temp_cut_path, codec="libx264", audio_codec="aac", fps=30, preset="ultrafast")
    
    # 3. Create SRT
    srt_path = os.path.join(output_dir, f"{file_name_without_ext}_{clip_index}.srt")
    create_srt(clip_data, srt_path)
    
    # 4. Burn subtitles using FFmpeg
    final_output_path = os.path.join(output_dir, f"final_{file_name_without_ext}_clip_{clip_index}.mp4")
    try:
        (
            ffmpeg
            .input(temp_cut_path)
            .output(final_output_path, vf=f"subtitles={srt_path}:force_style='FontSize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=0,MarginV=30'")
            .overwrite_output()
            .run(quiet=True)
        )
        # Cleanup temp
        if os.path.exists(temp_cut_path):
            os.remove(temp_cut_path)
        return final_output_path
    except ffmpeg.Error as e:
        print(f"Error burning subtitles: {e.stderr.decode() if e.stderr else str(e)}")
        # If ffmpeg fails, just return the temp cut path
        return temp_cut_path

if __name__ == '__main__':
    # Test
    pass
