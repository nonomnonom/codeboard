# Schema-4 studio migration fixture

`legacy.cboard` was authored with the actual schema-4/container-2 engine archive retained for the 24-shot workload, before layer effects introduced schema 5. The writer archive SHA-256 is `42df13e06288998b577b2b7a8ba5055bce3efc298a3e07531db2e3826eca04f8`; its renderer implementation SHA-256 is `0becabe3e57c9d73f73b9e695e6a09f7a7a55143182758146605b8d5eac24706`.

The fixture contains two animated board panels captured as local animations, trimmed editorial clips, embedded WAV media, sample-addressed studio audio with gain/fades, a persisted edit receipt, and a named checkpoint. `expected.json` and the eleven PNGs come from that writer, not the current writer with its schema number changed. No fonts, external artwork or recorded audio are required.

Migration preserves the current document, local source ranges, sample positions and embedded audio. Checkpoints and old receipts deliberately remain in the unchanged source container. The test also rejects stale expected versions before creating a destination, verifies source write protection, compares old-renderer PNGs, checks container integrity and commits a new edit to the migrated project.

To reproduce, obtain the exact archive above, verify its SHA-256, extract it to an ignored directory and pass the extracted `package/` directory:

```sh
node --import tsx test/fixtures/schema4/generate.ts .preview/schema4-writer/package
```

The generator requires schema 4 and checks container format 2. The historical writer archive is retained locally with the workload, not downloaded by the test or committed with this fixture. Run the generator only with that verified writer; generation changes IDs/timestamps and file hashes. Do not regenerate expected images merely to accept a rendering regression. Exact PNG comparisons are qualified for the renderer environment used by these fixtures; dependency changes require a separate parity review.
