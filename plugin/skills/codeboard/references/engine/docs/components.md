# Reusable artwork and components

![Three copies of a lamp at scales 1, 0.7 and 1.3](https://codeboard.nonom.xyz/art/guides/components.png)

One captured group produces three independently editable instances. [Run the visual studies](visual-examples.md).

A component captures static artwork for repeated placement. Use it for props, background details, or a single character drawing. Use a drawing sequence for a performance with changing poses.

## Capture and place

Start with a project and panel as in [project concepts](concepts.md), then create a source layer. With `pathCommands` imported from `codeboard-studio`:

```ts
const sourceLayer = panel.addVectorLayer('Lamp');
sourceLayer.path(pathCommands('M 0 0 L 16 0 L 16 120 L 0 120 Z'), {
  fill: '#272721',
});
const destinationPanel = panel;
```

The next snippet places a copy in the same panel. Use another panel handle for cross-panel reuse. The source stays visible unless you deliberately hide or remove it.

```ts
const componentId = project.production.captureComponent(sourceLayer.id, 'Street lamp');
const instanceId = project.production.instantiateComponent(
  componentId, destinationPanel.id, { x: 420, y: 80, scaleX: .8, scaleY: .8 },
);
```

The capture includes the layer's descendants. A capture must include its mask dependencies. A whole drawing-sequence group cannot be captured as a static component; capture an individual drawing instead.

An instance is editable artwork with its own IDs. Moving or correcting it does not change other instances. The source component and placed instances have distinct revision behavior.

## Change the source deliberately

`correctedSourceLayer` below is a layer handle containing replacement artwork you authored. You can also edit the original `sourceLayer` and pass its ID as the replacement source.

```ts
project.production.reviseComponent(componentId, correctedSourceLayer.id);
project.production.refreshComponentInstance(instanceId);
```

Revising the component does not silently replace existing instances. Refresh is the explicit replacement step and can discard that instance's local changes. Save a named revision first when those changes matter. If attached review comments prevent replacement, preserve their anchors or explicitly choose the supported `comments: 'anchor-to-instance'` refresh option.

## Reuse a drawing without copying

Within one drawing track, refer to the same child drawing ID at multiple exposure keys. The [demo walk cycle](code-board-demo.md) does this for repeated steps. To create an independently editable variation, use `duplicateDrawing(groupId, drawingId, name)`, then assign the new drawing to the intended range with `setDrawingRange`.

Components preserve the representation of their contents. Vector contours remain contour-editable; raster surfaces remain pixels; replay strokes retain their brush commands. A placed bitmap does not become a poseable character.


## Retained instance origins

New component instantiations and explicit refreshes retain a `ComponentOrigin` in
`project.studio.componentOrigins`. Each record contains the instance ID, source component ID
and version, a detached source-layer baseline, complete source/copy identity mappings, and a
checksum covering that payload. Source revision does not overwrite existing instance origins;
refresh deliberately replaces that instance's origin alongside its replacement artwork.

The strict studio envelope carries these records through normal project storage and revision
snapshots. Readers without this field reject the envelope instead of stripping upgrade metadata.
Projects without origins remain accepted; historical correspondence is not inferred from names
or layer positions. Panel duplication, drawing duplication and panel-to-shot capture propagate tracked instance
origins through the clone identity map. Legacy instances without origins stay untracked.

Origins describe creation/refresh history. They may outlive deleted or detached instances;
the source snapshot and mapping remain useful historical evidence. This is not a registry of
currently live references. An upgrade must check the live instance's component/version before
using an origin. The collection is capped at 4096 records; there is no automatic pruning policy.
A foreign layer lock also protects origin records owned by that instance's subtree.

Checksum and complete one-to-one mapping validation reject corrupted records. A checksum is
not an authenticity signature. This increment retains baseline data; it does not turn
`refreshComponentInstance` into an override-preserving merge. Refresh still replaces descendants.
Focused regressions cover raster baseline equality through save/reopen, registration rollback,
instantiate/refresh undo and redo, detached paged reads and checksum rejection after pixel tampering.
Origin registration replaces the affected studio branch so panel-scoped operations cannot mutate
the retained undo snapshot. Lock behavior and full upgrade qualification remain separate gates.


Origin propagation preserves the source baseline and remaps destination IDs, then computes a
new checksum for the copied instance. If an original baseline object was removed locally, its
copy receives a reserved identity with no live object; deletion remains a local difference.
Copies never point those absent objects back to the original instance. Nested tracked instances
are propagated when their roots are included. A record whose source component/version disagrees
with the copied instance rejects as `COMPONENT_ORIGIN_STALE`. Static component capture still
clears instance provenance instead of creating nested instance history in the library.

Panel duplication and shot capture have a regression showing that locally deleted baseline
objects remain absent and receive distinct reserved IDs in each copy. Drawing duplication,
nested-instance combinations and future merge behavior require further qualification.


## Inspect origin mappings without loading baseline artwork

`project.componentOriginData(instanceId, { offset, limit })` returns detached identity pages
and metadata without copying baseline layers or raster bytes into the response. The default
limit is 50, capped at 200; the usual 256 KiB response limit applies. Each page includes the
observed project version, baseline version/checksum, current library version (or null), declared
instance source and nextOffset. Use the same observed version while collecting pages.

`instanceState` distinguishes matching provenance, stale component/version metadata, a detached
live layer, and a missing instance. Each mapping's `location` is `instance`, `elsewhere` in live
board/shot artwork, or `missing`. Missing mappings can represent local deletion; moved objects
are reported separately. Neither location nor a matching version proves that geometry is
unchanged or that an upgrade is conflict-free. Historical source objects in the component
library are not counted as live instance destinations.

An untracked instance rejects with `COMPONENT_ORIGIN_MISSING`. This method inspects an already
validated open project; page bounds limit returned records, not traversal work. The components
study records mapping pages after reopening its saved project.


## Revise source artwork while retaining identity

`production.replaceComponentElement(componentId, layerId, element, options)` replaces one
existing source element using its existing ID. Options require `expectedComponentVersion`
and may include the usual project `expectedVersion`. The source version increments once;
other elements, layer IDs, instances and their recorded baselines remain unchanged. For saved
plans use `component.element.replace`, encoding the element with `planDrawingElement`.

A stale source version rejects with `REVISION_CONFLICT`; an unknown layer/element or timed
raster-stroke reveal rejects. This is static source editing, not insertion or implicit identity
matching. Final project validation enforces geometry, references, palettes and global IDs.
Foreign locks on component source layers or their ancestors protect their artwork too.

A plan with multiple source replacements must name successive expected component versions;
all commands remain in the same atomic project transaction. Preserve the exact plan/request
pair for retries. Existing instantiated artwork changes only through an explicit refresh or a
resolved upgrade. The older `reviseComponent` operation still captures replacement
artwork with new identities; do not assume it establishes old/new object correspondence.

The components study prepares a saved source-element correction after instantiation, then
reports the newer library version beside retained instance baselines.

## Upgrade while preserving local corrections

For a tracked board or shot instance, `project.previewComponentUpgrade(instanceId)` compares its
retained baseline, current descendants and current library source. The result contains an
`inputHash`, changed paths, retained local paths and conflicts. Preview does not edit the project.
Apply through `production.upgradeComponentInstance(instanceId, { expectedInputHash })`, or a
saved `component.upgrade` command with `id` and `expectedInputHash`. Preserve the plan and
request ID for durable retries.

Disjoint field changes combine. Concurrent edits to the same field, or incompatible changes
to collection structure/order, require explicit `resolutions` keyed by the reported JSON Pointer
path, choosing `local` or `incoming`. Changed inputs invalidate the preview hash. Unknown
resolution paths reject. New library IDs need explicit `newIdentities` mappings; names and
positions do not establish correspondence. Refresh retains its separate replacement behavior.

New destination IDs must be unused across the document and retained component-origin mappings,
including deleted instances. Preview rejects collisions with `COMPONENT_UPGRADE_IDENTITY_COLLISION`
and reports the source/copy IDs. The preview hash pins the supplied mappings; changing one requires
a new preview. A regression covers successful insertion with an explicit ID, unchanged existing
artwork and rejection of live/library/project IDs or IDs reserved by a deleted instance.

The [upgrade study](../examples/studies/src/studies/assets/component-upgrade/render.ts) preserves
local blue paint while applying a library transform, saves/reopens and retries the upgrade.
Three board regression cases cover independent rendered-reference parity, stable IDs/review anchors,
receipt replay, same-field conflicts, stale previews, foreign descendant locks and local deletion
conflicts. A captured-shot regression additionally verifies preserved local keys/controllers,
unchanged board artwork, foreign descendant locks, saved replay and random/backward frame
parity with an independently revised reference. Arbitrary structural and nested-instance
changes are outside this regression's scope.

`conflictsResolved` reports merge decisions, not final project validity. Application still checks
global IDs, external references, comments and locks. The preview response is capped at 256 KiB.
Use its project `version` as `expectedVersion` when applying directly. The outer instance group
is outside the descendants merge, so its placement remains local. Failed application rolls back
artwork and origin together through the existing project transaction.

Supply `newIdentities: [{ sourceId, copyId }]` for every new source layer, key and element.
Reuse the same mappings in preview and apply. The input hash covers origin, local descendants,
source and these mappings; resolutions are explicit apply-time choices. Preview again with
`resolutions` before applying them. The empty JSON Pointer path selects the entire descendants
array. Collections merge recursively only when object IDs and order match; divergent structure
requires a whole-array choice when both sides changed. Numeric arrays and raster buffers are
atomic. Full source recapture creates new IDs and does not infer topology correspondence.

The preview includes `owner: { kind: "panel" | "animation", id }`; the hash also pins this
location so moving an instance to a different owner invalidates an earlier preview. Captured shot
instances use the same API and `component.upgrade` plan command. Source corrections merge into
their descendants while shot-local keyframes remain local differences. Camera, audio, deformation
bindings and controller stacks are not rewritten. Final shot validation rejects an upgrade that
would leave missing controller/deformer targets or invalid mask/rig relationships.

Upgrade uses the document transaction scope so both shot artwork and retained origins detach
from undo snapshots before writes. This copies more than a panel-only edit; it keeps ownership
and rollback in the existing transaction machinery. Direct callers should pass `expectedVersion`
to guard changes elsewhere in the shot: the merge input hash does not pin camera or controller
state. The components study prepares a board-and-shot upgrade with a shot opacity key and local
controller, save/reopen reports and shot PNG output.

## Replace source hierarchy with explicit identities

`production.replaceComponentSource(componentId, layers, { expectedComponentVersion,
expectedVersion? })` replaces a library tree while retaining the IDs supplied by the caller.
Read the current source, keep IDs for retained objects, assign fresh IDs to additions, and remove
or reorder entries deliberately. The source version advances once. Existing instances and their
baselines stay at their current version until explicitly upgraded or refreshed.

For saved plans, use `component.source.replace` with `componentId`, `expectedComponentVersion`
and `layers: planComponentSource(layers)`. The helper validates static source artwork and encodes
raster bytes using the same layer/element codec as shot plans. Normal plan size limits apply.

The tree must be nonempty with unique layer/element IDs and valid internal mask/rig references.
Source keyframes, exposures, drawing sequences, timed raster reveals and nested component
provenance reject: this API edits static library artwork. It does not silently strip animation.
Global ID collisions, palette references and protected artwork remain subject to final project
validation and locks. Invalid replacement rolls back; a stale source version rejects before editing.

After adding objects, provide their explicit source-to-instance `newIdentities` to upgrade preview
and application. Independent local changes can merge; conflicting edits to collection membership
or order require the existing whole-array resolution. No automatic topology matching or migration
of deformation weights is performed. The components study prepares a source-element correction
plus an added detail, then upgrades board/shot instances with separate new IDs while retaining
local opacity, a shot key and controller. That expanded consumer has static checks only.
