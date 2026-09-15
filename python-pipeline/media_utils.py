import os
import re
import subprocess

import imageio_ffmpeg

FFMPEG_EXE = imageio_ffmpeg.get_ffmpeg_exe()


def ffmpeg_error_summary(stderr):
    """The last few meaningful lines of ffmpeg's output, which usually name the actual problem."""
    text = stderr.decode('utf-8', errors='replace') if isinstance(stderr, bytes) else (stderr or '')
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return ' | '.join(lines[-3:]) if lines else 'unknown error'


def run_ffmpeg(stream, cwd=None):
    """
    Runs an ffmpeg-python stream, overwriting outputs. Raises RuntimeError with ffmpeg's own error message
    so job logs say why a render failed. `cwd` lets filters refer to files by a plain name.
    """
    args = stream.overwrite_output().compile(cmd=FFMPEG_EXE)
    result = subprocess.run(args, cwd=cwd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {ffmpeg_error_summary(result.stderr)}")


def get_media_duration(path):
    """Duration in seconds from ffmpeg's stream info, or None if it can't be read."""
    result = subprocess.run([FFMPEG_EXE, '-hide_banner', '-i', path], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    match = re.search(rb'Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)', result.stderr)
    if not match:
        return None
    hours, minutes, seconds = match.groups()
    return int(hours) * 3600 + int(minutes) * 60 + float(seconds)


def remove_files(*paths):
    """Deletes files that may or may not exist."""
    for path in paths:
        if path:
            try:
                os.remove(path)
            except OSError:
                pass
