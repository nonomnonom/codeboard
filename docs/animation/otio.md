# OTIO editorial conform

`importOTIO` maps an OpenTimelineIO cut list to existing shot animations.
`exportOTIO` writes an editorial sequence as OTIO JSON. Neither function reads
media URLs or embeds artwork. Keep the original OTIO file and the editable
Codeboard project with the exported edit.

```ts
import { importOTIO, exportOTIO } from "codeboard-studio";

const media = [
  { animationId: "animation:shot-a", targetUrl: "media/shot-a.mov", sourceStartFrame: 1001 },
  { animationId: "animation:shot-b", targetUrl: "media/shot-b.mov" },
];
const result = importOTIO(otioJSON, project.studio.animations, {
  sequenceId: "edit:main",
  frameRate: { numerator: 24, denominator: 1 },
  media,
  lossPolicy: "report",
});
// Inspect result.losses before applying the conform to the saved project.
const plan = project.plan("Import editorial cuts", [
  { op: "editorial.put", sequence: result.sequence },
]);
await project.commit(plan, { requestId: "conform:revision-1" });
const exported = exportOTIO(result.sequence, project.studio.animations, { media });
```

Each media URL and animation ID must appear only once in `media`. Matching is
exact; names and basenames are never inferred. `sourceStartFrame` specifies the
external media frame corresponding to animation frame zero, at the animation's
rate. Its default is zero. An OTIO `available_range`, when present, must match
that origin and the mapped animation duration. A mapped animation retains its
artwork, camera, and native audio; the importer changes only the editorial cut list.

Source-in positions convert exactly to animation frames; clip durations convert
exactly to sequence frames. Unrepresentable boundaries fail instead of rounding.
For fractional frame rates, supply the actual rational sequence and animation
rates, such as `24000/1001`. Numeric OTIO rates are matched to those supplied
fractions; other rates retain their numeric value.

The adapter accepts `Timeline.1` → `Stack.1` → one `Track.1` of kind `Video`,
containing `Clip.1` or `Clip.2` with `ExternalReference.1`. Export writes `Clip.2`.
Stable clip IDs round-trip in `metadata.codeboard.clipId`; third-party clips
without that metadata receive IDs derived from the supplied sequence ID and
clip index. JSON is limited to 1 MiB and the video track to 1000 clips. These
contracts follow the [official serialized schema](https://github.com/AcademySoftwareFoundation/OpenTimelineIO/blob/v0.18.1/docs/tutorials/otio-serialized-schema.md).

`lossPolicy` defaults to `reject`. With `report`, unrepresented names, metadata,
markers, display colors, image bounds, inactive references, timeline origins,
and audio tracks may be omitted. The returned `losses` list identifies their
paths and reasons; reports above 256 KiB fail. Export reports native shot and
editorial audio separately. Media files may themselves contain sound; the
adapter neither probes nor alters them.

Transitions, gaps, effects/retimes, disabled items, trimmed compositions, nested
or multiple video tracks, and non-external references are rejected even with
`report`. Error details include the failing object path. Convert unsupported transitions in your editing application before importing.

<!-- study:otio-conform:start -->
**Rebuild a sequence from a cut list.** Which source picture appears at each point in an edit?

[![Read the samples in edit order. Each caption identifies the source shot and frame selected by the cut list.](../../website/public/art/guides/otio-conform.png)](../../website/public/art/guides/otio-conform.png)

Read the samples in edit order. Each caption identifies the source shot and frame selected by the cut list. The edit maps source ranges onto a timeline, including sources with different frame rates.

<!-- study:otio-conform:end -->
