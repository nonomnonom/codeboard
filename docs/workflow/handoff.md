# Share a pinned project

Publish a verified project copy when another person or render worker needs an exact saved version. Continue editing in a separate working copy.

<!-- study:project-publish:start -->
**Hand off a project with its assets.** Can the drawing survive when the original source paths disappear?

[![The first two images should match. The final image is an independent revision made in a working copy.](../../website/public/art/guides/project-publish.png)](../../website/public/art/guides/project-publish.png)

The first two images should match. The final image is an independent revision made in a working copy. The handoff carries the required project assets. A separate working copy can then change without rewriting the delivery.

<!-- study:project-publish:end -->

## Publish a pinned native snapshot

`publishProject` copies the complete saved container into a new `publish-…`
directory. It retains the current project, named checkpoints, commit receipts,
embedded media and other stored history. It does not select a single asset or
remove unrelated project content. The source must use the current container
format; migrate legacy files before publishing.

```ts
import { StoryboardProject, publishProject, verifyProjectPublish } from 'codeboard-studio';

const sourcePath = 'work/scene.cboard';
const source = await StoryboardProject.open(sourcePath);
const published = await publishProject(sourcePath, 'published', {
  expectedVersion: source.version,
  maxBytes: 256 * 1024 * 1024,
});
// Retain this pin outside the publish directory, for example in the task packet.
const pin = published.manifestHash;
const verified = await verifyProjectPublish(published.directory, {
  expectedManifestHash: pin,
});
console.log(verified.runtimeMatches, verified.manifest.externalFonts);
const working = await StoryboardProject.open(verified.projectFile);
await working.save('work/scene-next.cboard');
```

The output contains `project.cboard` and `manifest.json`. The manifest records
container bytes/SHA-256, project ID/version/content hash, engine implementation
identity, and text font declarations. It is written last, after the copy has been
verified. A source that changes during backup rejects if the resulting snapshot
differs from the requested source. Existing files are never replaced. Ordinary
failures remove owned temporary outputs; a killed process can leave an incomplete
directory without a completion manifest. The default and maximum copy budget is
1 GiB; manifests are limited to 256 KiB. Both operations accept an `AbortSignal`.

For a native copy without a publish manifest, call
`await store.copyTo(newPath, {expectedVersion})` on an open `ProjectStore` and keep
the store open until it completes. This uses the
[Node SQLite backup API](https://github.com/nodejs/node/blob/v22.22.0/doc/api/sqlite.md#sqlitebackupsourceDb-destination-options),
verifies the pinned result, and publishes the new file with an exclusive link.
The destination filesystem must support hard links. A regular SDK save to another
path remains appropriate when only the current editable document is needed.

Native copy also accepts supported legacy containers. It preserves their container format,
checkpoint roots, receipts and embedded media without authoring into the source. The copied
legacy file remains read-only under this engine; `store.inspect().writable` reports whether
the container supports current mutations, while `formatVersion` reports its stored format.
This flag describes format compatibility, not operating-system permissions. Use native copy
to retain a rollback/archive before `migrateProject` creates a current-format working copy.
The returned document hash describes this engine's normalized in-memory document, not the
legacy engine's schema-specific fingerprint or the SQLite file bytes.

`publishProject` can package that verified native legacy copy with a newly generated manifest.
Its new manifest uses this engine's normalized document identity; it does not reinterpret or
replace an older publish manifest. Verification under this engine does not make the archived
container writable or prove legacy render parity. Use `migrateProject` before editing it.

Verification checks native container integrity, file hashes and source identity.
Supplying the separately retained manifest hash also detects replacement of the
manifest itself. Without that pin, verification checks internal consistency,
not the provenance of the supplied package. Published files are not made
filesystem-read-only: edit a separate working copy and retain the old pin.

`runtimeMatches` compares the recorded engine implementation, package version,
Node version and platform to this process. It does not qualify render parity or
pin every native rendering/codec dependency. `externalFonts` lists CSS font
declarations, including those covered by explicit file pins. Optional `fontFiles` declarations
copy checksum-verified fonts into the published directory. Verification checks those bytes
without registering fonts; pass `verified.manifest.fontFiles` to `createFrameJob` to render
with them after handoff. Original authored family names stay unchanged. Source paths use the
same contained, project-relative rules as [frame job fonts](../delivery/frame-jobs.md#persistent-png-frame-jobs).
Missing or altered bundled font files reject verification. The 1 GiB container budget is
separate from the font budget of 64 files, 32 MiB per file and 128 MiB total. License files
remain explicit handoff material; the publisher does not infer or copy them automatically.
Undeclared font availability and glyph fallback remain outside this verification.
