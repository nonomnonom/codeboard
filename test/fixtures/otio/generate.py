"""Generate the conform fixture with OpenTimelineIO 0.18.1, not the Codeboard adapter."""
from pathlib import Path
import opentimelineio as otio

assert otio.__version__ == "0.18.1"
rt = otio.opentime.RationalTime
tr = otio.opentime.TimeRange
timeline = otio.schema.Timeline(name="Editorial reference")
track = otio.schema.Track(kind=otio.schema.TrackKind.Video)
timeline.tracks.append(track)
for name, url, rate, origin, length, start, duration in [
    ("Shot B", "media/shot-b.mov", 30, 0, 60, 6, 30),
    ("Shot A", "media/shot-a.mov", 24, 1001, 48, 1007, 18),
]:
    track.append(otio.schema.Clip(
        name=name,
        media_reference=otio.schema.ExternalReference(
            target_url=url,
            available_range=tr(rt(origin, rate), rt(length, rate)),
        ),
        source_range=tr(rt(start, rate), rt(duration, rate)),
    ))
path = Path(__file__).with_name("cuts.otio")
otio.adapters.write_to_file(timeline, str(path))
otio.adapters.write_to_file(timeline, str(path.with_name("cuts-v1.otio")), target_schema_versions={"Clip": 1})
assert timeline.duration().rescaled_to(24).value == 42
print(path)
