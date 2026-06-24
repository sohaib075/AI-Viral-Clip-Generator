import os
from moviepy import VideoFileClip
import ffmpeg

def create_srt(clip_data, output_path):
    """
    Creates a synchronized SRT file with phrase-by-phrase timing.
    Timestamps are shifted to be relative to the start of the generated clip.
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
            
        for i, seg in enumerate(segments):
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

def process_clip(video_path, clip_data, output_dir, clip_index):
    """
    Cuts the video and burns subtitles using a single optimized FFmpeg pass while preserving the original aspect ratio.
    """
    base_name = os.path.basename(video_path)
    file_name_without_ext = os.path.splitext(base_name)[0]
    
    # Extract times
    start_time = clip_data.get('start', clip_data.get('start_time', 0.0))
    end_time = clip_data.get('end', clip_data.get('end_time', 0.0))
    duration = end_time - start_time
    
    # Create SRT file
    srt_path = os.path.join(output_dir, f"{file_name_without_ext}_{clip_index}.srt")
    create_srt(clip_data, srt_path)
    srt_path_ffmpeg = srt_path.replace('\\', '/').replace(':', '\\:')
    
    final_output_path = os.path.join(output_dir, f"final_{file_name_without_ext}_clip_{clip_index}.mp4")
    
    import imageio_ffmpeg
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    
    try:
        # We use a pure ffmpeg command with complex filtergraph
        # -ss before -i is crucial for fast seeking
        # The filter burns subtitles while maintaining original video dimensions
        (
            ffmpeg
            .input(video_path, ss=start_time, t=duration)
            .output(
                final_output_path, 
                vf=f"subtitles='{srt_path_ffmpeg}':force_style='FontSize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=0,MarginV=30'",
                vcodec="libx264",
                acodec="aac",
                preset="ultrafast",
                crf=23
            )
            .overwrite_output()
            .run(cmd=ffmpeg_exe, quiet=True)
        )
        return final_output_path
    except ffmpeg.Error as e:
        print(f"Error processing clip {clip_index}: {e.stderr.decode() if e.stderr else str(e)}")
        raise e

if __name__ == '__main__':
    # Test
    pass
