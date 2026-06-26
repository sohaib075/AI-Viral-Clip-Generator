import yt_dlp
import os
import imageio_ffmpeg

def download_video(url, output_dir, progress_callback=None):
    """
    Downloads a video from the given URL using yt-dlp.
    Returns the path to the downloaded video file.
    """
    ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
    
    def my_hook(d):
        if d['status'] == 'downloading':
            p_str = d.get('_percent_str', '').strip().replace('%', '')
            # Handle ansi escape codes in percent_str
            import re
            p_str = re.sub(r'\x1b\[[0-9;]*m', '', p_str)
            if p_str and progress_callback:
                try:
                    progress_callback(float(p_str))
                except ValueError:
                    pass

    ydl_opts = {
        'format': 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        'outtmpl': os.path.join(output_dir, '%(id)s.%(ext)s'),
        'merge_output_format': 'mp4',
        'noplaylist': True,
        'ffmpeg_location': ffmpeg_path,
        'progress_hooks': [my_hook] if progress_callback else [],
        'concurrent_fragment_downloads': 5,
        'hls_prefer_native': True
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info_dict = ydl.extract_info(url, download=True)
        filename = ydl.prepare_filename(info_dict)
        # Handle cases where merge changes the extension
        if not filename.endswith('.mp4'):
            filename = os.path.splitext(filename)[0] + '.mp4'
        return filename

if __name__ == '__main__':
    # Test
    # download_video('https://www.youtube.com/watch?v=dQw4w9WgXcQ', '../temp')
    pass
