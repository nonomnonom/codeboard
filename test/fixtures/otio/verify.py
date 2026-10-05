"""Verify the documentation study's export using the official OTIO implementation."""
import sys
import opentimelineio as otio

assert otio.__version__ == "0.18.1"
timeline = otio.adapters.read_from_file(sys.argv[1])
assert len(timeline.tracks) == 1
track = timeline.tracks[0]
assert track.kind == otio.schema.TrackKind.Video
assert len(track) == 2
assert timeline.duration().rescaled_to(24).value == 42
for index, (url, rate, start, duration, offset) in enumerate([
    ("media/shot-b.mov", 30, 6, 30, 0),
    ("media/shot-a.mov", 24, 1007, 18, 24),
]):
    clip = track[index]
    assert clip.media_reference.target_url == url
    assert clip.source_range.start_time.rescaled_to(rate).value == start
    assert clip.source_range.duration.rescaled_to(rate).value == duration
    assert track.range_of_child(clip).start_time.rescaled_to(24).value == offset
    assert clip.metadata["codeboard"]["clipId"] == f"edit:otio:clip:{index}"
otio.adapters.write_to_file(timeline, sys.argv[2])
print("OpenTimelineIO 0.18.1: two clips, exact trims/origins, 42 frames at 24 fps; reserialized successfully")
