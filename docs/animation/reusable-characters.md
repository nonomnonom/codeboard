# Reuse a character in an existing shot

Keep the character's editable drawings, rig and performance inside one top-level group in a master shot animation. `project.instantiateShotCharacter` inserts an independent copy into an existing destination animation. It copies the character rather than the master's set, camera or audio.

Static [drawing components](../drawing/components.md) capture artwork at one drawing. [Whole-shot duplication](rigging.md) copies a complete shot. Character instances fill the gap between those operations: a complete animated character can join a shot that already has its own artwork.

## Insert the master

```ts
const result = project.instantiateShotCharacter('animation:clawd-master-v1', {
  id: 'character:clawd-shot-02',
  rootLayerId: 'group:clawd-master',
  targetAnimationId: 'animation:shot-02',
  frameOffset: 12,
  transform: { x: 320, y: 0 },
});
```

Both animations must already exist in the same project. The source root must be a top-level group containing every drawing and joint needed by the character. Keep library geometry around a deliberate local origin. The new `id` identifies an outer placement group: its transform adds placement around the copied root without replacing that root's pose or travel keys. An optional `parentLayerId` inserts it under an existing destination group. A parent with a drawing sequence rejects because its exposure selection could hide the new instance.

The destination frame rate must equal the source rate. `frameOffset` defaults to zero and must be a nonnegative safe integer. Source local keys, drawing exposures, layer exposure ranges, painted stroke reveals, controller keys/active ranges and deformation keys all move by this offset. Signed source preroll keys are retained. The outer placement group is exposed only over `[frameOffset, frameOffset + source.durationFrames)`, and that interval must fit inside the destination. Retime the master explicitly when a different duration or rate is needed.

The result reports the instance ID, source/target animation IDs, source root and a source-to-copy identity map. Layer, element, key and controller IDs become fresh IDs. Internal masks, two-bone elbows, drawing selections, controller targets and weighted skin joint-layer references point to the new objects. Mesh, curve and envelope geometry remains editable. Texture seeds and replayable raster/pixel data are retained.

## Revise a copy

Use the returned map to address a copied part. Names are labels, not identity matching rules.

```ts
const copiedBody = result.identities.find(entry => entry.sourceId === bodyId);
if (!copiedBody) throw new Error('Body was not inside the character root');
project.editShotAnimation(result.targetAnimationId, [{
  op: 'layer.set',
  layerId: copiedBody.copyId,
  changes: { opacity: 0.8 },
}]);
```

Editing a copied part or controller does not mutate the master or another instance. Reusing an instance a second time gives that copy new identities as well. Source-master updates do not automatically replace characters already used in shots. Keep approved masters as named versions or [saved revisions](../workflow/projects.md); choose upgrades deliberately.

Palette bindings continue to follow the same project swatches, including their local overrides. Embedded props/costumes that were tracked component instances retain their source baselines and remapped origins. Their existing [component upgrade](../drawing/component-upgrades.md) workflow still previews conflicts and preserves disjoint local corrections. This supports updates to those tracked assets; it is not a merge system for a complete character's rig topology.

## Preserve the destination composition

The destination canvas, camera, audio, existing layers, controllers and editorial links remain unchanged. Copied controllers append in their source stack order and target the copied subtree. If the destination has a [composite graph](../delivery/compositing.md), provide `compositeSourceId` for the source node that should render the new instance; insertion appends the placement group's ID to that node. Omitting it rejects instead of creating an invisible character. Source-shot composite graphs are not imported; author that routing in the destination.

Masks outside the root, a root clipped to a preceding sibling, controllers spanning character and set, and skin joints outside the root reject. A source joint driving a mesh outside the root also rejects. Put dependent character artwork inside the root or separate the scene controller before reuse. Final shot validation also enforces depth-plane, deformation-boundary and identity constraints.

## Save a retryable insertion

The `character.instantiate` plan command has the same options plus `sourceAnimationId`. It uses existing transactions, global ID validation, layer locks, undo, optimistic save versions and durable receipts. A reviewed master can be read and copied while its source layers are locked; locked destination ancestors still reject writes.

```ts
const plan = project.plan('Insert approved Clawd', [{
  op: 'character.instantiate',
  sourceAnimationId: 'animation:clawd-master-v1',
  rootLayerId: 'group:clawd-master',
  targetAnimationId: 'animation:shot-02',
  id: 'character:clawd-shot-02',
  frameOffset: 12,
}]);
await project.commit(plan, { requestId: 'clawd:shot-02:insert-v1' });
```

Save the original plan for retries. Rebuilding a plan after another edit is a different request payload.

The CLI can create that plan from a saved project without changing its artwork:

```sh
codeboard character-plan film.cboard animation:clawd-master-v1 group:clawd-master animation:shot-02 --id character:clawd-shot-02 --frame-offset 12 --expected-version 42 > insert.json
codeboard commit film.cboard insert.json --request-id clawd:shot-02:insert-v1
```

Use UTF-8 JSON when saving stdout on Windows. `--parent`, `--composite-source` and `--actor` select the corresponding ownership/composition options. For transforms, use the API or the generic `codeboard plan` command. Replaying `codeboard commit` with the same saved plan and request ID returns the original receipt without inserting a second character.

## Deliver and review

Save and reopen the `.cboard`, render representative local frames and check contacts and substitutions. An [isolated native shot handoff](rigging.md) retains the resulting character and its required project resources. External fonts still require a compatible installation. Importing a master from another project requires explicit resource and identity reconciliation; this feature does not automatically import palettes, media or component libraries across projects.

The engine does not generate a character design, model sheet or convincing acting. Those remain authored work. Use this feature for editable reuse after the character has been built and reviewed.
