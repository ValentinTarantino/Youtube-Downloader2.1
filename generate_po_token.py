from pytubefix import YouTube

VIDEO_URL = "https://youtu.be/PV2v6Bp-DuA?si=-1520mst-jXrjjYn"

yt = YouTube(VIDEO_URL, "WEB", use_po_token=True)
token = yt.pot

print("PO TOKEN:", token)
