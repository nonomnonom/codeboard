# Update reusable artwork without losing corrections

Track an instance against its source, inspect an upgrade, and resolve overlapping changes before applying it. Start with [component creation](components.md).

<!-- study:component-upgrade:start -->
**Update the shape, keep your paint.** What happens to a local color change when the source drawing changes?

[![Compare the original, the locally repainted version and the updated shape. The local paint survives the geometry update.](../../website/public/art/guides/component-upgrade.png)](../../website/public/art/guides/component-upgrade.png)

Compare the original, the locally repainted version and the updated shape. The local paint survives the geometry update. Updating a component can bring in source changes while preserving independent corrections in a copy.

<!-- study:component-upgrade:end -->

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
not an authenticity signature. The retained baseline records source data; it does not turn
`refreshComponentInstance` into an override-preserving merge. Refresh still replaces descendants.

Origin registration replaces the affected studio branch so panel-scoped operations cannot mutate
the retained undo snapshot. 

Origin propagation preserves the source baseline and remaps destination IDs, then computes a
new checksum for the copied instance. If an original baseline object was removed locally, its
copy receives a reserved identity with no live object; deletion remains a local difference.
Copies never point those absent objects back to the original instance. Nested tracked instances
are propagated when their roots are included. A record whose source component/version disagrees
with the copied instance rejects as `COMPONENT_ORIGIN_STALE`. Static component capture still
clears instance provenance instead of creating nested instance history in the library.

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
validated open project; page bounds limit returned records, not traversal work.

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
a new preview. 

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
state.

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
of deformation weights is performed.
