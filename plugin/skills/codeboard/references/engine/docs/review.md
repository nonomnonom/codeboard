# Review and revise

The [runnable character demo](code-board-demo.md) includes a layer-isolated onion skin and an exact-frame before/after revision. Use it to practice the review loop with real artwork.

Make review part of your authoring loop: run a script, render the relevant view, inspect the image, then change only the artwork or timing that needs attention.

## Find the target

For a review that must identify the exact saved source, export a snapshot package:

```ts
import { exportReview } from 'codeboard-studio';
const review = await exportReview('film.cboard', 'reviews', {
  expectedVersion: 12,
  frames: [0, 24, 47],
  // revision: 'director-cut', // expectedVersion must match this saved revision
});
console.log(review.manifestFile);
```

The exporter checks the selected version and decodes one isolated document before asynchronous rendering. Subsequent edits or deletion of the saved revision do not alter that in-memory source. Each call creates its own `review-*` directory. Open the PNGs before making visual claims; `manifest.json` records project/version, document fingerprint, renderer version, frame settings, target/source-frame identity and image SHA-256 hashes. The document fingerprint includes audit data, so it is source identity rather than a visual-equivalence hash.

`manifest.json` is published last by rename. A directory without it is incomplete and must not be treated as delivered evidence. Ordinary failure/cancellation removes the generated directory; a process crash may leave incomplete files. This protocol does not claim power-loss durability. `signal` accepts an `AbortSignal`; cancellation is checked between frame encoding and file operations, not inside synchronous painting.

Limits: 1–120 unique nonnegative integer frames, at most 32 megapixels per selected/incoming panel, 512 megapixels total selected/incoming panel area, and 128 MiB encoded PNG data. The full source document is loaded into memory. These are frame-count/output limits, not a bound on the source document or total compositing memory. Audio/playback and artistic approval require separate review.

```ts
import { StoryboardProject } from 'codeboard-studio';
const project = await StoryboardProject.open('film.cboard');
console.log(project.production.find({ name: 'Hand', limit: 20 }));
```

Results include stable IDs, kinds, and ownership. Narrow a query with `panelId` or `kind`. Read one item with `production.layer(id)` or `production.element(id)`. Avoid reading the entire document when you only need one hand or layer.

## Render a useful view

```ts
import { renderFramePNG, renderDetail, renderContactSheet, renderFrameSheet } from 'codeboard-studio';
import { writeFile } from 'node:fs/promises';

await writeFile('frame.png', await renderFramePNG(project, 24));
await writeFile('hand.png', await renderDetail(project, 'notice', {
  x: 420, y: 220, width: 240, height: 200,
}, 24));
await writeFile('sheet.png', await renderContactSheet(project, {
  panelIds: ['notice', 'reach'], columns: 2,
}));
await writeFile('timing.png', await renderFrameSheet(project, [0, 12, 24, 36]));
```

Replace panel IDs and frames with those in your project. A contact sheet compares panel compositions. A frame sheet compares exact moments, including drawing substitutions and camera motion. A crop lets you inspect line quality and anatomy at full detail.

## Compare layers with onion skin

```ts
import { renderOnionSkin } from 'codeboard-studio';
await writeFile('onion.png', await renderOnionSkin(project, [
  { panelId: 'notice', frame: 12, layerIds: ['hand-track'], tint: '#b95741' },
  { panelId: 'notice', frame: 18, layerIds: ['hand-track'], tint: '#357c9c' },
], { opacity: .4, camera: false }));
```

Each sample can select particular layers and its own tint or opacity. Omit `layerIds` to compare complete panels. Use `camera: false` for source-pose comparison and `camera: true` to include camera placement. Up to eight samples can be combined.

## Apply a reversible change

```ts
const beforeVersion = project.version;
project.transaction('Adjust hand position', () => {
  project.select({ panelId: 'notice', layerId: 'hand-track' })
    .transform({ x: 20, y: -8 });
});
console.log(project.production.changesSince(beforeVersion, { limit: 20 }));
await writeFile('revised.png', await renderFramePNG(project, 18));
```

Inspect `revised.png`. Keep the change with `await project.save('film.cboard')`, or reject it with `project.undo()`. `redo()` reapplies an undone edit. Transaction callbacks are synchronous; render and save after the transaction ends.

For a longer pause before a reveal, use `setPanelDuration(panelId, frames, 'ripple')`. For closer framing, edit a camera key. For a malformed contour, use `layer.edit` to change the geometry. Each request has a more precise operation than regenerating the entire scene.

## Check coordinates

```ts
import { transformPoint } from 'codeboard-studio';
const space = project.production.coordinates('hand-track', { frame: 18, camera: true });
const framePoint = transformPoint(space.localToFrame, { x: 30, y: 20 });
```

The inverse `frameToLocal` maps a point in the rendered frame back into source coordinates. It is `null` when the transform cannot be inverted, for example at zero scale.

Codeboard produces review images and change information. Your agent or reviewer decides whether the pose, composition, or timing is good.

## Attach a review note

```ts
const note = project.production.comment('Keep the rear foot planted here.', {
  panelId: 'performance', layerId: 'clawd', frame: 128, x: 940, y: 800,
}, { author: 'Reviewer' });
// After applying and inspecting the correction:
project.production.resolveComment(note);
```

Comments preserve feedback and an optional artwork/frame anchor. They do not execute changes. Review notes and panel status are stored with the project. `production.inspect()` returns the project overview, including timeline, assets and open comments; it is not paginated. Use `production.find()` and paged key/audio queries for bounded discovery in large projects. See [the production reference](api-production.md) for return shapes.

## Protect a reviewed part

```ts
const lock = project.production.lock('layer', 'clawd', 'Pose review in progress');
project.production.unlock(lock);
```

A lock belongs to the project's current actor and blocks edits by other actors. Its owner can continue editing and is the only actor who can unlock it. Choose an actor with `StoryboardProject.open(path, { actor: 'agent:cleanup' })` when ownership matters across sessions. Locks coordinate edits inside the document; they are not operating-system access control or a network collaboration service.

For detailed ghosting rules, follow [onion skin, layer by layer](onion-skin.md). For framing overlays, see [camera guides](camera.md#framing-guides-and-isolated-artwork).

## Review shot and editorial timelines

Pass `target: { kind: 'shot', animationId }` for local animation frames or `target: { kind: 'editorial', sequenceId }` for assembled editorial frames. Omit `target` for the board timeline. Targets must exist in the selected saved head/checkpoint; unsaved edits are not included.

```ts
const review = await exportReview('film.cboard', 'reviews', {
  expectedVersion: 12,
  target: { kind: 'editorial', sequenceId: 'edit:main' },
  frames: [0, 24, 47],
});
```

Manifest format is now `codeboard-review/2`. Consumers of version 1 must read the explicit `settings.target`, interpret `settings.frameRate` as `{numerator, denominator}`, and use each frame's discriminated `source` record. Board records contain panel IDs and transition progress; shot records contain animation ID and local source frame; editorial records contain sequence ID, outgoing/incoming clip and animation IDs, local source frames, transition type and progress. File names, hashes, dimensions and byte counts remain on the frame entry. The document fingerprint still identifies the complete saved snapshot.

The same frame/pixel/PNG limits, manifest-last publication and cleanup apply to all targets. An editorial overlap counts both source canvases toward the pixel budget and requires matching dimensions. Motion annotations are board-only; `annotations: true` with shot/editorial targets rejects rather than silently omitting annotations. This exports still frames for inspection, not movie/audio delivery or an approval record.

Shot/editorial review uses one prepared render session for all requested frames. Editorial render sessions validate dimensions for every overlap in the selected sequence before creating output, including transitions outside the requested frame list. The full decoded document and copied session artwork remain in memory; pixel output limits are not a total-memory limit.

## Verify a delivered review package

```ts
const verified = await verifyReviewExport(review.directory, { decode: true });
console.log(verified.manifestSha256, verified.verified, verified.decoded);
```

`readReviewManifest(unknown)` validates format 2, target/source identities, unique frame numbers,
canonical filenames and image budgets on a detached value. `verifyReviewExport` reads
`manifest.json` from a package directory, checks every referenced PNG's exact byte count and
SHA-256, and returns the manifest plus the SHA-256 of its exact serialized file bytes. It uses
bounded package-file reads and rejects linked entries and escaping paths. There is no source
project access or modification. Unknown manifest versions/fields reject; unrelated extra files
are ignored. The manifest limit is 2 MiB, enforced by export and verification; existing 120-frame,
128-MiB PNG, 32-megapixel/frame and 512-megapixel aggregate limits also apply.

The default checks metadata and hashes. Explicit `decode: true` additionally decodes each PNG,
requires one 8-bit frame and checks dimensions against its record. `signal` cancels between
reads and image inspections. Returned `verified` and `decoded` counts distinguish these scopes.
Keep the manifest hash with findings so subsequent changes to that file are detectable.

Checksums detect content changes relative to this manifest; they do not authenticate its author,
prove its source mapping against a project, prevent later filesystem changes, or approve the
artwork. Open the frames and record the actual review criteria separately. The review-tools
consumer checks hashes and decoded images and records the manifest hash. Regression tests
exercise image corruption, cancellation and rejected traversal paths; these technical checks
do not replace visual review.

## Save an explicit review decision

`createReviewDecision(directory, input)` verifies the package hashes and returns a detached
`codeboard-review-decision/1` record. Supply an ID, reviewer ID/kind (`human` or `agent`), outcome,
criteria, inspected frame numbers and notes. The caller owns file publication and retention:

```ts
const decision = await createReviewDecision(review.directory, {
  id: 'decision:shot-010-pass-1',
  reviewer: { id: 'agent:reviewer', kind: 'agent' },
  outcome: 'not-reviewed',
  frames: [],
  criteria: ['Visual continuity review is pending.'],
  notes: 'Package verification alone does not approve the artwork.',
});
await writeFile('review-decision.json', JSON.stringify(decision, null, 2), { flag: 'wx' });
```

After actual inspection, the caller may explicitly supply `approved` or `changes-requested`.
These require a nonempty list of distinct frames present in the package; `not-reviewed` requires
an empty list. A decision covers only the listed frames and criteria, not uninspected animation,
sound, other shots or production readiness. Criteria are required and cannot be blank. Inputs
allow at most 32 criteria, 120 frame numbers and 16,384 note characters. Nothing infers artistic
approval or updates panel status, locks or project contents.

The record carries creation time, exact manifest-file SHA-256, source project/version/document
hash, target, and a checksum of its schema-parsed body. `readReviewDecision(unknown)` validates
the record and checksum without opening files. After loading saved JSON,
`verifyReviewDecision(directory, input, { decode: true })` additionally rechecks package files,
manifest/source binding and frame membership; optional decoding has the same scope as package
verification. Changing even manifest whitespace changes its file hash and invalidates that binding.

These are unsigned audit records. IDs and reviewer kind are caller declarations, not authenticated
identity; anyone who can replace records can recompute checksums. Store decisions with the exact
review package and retain history using the studio's ordinary source/archive workflow. The
review-tools consumer prepares a `not-reviewed` record, writes/reloads it and checks the binding.
Regression tests reject changed decisions and different manifest bytes, including changes
that preserve valid frame hashes. Decision verification does not restore damaged evidence.

To decide whether the evidence still applies to a saved project, request a source check:

```ts
await verifyReviewDecision(reviewDirectory, savedDecision, {
  source: { projectPath: 'film.cboard' },
});
// Historical review is explicit; it does not approve the current head.
await verifyReviewDecision(reviewDirectory, savedDecision, {
  source: { projectPath: 'film.cboard', revision: 'review-source' },
});
```

Without `source`, verification checks the saved package only. With it, the reader materializes
one saved head or named revision after package verification, compares project ID, version and
the complete document fingerprint, and confirms the target exists. A mismatch returns
`REVISION_CONFLICT` with expected/actual identities. The successful result includes `source`;
the absence of that field means no project source was checked. Source inspection uses the same
saved-document reader as review export and requires loading that snapshot's full artwork.

Any fingerprint change, including audit/metadata changes, invalidates the match even if sampled
pixels would look the same. This does not rerender frames to prove their provenance. It is an
observation of one saved snapshot, not a lock against subsequent writers; use version/hash-bound
plans for later mutations. Named revisions match their recorded contents, never implicitly the
latest head. The consumer and regression tests check current matches, changed-head rejection and retained
revisions. Source verification does not lock a project against a later concurrent edit.
