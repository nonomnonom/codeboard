# Combine shot passes

Connect source images, effects, masks and blends into a shot composition. Use layer effects for a simple grade; use a graph when several image inputs must be combined.

<!-- study:render-passes:start -->
**Separate a prop from its background.** Can one object be processed independently?

[![The isolated prop has no ground. The final image combines the desaturated prop with the original ground.](../../website/public/art/guides/render-passes.png)](../../website/public/art/guides/render-passes.png)

The isolated prop has no ground. The final image combines the desaturated prop with the original ground. Layer selection creates a transparent pass; a saved graph can grade and combine passes.

<!-- study:render-passes:end -->

## Composite shot passes with a typed graph

`ShotRenderOptions.compositing` accepts a `ShotCompositeGraph` for
`createShotRenderSession`, `renderShotFramePNG` and a shot frame job's `target.render`.
It overrides the shot's stored `ShotAnimation.compositing` graph for that render. An explicit
override is pinned in the job manifest; an inherited graph is pinned through the saved source
document hash. The render options themselves do not mutate the project.

```ts
import { renderShotFramePNG, type ShotCompositeGraph } from 'codeboard-studio';

const compositing: ShotCompositeGraph = {
  nodes: [
    { id: 'set', kind: 'source', layerIds: ['layer:set'] },
    { id: 'actor', kind: 'source', layerIds: ['layer:actor'] },
    { id: 'grade', kind: 'effects', input: 'actor', effects: [
      { kind: 'saturation', amount: 0.8 },
      { kind: 'brightness', amount: 1.1 },
    ] },
    { id: 'picture', kind: 'blend', background: 'set', foreground: 'grade',
      mode: 'source-over', opacity: 1 },
  ],
  output: 'picture',
};
const png = await renderShotFramePNG(animation, 12, { compositing });
createFrameJob('film.cboard', 'composite.sqlite', {
  expectedVersion: project.version,
  target: { kind: 'shot', animationId: animation.id, render: { compositing } },
});
```

Replace the example layer IDs with IDs inspected from the animation. Nodes have local unique
IDs and named image inputs; references can appear before their producers in the node array.
Each node executes once per frame, in dependency order. Branches may reuse the same result.
All nodes must contribute to the single output; missing connections/output, duplicate IDs,
cycles and unreachable nodes reject. Referenced source layers must exist. A source selects
one or more layers using the existing [shot pass rules](passes.md#render-selected-shot-layers-as-a-pass): ancestor
placement, masks, sibling clipping dependencies, animation, controllers, meshes and camera still
apply. Group selection includes its subtree. Source images are always transparent outside their
artwork. The requested scene/transparent background is composited behind the final graph output,
so it is not graded or masked by the graph. An explicit graph and `layerIds` are mutually
exclusive. A `layerIds` pass bypasses the stored graph; `compositing: null` explicitly bypasses
it for a full-layer render. Omitting both uses the stored graph, if present. Background options
still select scene or transparent output independently.

The four node types are:

- `source`: explicit `layerIds` from this shot; no external file or arbitrary code input.
- `effects`: `input` plus the same ordered `LayerEffect[]` used by layers, including repeat kinds.
- `blend`: `background`, `foreground`, existing blend `mode`, and foreground `opacity` (0..1).
- `mask`: `input`, `mask`, and `mode: 'in' | 'out'`; multiply input alpha by mask alpha or its inverse.

Mask RGB does not affect coverage. For example,
`{id: 'cut', kind: 'mask', input: 'grade', mask: 'actor', mode: 'in'}` uses the actor pass's
alpha as a matte. Blend/mask use the same native Canvas operations as layer compositing;
effect nodes reuse the layer stack's filter preparation and ordered evaluator. Effect values and
blend opacity support eased shot-local keys, alongside source layer animation. Topology, blend
mode, mask mode and shadow RGB remain static. Arbitrary shader/function nodes are not provided.

Every port carries an RGBA frame at the shot's dimensions, after camera placement. Pixels outside
that finite frame are transparent and each pass is cropped to it. Graph filters do not recover
offscreen artwork or preserve halos beyond intermediate frame edges. Use layer/group effects
before source rendering when you need their expanded spatial sampling, then combine those passes
in the graph. Effect order and masks therefore intentionally differ from moving all effects into
a single layer. The current backend remains 8-bit; no high-precision/color-management claim follows.

Limits are 32 nodes, 32 KiB graph JSON, up to 16 effects per effect node and the usual
32-megapixel frame limit. Graph work also rejects above 256 megapixel-passes per frame, counting
one pass per source/blend/mask, at least one per effect node (or its effect count), and one for
final background composition. This bounds graph-level work; source-layer internals retain their
own geometry/surface limits. Shared inputs are counted once. Job manifest JSON still has its
separate 64 KiB limit. Validation and budget checks occur before graph rendering or new job
creation. Changing the graph requires a new job; resume uses the stored graph and matching source.

The graph operates on shot rendering; it is not a separate editorial-level graph.

## Save a shot's compositing graph

Use an ordinary shot edit or durable `animation.edit` plan:

```ts
const plan = project.plan('Set shot compositing', [{
  op: 'animation.edit', id: animation.id,
  edits: [{ op: 'compositing.set', graph: compositing }],
}]);
await project.commit(plan, { requestId: 'shot-compositing-v1' });
```

`compositing.set` replaces the complete graph; `graph: null` removes it. `putShotAnimation`
and standalone `defineShotAnimation` also accept the field. Source references are validated
against the resulting shot after a batch of edits, so a batch can add layers and connect them,
or remove a layer while revising/removing the graph. A dangling source reference rejects the
entire edit. References are not silently removed or rebound by layer name. Node IDs belong to
their graph and do not become globally addressable project objects or independent lock targets.

Normal shot rendering and editorial clips use the saved shot graph automatically, including
editorial transitions and jobs. There is no separate sequence-level graph applied after cuts.
Shot graph configuration participates in project revision/hash, locks, undo and durable commit
handling through the existing shot operation. A saved graph change requires a new job against
the resulting source revision; an older job cannot resume against changed source content.
Retain the source and matching engine needed by existing jobs.

Shot duplication retains local node IDs/connections and remaps every source layer reference to
the copied layer ID. Shot subset handoff retains graph data alongside the full shot. Three-way
shot merge includes the graph in its existing field/conflict handling and validates final layer
references. Keep the current engine pinned: older engines that lack this strict shot field
cannot read graph-bearing shots. Save/reopen, undo, duplication, merge and editorial pixel
qualification still require runtime evidence; static integration alone does not certify them.

## Animate compositing parameters

Effect nodes accept `keyframes` with `frame`, `easing` and nonempty `effectValues`. Blend nodes
accept `keyframes` with `frame`, `easing` and `opacity`:

```ts
const gradeNode = {
  id: 'grade', kind: 'effects' as const, input: 'actor',
  effects: [{ kind: 'brightness' as const, amount: 1 }],
  keyframes: [
    { frame: 0, easing: 'ease-in-out' as const, effectValues: [{ index: 0, value: 0.6 }] },
    { frame: 23, easing: 'linear' as const, effectValues: [{ index: 0, value: 1.2 }] },
  ],
};
const blendNode = {
  id: 'picture', kind: 'blend' as const, background: 'set', foreground: 'grade',
  mode: 'source-over' as const, opacity: 1,
  keyframes: [
    { frame: 0, easing: 'linear' as const, opacity: 0 },
    { frame: 23, easing: 'linear' as const, opacity: 1 },
  ],
};
```

These records replace the corresponding nodes in a complete graph passed to `compositing.set`
or render options. Keys use source-shot frame positions, including safe signed preroll/postroll
positions. A frame is unique within its node's key list. Each node may hold up to 4096 keys,
but the entire graph including all curves must still fit 32 KiB. Source and mask nodes do not
accept parameter keys. Node/key array order does not control interpolation.

Effect values reuse the layer key contract: `index` selects a stack slot, omitted `channel`
selects amount/degrees, and shadow additionally supports offsetX/offsetY/opacity. Each key
allows up to 64 distinct index/channel pairs; missing slots, unsupported channels, out-of-range
values, unknown fields and duplicate key positions reject. Entry easing overrides its key's
easing for that channel. Blend opacity is 0..1 and uses the key easing. Both paths share the
existing hold/linear/ease-in-out/bounded-Bezier evaluator, holding the nearest endpoint before
and after keys and using static values for unkeyed channels. Hue interpolates numerically.

Sampling uses the requested source frame without accumulating playback state. Editorial
source-in and frame-rate mapping therefore sample graph curves at the same local frame as
layer/camera animation; moving a cut does not shift source keys. Board retiming and project FPS
changes do not retime independently timed shots. Changing a shot's FPS/duration directly does
not automatically rescale any shot keys, including graph keys; use the explicit
`timing.retime` edit described in [shot retiming](../animation/retiming.md). Duplication and shot handoff retain local curve positions, while existing
three-way merge reports changes to graph data. Save the revised graph before creating a new job.
