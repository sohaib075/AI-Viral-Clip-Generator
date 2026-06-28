from pytubefix import YouTube
from pytubefix.cli import on_progress

url = "https://youtu.be/NlBUZvFUA-E?si=hYI7ypDn8z2h-jE1"

try:
    yt = YouTube(url, use_po_token=True)
    print("Title:", yt.title)
    ys = yt.streams.get_highest_resolution()
    print("Downloading stream:", ys)
    # ys.download() # Skip download for quick test
    print("Success!")
except Exception as e:
    print("Error:", e)
