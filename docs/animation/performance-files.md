# Save a reusable controller performance

Save selected controls as a JSON performance file and apply them to another compatible shot. Artwork and rig geometry stay in the project.

<!-- study:weighted-pose:start -->
**Move partway toward a pose.** What does half of a position change look like?

[![The marker starts at x = 60 and moves halfway toward x = 300, reaching x = 180. The final pose adds another 90.](../../website/public/art/guides/weighted-pose.png)](../../website/public/art/guides/weighted-pose.png)

The marker starts at x = 60 and moves halfway toward x = 300, reaching x = 180. The final pose adds another 90. A replacement weight blends toward a target. An additive pose applies an extra change to the current pose.

<!-- study:weighted-pose:end -->

## Share a controller performance package

`createControllerPerformance(animation, { id, name, controllerIds })` captures selected
controllers in source stack order into a detached JSON-compatible `ControllerPerformance`.
Its format is `codeboard-controller-performance`, version 1, with source frame rate, complete
controller definitions and a SHA-256 checksum. Duplicate or missing selections reject.

```ts
const performance = createControllerPerformance(source, {
  id: 'performance:lean-v1', name: 'Lean', controllerIds: ['controller:lean'],
});
// Store JSON.stringify(performance) using the authoring project's file workflow.
const imported = readControllerPerformance(JSON.parse(savedJson));
const edits = compileControllerPerformance(imported, target, {
  controllers: [{ sourceId: 'controller:lean', targetId: 'controller:shot2-lean' }],
  layers: [{ sourceId: sourceTorsoId, targetId: targetTorsoId }],
  frameOffset: 24,
});
```

The reader accepts unknown input and validates the strict versioned schema, controller
invariants and checksum. The checksum covers JSON of the schema-parsed payload excluding
`sha256`; outer file whitespace and input object property ordering are not part of identity.
It detects changed logical contents, not producer authenticity. Objects are detached but remain
ordinary editable JavaScript objects; changed payloads fail checksum verification on import.
Use a newly captured package for a new revision. File publication/overwrite policy remains with
the authoring project; this API does not claim filesystem immutability or signatures.

Compilation uses the same transfer owner as direct shot transfer: explicit new controller IDs,
complete one-to-one target mappings, equal frame rates, optional source activity range and safe
integer offsets. It returns ordinary edits for a version-pinned plan. Mapping order specifies
insertion order; preserve package order when its controllers interact. Cross-project global
identity checks and locks remain enforced by the destination project transaction.

This package carries numeric controller performance only. Required layer IDs appear in its
target records and must map to an existing compatible rig. It does not bundle artwork, fonts,
media, base layer keys, drawing substitutions, rig geometry or full dependency manifests.
