import ffmpeg
import os

def extract_audio(video_path, output_dir):
    """
    Extracts the audio track from a video file and saves it as a highly compressed mono MP3 file.
    This ensures the file size stays well under Groq's 25MB limit even for long podcasts (1-2 hours).
    Returns the path to the extracted audio file.
    """
    base_name = os.path.basename(video_path)
    file_name_without_ext = os.path.splitext(base_name)[0]
    audio_output_path = os.path.join(output_dir, f"{file_name_without_ext}.mp3")
    
    try:
        import imageio_ffmpeg
        (
            ffmpeg
            .input(video_path)
            .output(audio_output_path, acodec='libmp3lame', ac=1, ar='16k', audio_bitrate='32k')
            .overwrite_output()
            .run(cmd=imageio_ffmpeg.get_ffmpeg_exe(), quiet=True)
        )
        return audio_output_path
    except ffmpeg.Error as e:
        print(f"Error extracting audio: {e.stderr.decode() if e.stderr else str(e)}")
        raise

if __name__ == '__main__':
    # Test
    # extract_audio('../temp/sample.mp4', '../temp')
    pass
