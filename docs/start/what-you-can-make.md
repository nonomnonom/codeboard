# What Codeboard can do

Codeboard is a code-first engine for editable 2D artwork, storyboards, and animation. You write
TypeScript to create drawings, arrange shots, set timing, and render images or movies. A coding
agent can run the same library and CLI, inspect saved work, and apply a targeted revision.

The useful output is both the artwork you can view and the project you can keep editing.
Source code describes how you authored it; a saved `.cboard` contains the current editable
state. Start with [project concepts](project-model.md) to understand those objects, or follow
[the workflow](../workflow/production.md) from a brief to a reviewed export.

## Make drawings and illustrations

Combine vector contours, pressure-sensitive strokes, text, and pixel surfaces. Arrange them
in layers and groups, use masks or clipping, and revise individual marks later. Brushes can
use procedural settings or imported tips. Pixel selections support operations such as
feathering and local painting.

Choose the representation for the edit you need: contour points for a silhouette, pen
samples for a textured stroke, or pixels for a painted patch. Imported pixels remain pixels;
automatic image-to-vector conversion is an external step.

Read [drawing](../drawing/marks.md), [brushes](../drawing/brushes.md), [pixels](../drawing/pixels.md), and [layers](../drawing/layers.md).

## Develop a storyboard and animatic

Organize sequences, scenes, shots, and panels. Store action, dialogue and camera captions;
set panel durations; add camera motion and audio; then export sheets or an animatic movie.
Structured script records and the supported CSV/Final Draft subset help retain IDs and
track changes between script and board.

Captions and script links describe the intended scene. Artwork and acting still need to be
authored and reviewed. Example stories are sample inputs, so their characters, style and
durations do not become requirements for your project.

Read [storyboards](../animation/storyboards.md), [camera](../animation/camera.md), and [audio](../audio/board-audio.md).

## Animate editable 2D artwork

Use transform keys for movement and drawing substitutions for changes of pose or expression.
Control easing, holds, exposure ranges, pivots and camera framing. Rigging tools include
two-bone IK, rest poses, mesh/curve/envelope deformation, explicit skin weights, and named
controllers. Supplied mouth cues can become editable drawing exposures with manual corrections.

Shot-local animation separates the performance from its position in an edit. Reordering or
trimming editorial clips can reuse the same source shot. Board timing and shot-local timing
are distinct domains; see [frames and units](project-model.md#frames-are-positions-durations-are-counts)
before combining them.

Read [animation](../animation/timing.md), [rig workflow](../animation/rigging.md), and [onion skins](../animation/onion-skins.md).

## Reuse and revise assets

Reuse editable components and shared solid-color palette bindings. Tracked component
instances retain a source baseline so an upgrade can report conflicts with local edits.
Keep published versions when old shots must remain reproducible.

Asset refresh and conflict-aware upgrade have different behavior. A refresh can replace
instance artwork; an upgrade requires a tracked baseline and explicit choices for conflicts.
See [components](../drawing/components.md) before choosing an operation.

## Composite, add sound, and deliver

Combine masks, blend modes, and ordered layer effects. Shot compositing graphs connect source,
effect, mask, and blend nodes. Studio audio uses source sample ranges and rational placement;
mixing and stems support explicit trimming, gain, and fades.

Render PNGs, storyboard sheets/PDFs, or movies. Saved frame jobs pin inputs and store checked
frames so an interrupted render can resume. Output profiles can resize images, retain alpha,
or flatten against a chosen background. Movie encoding and media decoding require compatible
FFmpeg/ffprobe installations.

The current image pipeline uses RGBA8 surfaces. Color-managed image import does not establish
a float/linear compositor, HDR master, or arbitrary working/view/output color transform.
See [export](../delivery/export.md) for the supported profiles and [audio](../audio/board-audio.md) for mix limits.

## Inspect work and make a precise correction

Render an exact frame, a contact sheet, an onion-skin comparison, or a detail crop. Query stable
object IDs, then change the intended layer, drawing, timing, or pixel region. Save a named
revision when you need a checkpoint.

Persisted edit plans provide a dry run, version checks, and a durable commit receipt. Retrying
the same request can return that receipt without applying the edit twice. Snapshot review
exports record the source and image hashes. A passing validation or resolved comment does
not supply an artistic approval.

Read [review](../workflow/review.md), [projects and revisions](../workflow/projects.md), and [agent workflow](../workflow/working-with-an-agent.md).

## Exchange supported data

| Input or output | Current scope | Learn more |
| --- | --- | --- |
| Native `.cboard` | Editable project storage, revisions, embedded media, copy and publish workflows | [Projects](../workflow/projects.md) |
| PNG/image pixels | Decode into editable RGBA8 surfaces; patch and re-encode | [Pixels](../drawing/pixels.md) |
| PSD input | Untagged RGB8 pixel layers and isolated groups, with explicit metadata loss reports; unsupported artwork rejects | [PSD subset](../drawing/pixels.md#import-editable-psd-pixels) |
| OTIO | Explicitly bound media references on one video cut track, preserving supported source ranges | [OTIO subset](../animation/otio.md) |
| Script/CSV | Stable script records, captions and explicit board mappings; Final Draft support is a subset | [Storyboards](../animation/storyboards.md) |

Primitive [3D scenes](../drawing/three.md) retain their camera, solids, lights, and animation keys inside `.cboard`. Their SVG renderer has a bounded feature set.

PSD export, imported 3D models, automatic speech recognition, and native Harmony project
interchange are outside the current native support described here. OTIO cut support does not
imply AAF/FCPXML support or automatic baking of unsupported transitions.

## Choose a starting point

| Your first task | Start here | Inspect before expanding |
| --- | --- | --- |
| A drawing or technical illustration | [Quickstart](first-drawing.md), then [drawing](../drawing/marks.md) | One full-size PNG and the saved editable project |
| A storyboard or animatic | [Storyboard guide](../animation/storyboards.md) | Contact sheet, captions and pacing |
| A character performance | [Animation](../animation/timing.md) and [rig workflow](../animation/rigging.md) | Key poses, deformation and exact-frame comparisons |
| A correction to existing work | [Agent workflow](../workflow/working-with-an-agent.md) | Current saved version, target IDs and before/after frames |
| Reusable animation authored in code | [Drawing sequence](../learn/drawing-sequence.md) | Drawing choices, placement keys and saved revisions |

For the operations exposed by your installed engine, run `codeboard capabilities` or call
`await capabilities()` from the library. Read each feature's constraints as well as its status.
This inventory describes implemented scope; it is not a declaration that every production
workflow has been qualified. The [API guide](../reference/index.md) maps tasks to callable operations.
