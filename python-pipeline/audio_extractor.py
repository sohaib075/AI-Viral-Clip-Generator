import ffmpeg
import os

def extract_audio(video_path, output_dir):
    """
    Extracts the audio track from a video file and saves it as a 16kHz mono WAV file,
    which is optimal for Whisper transcription.
    Returns the path to the extracted audio file.
    """
    base_name = os.path.basename(video_path)
    file_name_without_ext = os.path.splitext(base_name)[0]
    audio_output_path = os.path.join(output_dir, f"{file_name_without_ext}.wav")
    
    try:
        import imageio_ffmpeg
        (
            ffmpeg
            .input(video_path)
            .output(audio_output_path, acodec='pcm_s16le', ac=1, ar='16k')
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
