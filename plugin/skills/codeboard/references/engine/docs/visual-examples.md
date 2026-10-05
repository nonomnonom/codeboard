# Visual examples you can run

These studies isolate one behavior at a time. Their images are rendered with Codeboard's public API.

The studies demonstrate named operations. Their geometry, labels, colors, and layout are example inputs, not product defaults. The audio and hierarchy images are explanatory diagrams, not playback or storage verification.

## Generate documentation images and videos

From the repository root, run `npm ci`, `npm run build`, then `npm run example:studies`. The generator writes the non-media image studies into a fresh `examples/studies/output/run-…/` directory. Add `-- --video` to include decoded audio/stems and motion videos. Video generation requires FFmpeg and ffprobe; `FFMPEG_PATH` and `FFPROBE_PATH` can select local executables.

For a standalone project, download [the studies source ZIP](https://codeboard.nonom.xyz/art/examples/studies.zip). Inside the extracted `studies` folder:

```sh
npm install
npm run typecheck
npm run author
npm run author -- --video
```

The [source project](../examples/studies/README.md) groups studies by feature domain under `src/studies/`. `src/catalog.ts` maps them to runtime capabilities; `src/config.ts` owns fixture settings. Each study produces an editable project and documentation image, plus video or reports where relevant. The ZIP includes the matching engine build so these examples can run before publication. Third-party dependencies are installed by npm.

Pass a new output directory with `npm run author -- /path/to/new-studies --video`. Existing destinations reject. `manifest.json` records generated/skipped outputs, feature constraints and pending visual review. The catalog covers the implemented parts of the current capability families, including the bounded OTIO cut-list adapter. Coverage does not mean every operation or production gate is qualified.

To update the website's assets from the checkout, run `npm run docs:assets -- --video`. This copies generated images/videos into `website/public/art/guides/` and creates the downloadable source ZIP. See the [generated coverage manifest](https://codeboard.nonom.xyz/art/guides/studies.json).

## Keep a local correction through an asset upgrade

![An amber kite, its local blue paint correction, then a library geometry update retaining the blue paint](https://codeboard.nonom.xyz/art/guides/component-upgrade.png)

The [TypeScript study](../examples/studies/src/studies/assets/component-upgrade/author.ts) instantiates a library kite, changes its paint locally, then upgrades its geometry using retained source identities. The last image comes from the reopened saved project; generation checks the preserved paint, incoming transform and receipt replay. A captured shot receives the same upgrade while retaining its local keys and sway controller; [watch the 24-frame shot](https://codeboard.nonom.xyz/art/guides/component-upgrade.mp4). `upgrade.json` retains both previews, the plan and origin versions. See [component upgrades](components.md#upgrade-while-preserving-local-corrections) for conflict handling.

## Choose an editing representation

The [ICC import study](../examples/studies/src/studies/drawing/color-import.ts) normalizes fixed sRGB/Display P3 PNGs at 8-bit and 16-bit input depth into editable RGBA8 surfaces. Its light/dark swatches show retained alpha; `color-import.json` records input hashes and decoded bytes. Damaged-profile rejection and saved-project render parity are checked during generation. See [pixel import](pixels.md) for the image and precision limits.

![A textured replayable stroke, a smooth vector stroke, and a low-resolution pixel triangle](https://codeboard.nonom.xyz/art/guides/representations.png)

The first two samples use the same pen path. The brush interprets samples through its tip and texture; the vector stroke creates a smooth contour. The third sample is a 32 × 24 pixel image enlarged eight times. It retains pixels, not a vector outline. See [drawing](drawing.md).

## Stage a four-shot controller exchange

![Two characters notice, offer, receive and hold a yellow card](https://codeboard.nonom.xyz/art/guides/controller-exchange.png)

Editable curve deformers bend both arms while replacement controllers turn them; additive controllers move the characters and card over existing layer keys. The [modular TypeScript source](../examples/studies/src/studies/animation/controller-exchange/author.ts) authors four shot-local animations and assembles a 96-frame cut sequence. [Watch the exchange](https://codeboard.nonom.xyz/art/guides/controller-exchange.mp4). Editable mouth holds include a manual closure at local frames 10–12 in the speaking shots. A shared palette revision changes clothing across all shots while the receiver sleeve keeps its local amber override. Generation checks saved-plan retries, base keys, saved curve controls, rest-pose pixel parity, mouth corrections, palette changes and backward seeks after reopening; `controllers.json` records the evidence. Mouth cues and the card path are explicitly authored, without recorded dialogue, automatic audio alignment or an attachment solver. This case does not qualify a complete production character rig.

## Deform magnified artwork

![A masked striped ribbon at its bind pose, interpolated pose and curved pose](https://codeboard.nonom.xyz/art/guides/deformer-resolution.png)

The parent enlarges the ribbon 2x. The curve renderer samples interpolated controls and rasterizes at the effective placement resolution; the mask bends with the stripes. Generation compares the bind-pose PNG with unbound artwork byte for byte, then checks reopened random/backward seeks. [Watch the 24-frame curve](https://codeboard.nonom.xyz/art/guides/deformer-resolution.mp4). The [source](../examples/studies/src/studies/animation/deformer-resolution/author.ts) keeps artwork and curve authoring separate from artifact generation.

## Preserve alpha across mesh edges

![A translucent square before binding, the identical square through an identity mesh, and its sheared pose](https://codeboard.nonom.xyz/art/guides/mesh-alpha.png)

Two triangles share the square's diagonal. The saved identity mesh must reproduce the unbound PNG exactly; all 48 sampled diagonal alpha values must remain 128. The source then checks backward seeks against fresh sessions. `coverage.json` records the assertions and committed plan. [Watch the 24-frame deformation](https://codeboard.nonom.xyz/art/guides/mesh-alpha.mp4). This demonstrates transparent surface coverage, not complete character-rig qualification. See [shot mesh authoring](animation.md#shot-mesh-authoring-awaiting-runtime-qualification).

## Clip to the layer below

![Silhouette alone, highlights extending outside it, and the same highlights clipped to the silhouette](https://codeboard.nonom.xyz/art/guides/clipping.png)

Only `clipToBelow` changes between the second and third panels. The highlight layer follows the silhouette in the same sibling stack. See [layers and composition](layers.md).

## Feather a pixel selection

![The same triangle filled through a hard selection and a selection feathered by eight source pixels](https://codeboard.nonom.xyz/art/guides/selections.png)

The selection outline and fill color stay the same. Feathering softens selection coverage before the fill; it does not change the vector shape or layer opacity. See [pixel selections](pixels.md).

## Place a reusable component

![Three lamp instances at scales 1, 0.7 and 1.3](https://codeboard.nonom.xyz/art/guides/components.png)

All three lamps originate from one captured group. Each placed instance has its own artwork IDs. Source revisions reach an existing instance only through an explicit refresh. See [components](components.md).

## Separate a drawing change from movement

![Six frames showing a triangle moving right and switching to a diamond at frame 12 while movement continues](https://codeboard.nonom.xyz/art/guides/drawing-timing.png)

The drawing switches at frame 12. Position interpolates independently from frame 0 to 23. Compare frames 11 and 12: the new silhouette appears immediately rather than morphing. See [animation](animation.md).

## Inspect IK reachability

![Two arm targets reached by articulated segments and a third target beyond the arm's maximum reach](https://codeboard.nonom.xyz/art/guides/ik-reach.png)

Crosses mark targets. Segment lengths remain 100 and 80 units. The third target is farther than the combined reach; the API returns `reachable: false`. See [two-bone IK](math.md#solve-a-two-bone-reach).

## Distinguish audio trim and placement

![Source audio from second 1 to 4 mapped to project seconds 2 to 5 at 24 fps](https://codeboard.nonom.xyz/art/guides/audio-placement.png)

This diagram explains the units in [audio](audio.md). The source trim and project position use separate fields. The diagram itself contains no sound.

## Understand ownership

![Hierarchy from project through scene, shot, panel and layer to an individual element, with each level's responsibility](https://codeboard.nonom.xyz/art/guides/hierarchy.png)

Read [project concepts](concepts.md) for creation calls, stable IDs and revision ownership. Groups and layers are represented at one level here for readability; groups can nest.

## Update shared palette colors

![Two shared coat colors change from amber to blue while a dark local override remains unchanged](https://codeboard.nonom.xyz/art/guides/palettes.png)

The study calls `putPalette` and `setColorBinding`, captures a shot with the same bindings, and changes the shared swatch. The right-hand coat keeps its local override. The saved project retains editable bindings. See [shared palette colors](drawing.md#share-palette-colors-across-artwork).

## Keep a manual mouth correction

![Mouth drawings at frames 0, 4, 10, 13, 18 and 23, including a closed-mouth correction at frame 10](https://codeboard.nonom.xyz/art/guides/lip-sync.png)

Supplied frame cues open the mouth at frame 4. A manual correction closes it for frames 10–12, after which the cue resumes. This is drawing substitution from authored cues, not speech recognition. [Watch the silent mouth video](https://codeboard.nonom.xyz/art/guides/lip-sync.mp4) and see [animation](animation.md).

## Reorder cuts without changing shot artwork

![Shot 1 then shot 2 before an editorial edit, and shot 2 then shot 1 afterward](https://codeboard.nonom.xyz/art/guides/editorial-cuts.png)

The study moves the second clip first and trims the first shot's source range. It compares the retained shot data and renders the trimmed source frame against the editorial result. [Watch the revised cut](https://codeboard.nonom.xyz/art/guides/editorial-cuts.mp4). The JSON report also shows exact 24-to-30-fps tick conversion. See [shot-local animation and editorial](animation.md).

## Resume from a verified publish

![Published frame and identical reopened frame after source paths become unavailable, followed by an opacity revision in a separate working copy](https://codeboard.nonom.xyz/art/guides/project-publish.png)

The study publishes a saved container, relocates its original project and tone
file, and verifies the pinned copy. It checks retained embedded bytes,
checkpoints, receipts and rendered parity before revising a separate working
file. A second verification confirms the publish remains unchanged. See
[pinned snapshots](projects.md#publish-a-pinned-native-snapshot).

## Merge worker revisions and retain a local correction

![Six stages showing independent color and layout revisions merged, followed by a local green correction retained during an opacity upgrade](https://codeboard.nonom.xyz/art/guides/shot-merge.png)

Two workers save separate copies of one baseline. The assembler combines color
and layout changes using stable IDs. A later color conflict produces no edit
until the study explicitly keeps the local green fill; the independent opacity
change still applies. The study reopens and retries the saved plan, and checks
that the baseline file remains byte-for-byte unchanged.
[Watch the final shot](https://codeboard.nonom.xyz/art/guides/shot-merge.mp4) and see
[shot revision merging](agent-workflow.md#assemble-independent-shot-revisions).

## Conform an external cut list

The [OTIO conform study source](../examples/studies/src/studies/workflow/otio-conform.ts)
maps 30-fps and 24-fps sources to editable animations using explicit media bindings,
including a source origin at frame 1001. It includes source-mapping and rendered-frame
comparisons after export/import, plus a loss report for names omitted from the native model.
The image and video artifacts are not available in this checkout; this study has not
been executed under the current static-only verification strategy. See [OTIO conform](otio.md).

## Pan across depth planes

![Three frames of a camera pan showing different movement for distant blue, middle amber and near dark planes](https://codeboard.nonom.xyz/art/guides/camera-depth.png)

All drawing coordinates remain fixed. The camera's horizontal offset changes, and layer depth changes the amount of apparent movement. The study also writes a shot coordinate-space report. [Watch the pan](https://codeboard.nonom.xyz/art/guides/camera-depth.mp4) or the separate [drawing substitution and movement video](https://codeboard.nonom.xyz/art/guides/drawing-timing.mp4). See [camera](camera.md).

## Stage script records and revise captions

![Actual script text, its staged panel caption, and a later CSV caption change while the script stays unchanged](https://codeboard.nonom.xyz/art/guides/script-board.png)

These cards display inspected record values. The study stages explicitly named panels, commits a CSV caption edit, and checks that the independent script text and empty artwork remain intact. No illustration is generated from the script. See [storyboard authoring](storyboard.md).

## Commit, retry and restore saved work

![An opaque prop in the saved base, a translucent committed revision, and the restored opaque prop](https://codeboard.nonom.xyz/art/guides/saved-revision.png)

The study changes frame rate with the `preserve-seconds` policy, saves a checkpoint, commits a layer-opacity plan, retries after reopening, rejects a stale writer, and restores the checkpoint. The final image is compared against the initial frame. See [agent workflow](agent-workflow.md).

## Review frames without changing the source

![A clean frame, composition guides over that frame, and an onion skin of three positions](https://codeboard.nonom.xyz/art/guides/review-tools.png)

The source project is saved before exporting a version-bound review manifest. Guide and onion-skin images are separate review outputs. Pixel comparison reports the overlay differences; it does not judge drawing quality. See [review and revision](review.md).

## Check fonts before rendering

![A preview using a missing font's fallback beside a serif title rendered by a checked frame job](https://codeboard.nonom.xyz/art/guides/font-preflight.png)

The font preflight study deliberately requests a missing family and verifies that strict job creation and direct movie export fail without a movie file. It then revises the editable board and shot text to an explicit generic serif, saves the project, and renders a checked job. Stored PNG bytes must match a direct render. `fonts.json` records missing and resolved families. With `--video`, the runner exports a [two-frame checked title movie](https://codeboard.nonom.xyz/art/guides/font-preflight.mp4). Generic serif remains a system mapping; this study does not demonstrate bundled fonts or identical typography across machines. See [font checks in frame jobs](export.md#persistent-png-frame-jobs).

## Resume stored frame rendering

![Two previously completed frames and the final frame rendered after a job resumes](https://codeboard.nonom.xyz/art/guides/frame-jobs.png)

The study cancels after four of twelve frames, reopens the saved job and resumes. It requires four reused and eight newly rendered frames, then compares selected stored PNGs with direct renders. This demonstrates cooperative cancellation and retry, not crash or power-loss qualification. See [persistent frame jobs](export.md#persistent-png-frame-jobs).

The same sheet includes a smaller review profile and a typed compositing graph with source,
grading, mask and blend nodes. Frames 0, 5 and 11 show keyed brightness and blend opacity.
The study commits the graph to a saved shot and compares editorial job frames against the
graph override rendered directly. These selected-frame assertions do not qualify every
effect/blend combination or a high-precision color pipeline.

## Edit imported PSD pixels

![Imported PSD layers with group opacity, beside the saved one-pixel correction](https://codeboard.nonom.xyz/art/guides/psd-import.png)

Independent RLE and ZIP fixtures produce the same editable native layers. The right image
shows a blue pixel correction in the translucent red layer; its soft enlarged edge comes from
rendering the tiny source at a larger scale. The study verifies save/reopen, persisted retry,
metadata loss reporting and rejection of unsupported clipping/effects. This is untagged RGB8
import, not PSD export or Photoshop application qualification. See [PSD pixel import](pixels.md#import-editable-psd-pixels).

## Compare legacy and migrated frames

![Three legacy frames beside their matching migrated frames](https://codeboard.nonom.xyz/art/guides/migration.png)

The input was written by an actual schema-3 implementation and includes embedded audio. `migrateProject` writes a new destination; sampled renders must match byte for byte. Original checkpoints stay in the legacy file. See [migration and storage](projects.md).

## Replace media without reusing stale bytes

![Decoded waveforms of the original 220 Hz tone and reopened 880 Hz replacement](https://codeboard.nonom.xyz/art/guides/asset-replacement.png)

This study commits an audio replacement while its source file is missing and requires `ASSET_MISSING`, an unchanged project and the original embedded bytes. After writing the replacement WAV, the same plan commits and replays after reopening. The image plots the first 20 ms of both real decoded mixes. [Hear the replaced cue](https://codeboard.nonom.xyz/art/guides/asset-replacement.mp4); the one-second movie contains a generated 880 Hz tone. See [asset replacement and Save As](projects.md).

## Inspect real audio and video delivery

![Measured peak amplitude of a decoded two-second mix with an audible cue between 0.5 and 1 second](https://codeboard.nonom.xyz/art/guides/audio-delivery.png)

The waveform is computed from mixed PCM samples. A generated tone is trimmed from source seconds 0.25–0.75 and placed at timeline seconds 0.5–1.0, with fades. The study writes a stereo WAV, verifies an aligned stem package, and exports both board and shot movies. [Watch and hear the shot movie](https://codeboard.nonom.xyz/art/guides/audio-delivery.mp4). Its only sound is the generated tone; it contains no spoken dialogue. See [audio](audio.md) and [delivery](export.md).
