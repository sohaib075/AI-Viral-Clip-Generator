import ffmpeg
import os

from media_utils import run_ffmpeg

def extract_audio(video_path, output_dir):
    """
    Extracts the audio track from a video file and saves it as a highly compressed mono MP3 file.
    Transcription splits it into 5-minute chunks, so each request stays far below Groq's 25MB limit.
    Returns the path to the extracted audio file.
    """
    base_name = os.path.basename(video_path)
    file_name_without_ext = os.path.splitext(base_name)[0]
    audio_output_path = os.path.join(output_dir, f"{file_name_without_ext}.mp3")

    try:
        run_ffmpeg(
            ffmpeg
            .input(video_path)
            .output(audio_output_path, acodec='libmp3lame', ac=1, ar='16k', audio_bitrate='32k')
        )
    except RuntimeError as e:
        raise RuntimeError(f"Could not extract audio (does the video have a sound track?): {e}") from e
    return audio_output_path

if __name__ == '__main__':
    # Test
    # extract_audio('../temp/sample.mp4', '../temp')
    pass
