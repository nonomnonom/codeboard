# Record a review decision

Record what you inspected, which criteria you used and whether changes are needed. Keep the decision with the exact review package.

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
review package and retain history using the studio's ordinary source/archive workflow. Decision verification does not restore damaged evidence.

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
latest head.  Source verification does not lock a project against a later concurrent edit.
