from pytubefix import YouTube

yt = YouTube("https://youtu.be/PV2v6Bp-DuA?si=-1520mst-jXrjjYn", "WEB", use_po_token=True)
print("TITLE:", yt.title)
streams = yt.streams
print("STREAMS:", len(streams))
s = streams.get_highest_resolution()
print("CHOSEN:", s)
s.download(output="/tmp/pot_test_dl")
print("DOWNLOAD OK")
