import ipaddress
import os
import re
import socket
from urllib.parse import urlparse

import yt_dlp
import imageio_ffmpeg

def resolve_local_upload(video_url, input_dir):
    """
    Resolves a file:// URL created by the backend for an uploaded video.
    Only files inside input_dir are accepted, so a caller can't point the
    pipeline at arbitrary files on disk.
    """
    # The backend builds this from the saved file's path without percent-encoding, so use it as-is
    raw_path = video_url[len('file://'):]
    real_path = os.path.normcase(os.path.realpath(raw_path))
    real_input_dir = os.path.normcase(os.path.realpath(input_dir))

    try:
        inside = os.path.commonpath([real_path, real_input_dir]) == real_input_dir
    except ValueError:
        # Different drives on Windows
        inside = False

    if not inside:
        raise ValueError("Uploaded file must be located in the upload folder.")
    if not os.path.isfile(real_path):
        raise FileNotFoundError(f"Uploaded file not found: {os.path.basename(raw_path)}")
    return real_path

def ensure_public_url(url):
    """
    Refuses URLs that point at this machine or a private network (internal services, cloud metadata
    endpoints). Set ALLOW_PRIVATE_URLS=1 to download from hosts on your own network.

    This checks the address the host resolves to right now. yt-dlp resolves and follows redirects
    itself afterwards, so a public host that redirects to a private one, or whose DNS record changes
    between this check and the download, would still be reached. Run the pipeline where it has no
    route to anything sensitive if you let untrusted people submit URLs.
    """
    parsed = urlparse(url)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname:
        raise ValueError("Video URL must start with http:// or https://")
    if os.environ.get('ALLOW_PRIVATE_URLS', '').lower() in ('1', 'true', 'yes'):
        return

    try:
        addresses = {info[4][0] for info in socket.getaddrinfo(parsed.hostname, None)}
    except socket.gaierror:
        raise ValueError(f"Could not find the website {parsed.hostname}.")
    for address in addresses:
        if not ipaddress.ip_address(address.split('%')[0]).is_global:
            raise ValueError("Video URLs must point to a public website.")

def download_video(url, output_dir, progress_callback=None, file_prefix=None):
    """
    Downloads a video from the given URL using yt-dlp.
    Returns (path to the downloaded video file, {"title", "duration"} from the site).
    file_prefix keeps files from different jobs apart when the same video is submitted twice.
    """
    ensure_public_url(url)
    ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()

    def my_hook(d):
        if d['status'] == 'downloading':
            p_str = d.get('_percent_str', '').strip().replace('%', '')
            p_str = re.sub(r'\x1b\[[0-9;]*m', '', p_str)
            if p_str and progress_callback:
                try:
                    progress_callback(float(p_str))
                except ValueError:
                    pass

    name_template = f"{file_prefix}_%(id)s.%(ext)s" if file_prefix else '%(id)s.%(ext)s'
    base_ydl_opts = {
        'format': 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best[height<=1080]/best',
        'outtmpl': os.path.join(output_dir, name_template),
        'merge_output_format': 'mp4',
        'noplaylist': True,
        'ffmpeg_location': ffmpeg_path,
        'progress_hooks': [my_hook] if progress_callback else [],
        'concurrent_fragment_downloads': 5,
        'hls_prefer_native': True,
        'socket_timeout': 60,
        'retries': 15,
        'fragment_retries': 15,
    }

    browsers_to_try = [None, 'chrome', 'edge', 'firefox', 'brave', 'opera', 'vivaldi']
    errors = []

    for browser in browsers_to_try:
        ydl_opts = base_ydl_opts.copy()
        if browser:
            print(f"[yt-dlp] Attempting download using {browser} cookies to bypass bot detection...")
            ydl_opts['cookiesfrombrowser'] = (browser, )
        else:
            print(f"[yt-dlp] Attempting download without cookies...")

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info_dict = ydl.extract_info(url, download=True)
                info = {"title": info_dict.get("title"), "duration": info_dict.get("duration")}
                # Prefer the path yt-dlp actually wrote: a single-file fallback format may not be .mp4
                downloads = info_dict.get('requested_downloads') or []
                candidates = [d.get('filepath') for d in downloads if d.get('filepath')]
                filename = ydl.prepare_filename(info_dict)
                candidates += [os.path.splitext(filename)[0] + '.mp4', filename]
                for candidate in candidates:
                    if os.path.exists(candidate):
                        return candidate, info
                raise Exception(f"Download finished but the video file was not found: {filename}")
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
    if any('locked' in err.lower() for err in errors[1:]):
        hint += " Browser cookies couldn't be read because a browser is open; close it and try again."
    # The first attempt (no cookies) carries the site's own error; later ones are about reading cookies
    site_error = errors[0] if errors else "unknown error"
    raise Exception(f"Failed to download video. {hint} Details: {site_error}")

if __name__ == '__main__':
    pass
