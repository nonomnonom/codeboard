# Share and verify a review package

Export selected frames from a saved version so feedback refers to the same artwork. Package verification checks files; reviewers still inspect the images.

<!-- study:review-tools:start -->
**See motion without changing the drawing.** What can review overlays reveal?

[![Compare the clean frame with composition guides and then the ghosted positions. The ghosts show where the prop was and where it is going.](../../website/public/art/guides/review-tools.png)](../../website/public/art/guides/review-tools.png)

Compare the clean frame with composition guides and then the ghosted positions. The ghosts show where the prop was and where it is going. Review overlays add information to an exported view while leaving the source artwork alone.

<!-- study:review-tools:end -->

## Export a saved version

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
artwork. Open the frames and record the actual review criteria separately.
