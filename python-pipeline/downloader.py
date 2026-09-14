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
            import re
            p_str = re.sub(r'\x1b\[[0-9;]*m', '', p_str)
            if p_str and progress_callback:
                try:
                    progress_callback(float(p_str))
                except ValueError:
                    pass

    base_ydl_opts = {
        'format': 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        'outtmpl': os.path.join(output_dir, '%(id)s.%(ext)s'),
        'merge_output_format': 'mp4',
        'noplaylist': True,
        'ffmpeg_location': ffmpeg_path,
        'progress_hooks': [my_hook] if progress_callback else [],
        'concurrent_fragment_downloads': 5,
        'hls_prefer_native': True,
        'socket_timeout': 60,
        'retries': 15,
        'fragment_retries': 15,
        'extractor_args': {'youtube': ['player_client=android,web']}
    }
    
    browsers_to_try = [None, 'chrome', 'edge', 'firefox', 'brave', 'opera', 'vivaldi']
    errors = []
    
    for browser in browsers_to_try:
        ydl_opts = base_ydl_opts.copy()
        if browser:
            print(f"[yt-dlp] Attempting download using {browser} cookies to bypass bot detection...")
            ydl_opts['cookiesfrombrowser'] = (browser, )
        else:
            print(f"[yt-dlp] Attempting download without cookies using Android client...")
            
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info_dict = ydl.extract_info(url, download=True)
                filename = ydl.prepare_filename(info_dict)
                if not filename.endswith('.mp4'):
                    filename = os.path.splitext(filename)[0] + '.mp4'
                return filename
        except Exception as e:
            err_str = str(e).lower()
            errors.append(str(e))
            # Catch bot detection, missing cookies, or locked database errors to retry with next browser
            if 'sign in' in err_str or 'cookie' in err_str or 'locked' in err_str or 'sqlite' in err_str or 'bot' in err_str:
                continue
            else:
                # If it's a completely different error (e.g. video unavailable), fail immediately
                raise e
                
    # All options failed. Fail loudly instead of substituting a different video,
    # otherwise the job would "succeed" with clips from the wrong source.
    hint = "YouTube blocked the download (bot detection or sign-in required)."
    if any('locked' in err.lower() for err in errors):
        hint = "Browser cookies could not be read because the browser database is locked. Close the browser and try again."
    last_error = errors[-1] if errors else "unknown error"
    raise Exception(f"Failed to download video. {hint} Last error: {last_error}")

if __name__ == '__main__':
    pass
