# Schema-3 migration fixture

`legacy.cboard` was written by commit `c666f4df8984ad0af55b555f190126b25b86b046`, not by the current writer with its schema number changed. It contains two animated board panels, a dissolve, a trimmed audio clip with gain/fades, embedded WAV media, and a named checkpoint. That writer predates request receipts, so this fixture makes no receipt-preservation claim.

The expected document, file/media hashes and PNGs were captured using that same legacy implementation. Current migration must preserve the board document and embedded media. Checkpoints intentionally remain in the original file; conversion to studio animation is a separate operation.

To reproduce from the repository root, extract `git archive c666f4d src` into an ignored directory such as `.preview/legacy-writer/source`, then run:

```sh
node --import tsx test/fixtures/schema3/generate.mjs .preview/legacy-writer/source
```

The generator rejects a writer whose schema is not 3. Regeneration changes IDs/timestamps and therefore the expected file hash; do not regenerate simply to make a migration regression pass. The PNG comparisons are exact on the current renderer environment and may require a separately justified review if the canvas dependency changes.
