# Timeline and production API

Access these methods through `project.production`. Board mutations use global integer frames. Some inspection methods also accept shot-animation IDs and return local-frame data; see [timeline queries](../timeline-queries.md) and [drawing queries](../drawing-queries.md). Read values are inspection copies. For mutations use [board animation](../../animation/timing.md), [shot-local edits](../../animation/shot-layers.md), [camera](../../animation/camera.md), [board audio](../../audio/board-audio.md), and [components](../../drawing/components.md).

Use the signatures below to check arguments and return types. A value after `=` is the default; `?` marks an optional input. Named data shapes are listed in [API types](types.md).

## ProductionTools

### captureComponent

```ts
captureComponent(layerId: Id, name: string, options: MutationOptions & {
    id?: Id;
} = {}): Id;
```

### reviseComponent

```ts
reviseComponent(id: Id, sourceLayerId: Id, options: MutationOptions = {}): void;
```

### replaceComponentSource

```ts
replaceComponentSource(componentId: Id, layers: readonly Layer[], options: MutationOptions & {
    expectedComponentVersion: number;
}): void;
```

### replaceComponentElement

```ts
replaceComponentElement(componentId: Id, layerId: Id, element: DrawingElement, options: MutationOptions & {
    expectedComponentVersion: number;
}): void;
```

### instantiateComponent

```ts
instantiateComponent(componentId: Id, panelId: Id, transform: Partial<Transform> = {}, options: MutationOptions & {
    id?: Id;
} = {}): Id;
```

### upgradeComponentInstance

```ts
upgradeComponentInstance(instanceId: Id, options: ComponentUpgradeOptions & MutationOptions & {
    expectedInputHash: string;
}): void;
```

### refreshComponentInstance

```ts
refreshComponentInstance(layerId: Id, options: MutationOptions & {
    comments?: "reject" | "anchor-to-instance";
} = {}): void;
```

### moveLayer

```ts
moveLayer(layerId: Id, beforeLayerId?: Id, options: MutationOptions = {}): void;
```

### reparentLayer

```ts
reparentLayer(layerId: Id, parentId: Id | null, options: MutationOptions & {
    beforeLayerId?: Id;
} = {}): void;
```

### removeLayer

```ts
removeLayer(layerId: Id, options: MutationOptions = {}): void;
```

### find

```ts
find(query: ObjectQuery = {}): ObjectSummary[];
```

### query

```ts
query(query: ObjectPageQuery = {}): ObjectPage;
```

### summary

```ts
summary(): {
    studio: { animations: number; editorialSequences: number; editorialClips: number; audioTracks: number; audioClips: number; };
    schemaVersion: 5;
    version: number;
    canvas: { width: number; height: number; background: string; };
    frameRate: number;
    durationFrames: number;
    counts: { sequences: number; scenes: number; shots: number; panels: number; components: number; assets: number; audioTracks: number; comments: number; locks: number; };
    titleTruncated?: boolean | undefined;
    id: string;
    title: string;
};
```

### coordinates

```ts
coordinates(targetId: Id, options: CoordinateOptions = {}): CoordinateSpace;
```

### layer

```ts
layer(id: Id): Layer;
```

### layerKeyframes

```ts
layerKeyframes(id: Id, options: PageOptions = {}): LayerKeyframe[];
```

### cameraKeyframes

```ts
cameraKeyframes(shotId: Id, options: PageOptions = {}): CameraKeyframe[];
```

### element

```ts
element(id: Id): DrawingElement;
```

### drawingSequence

```ts
drawingSequence(groupId: Id): {
    keys: DrawingExposure[] | null;
    drawings: { id: Id; name: string; kind: Layer["kind"]; }[];
};
```

### drawingExposures

```ts
drawingExposures(groupId: Id, options: PageOptions = {}): DrawingExposure[] | null;
```

### drawingAlternatives

```ts
drawingAlternatives(groupId: Id, options: PageOptions = {}): { id: Id; name: string; kind: Layer["kind"]; }[];
```

### setPlaneDepth

```ts
setPlaneDepth(layerId: Id, depth: number, options: MutationOptions = {}): void;
```

### drawingNeighbors

```ts
drawingNeighbors(groupId: Id, frame: number, options: {
    skipBlank?: boolean;
} = {}): DrawingNeighbors;
```

### twoBoneRig

```ts
twoBoneRig(rootId: Id): TwoBoneRig | null;
```

### setTwoBoneRig

```ts
setTwoBoneRig(rootId: Id, definition: TwoBoneRig | null, options: MutationOptions = {}): void;
```

### poseTwoBoneRig

```ts
poseTwoBoneRig(rootId: Id, frame: number, target: {
    x: number;
    y: number;
}, options: MutationOptions & {
    bend?: 1 | -1;
    easing?: Easing;
    unreachable?: "reject" | "clamp";
} = {}): TwoBoneSolution;
```

### setDrawingSequence

```ts
setDrawingSequence(groupId: Id, keys: readonly DrawingExposure[] | null, options: MutationOptions = {}): void;
```

### duplicateDrawing

```ts
duplicateDrawing(groupId: Id, drawingId: Id, name: string, options: MutationOptions = {}): Id;
```

### setDrawingRange

```ts
setDrawingRange(groupId: Id, startFrame: number, endFrame: number, drawingId: Id | null, options: MutationOptions = {}): void;
```

### setExposure

```ts
setExposure(layerId: Id, exposure: Layer["exposure"], options: MutationOptions = {}): void;
```

### inspect

```ts
inspect(): {
    readonly schemaVersion: 5;
    readonly version: number;
    readonly frameRate: number;
    readonly durationFrames: number;
    readonly scenes: { shots: (Shot | undefined)[]; sequenceId: Id; id: Id; name: string; shotIds: Id[]; }[];
    readonly sequences: Sequence[];
    readonly assets: Asset[];
    readonly audioTracks: AudioTrack[];
    readonly locks: ProjectLock[];
    readonly openComments: ReviewComment[];
    readonly capabilities: { readonly vectorFill: "solid-linear-radial-local-coordinates"; readonly rasterPainting: "working"; readonly vectorStrokeEditing: "working"; readonly vectorBooleans: "closed-contours-skia"; readonly vectorStrokeOutlining: "explicit-editable-contour-conversion"; readonly pixelRegionEditing: "rgba8-source-rectangles"; readonly pixelSelections: "polygon-color-flood-combination-gaussian-feather"; readonly pixelFill: "source-over-copy-destination-out-source-atop"; readonly timeline: "working"; readonly camera2d: "independent-property-keys-and-easing"; readonly layerAnimation: "independent-property-keys-and-easing"; readonly animationEasing: "linear-smoothstep-hold-bounded-cubic-bezier"; readonly layerPivots: "permanent-local-joints"; readonly twoBoneIK: "stored-cutout-rig-baked-rotation-keys"; readonly drawingSequences: "reusable-drawings-holds-blanks"; readonly audioPlacement: "working"; readonly multiplane: "independent-root-depth-keys-2d-parallax"; readonly audioMixdown: "ffmpeg"; readonly audioInspection: "paged-tracks-clips-and-frame-filter"; readonly animaticFrameExport: "working"; readonly movieExport: "ffmpeg"; readonly referenceAssets: "partial"; readonly onionSkin: "layer-selection-tint-frame-samples"; readonly coordinateInspection: "animated-local-frame-matrices"; readonly renderComparison: "premultiplied-pixel-deltas"; readonly compositionGuides: "frame-space-review-overlay"; readonly reviewLocks: "working"; };
};
```

### audioTracks

```ts
audioTracks(options: PageOptions = {}): AudioTrackSummary[];
```

### audioClips

```ts
audioClips(trackId: Id, options: AudioClipQuery = {}): AudioClip[];
```

### audioClip

```ts
audioClip(id: Id): AudioClip & {
    trackId: Id;
};
```

### changesSince

```ts
changesSince(version: number, options: PageOptions = {}): ChangeEntry[];
```

### brush

```ts
brush(id: Id): BrushPreset;
```

### createBrush

```ts
createBrush(definition: Omit<BrushPreset, "id" | "version"> & {
    id?: Id;
}, options: MutationOptions = {}): Id;
```

### reviseBrush

```ts
reviseBrush(id: Id, changes: Partial<Omit<BrushPreset, "id" | "version">>, options: MutationOptions = {}): number;
```

### duplicateBrush

```ts
duplicateBrush(id: Id, name: string, options: MutationOptions = {}): Id;
```

### setPanelDuration

```ts
setPanelDuration(panelId: Id, durationFrames: number, mode: "ripple" | "preserve" = "ripple", options: MutationOptions = {}): void;
```

### setTransition

```ts
setTransition(panelId: Id, transition: Transition, options: MutationOptions = {}): void;
```

### movePanel

```ts
movePanel(panelId: Id, beforePanelId?: Id, options: MutationOptions = {}): void;
```

### duplicatePanel

```ts
duplicatePanel(panelId: Id, options: MutationOptions = {}): Id;
```

### deletePanel

```ts
deletePanel(panelId: Id, options: MutationOptions = {}): void;
```

### setPanelStatus

```ts
setPanelStatus(panelId: Id, status: Panel["status"], options: MutationOptions = {}): void;
```

### setPanelNumber

```ts
setPanelNumber(panelId: Id, number: string, options: MutationOptions = {}): void;
```

### addCameraKeyframe

```ts
addCameraKeyframe(shotId: Id, frame: number, value: CameraKeyframeInput, options: MutationOptions = {}): Id;
```

### updateCameraKeyframe

```ts
updateCameraKeyframe(shotId: Id, keyframeId: Id, changes: CameraKeyframeChanges, options: MutationOptions = {}): void;
```

### removeCameraKeyframe

```ts
removeCameraKeyframe(shotId: Id, keyframeId: Id, options: MutationOptions = {}): void;
```

### removeCameraKeyframeChannels

```ts
removeCameraKeyframeChannels(shotId: Id, keyframeId: Id, channels: readonly CameraChannel[], options: MutationOptions = {}): void;
```

### addLayerKeyframe

```ts
addLayerKeyframe(layerId: Id, frame: number, value: LayerKeyframeInput, options: MutationOptions = {}): Id;
```

### updateLayerKeyframe

```ts
updateLayerKeyframe(layerId: Id, keyframeId: Id, changes: LayerKeyframeChanges, options: MutationOptions = {}): void;
```

### removeLayerKeyframe

```ts
removeLayerKeyframe(layerId: Id, keyframeId: Id, options: MutationOptions = {}): void;
```

### removeLayerKeyframeChannels

```ts
removeLayerKeyframeChannels(layerId: Id, keyframeId: Id, channels: readonly LayerChannel[], options: MutationOptions = {}): void;
```

### addAsset

```ts
addAsset(asset: Omit<Asset, "id"> & {
    id?: Id;
}, options: MutationOptions = {}): Id;
```

### updateAsset

```ts
updateAsset(id: Id, changes: Partial<Omit<Asset, "id">>, options: MutationOptions = {}): void;
```

### addAudioTrack

```ts
addAudioTrack(name: string, options: MutationOptions & {
    id?: Id;
} = {}): Id;
```

### updateAudioTrack

```ts
updateAudioTrack(trackId: Id, changes: AudioTrackChanges, options: MutationOptions = {}): void;
```

### removeAudioTrack

```ts
removeAudioTrack(trackId: Id, options: MutationOptions = {}): void;
```

### addAudioClip

```ts
addAudioClip(trackId: Id, clip: AudioClipInput, options: MutationOptions = {}): Id;
```

### updateAudioClip

```ts
updateAudioClip(trackId: Id, clipId: Id, changes: AudioClipChanges, options: MutationOptions = {}): void;
```

### removeAudioClip

```ts
removeAudioClip(trackId: Id, clipId: Id, options: MutationOptions = {}): void;
```

### moveAudioClip

```ts
moveAudioClip(clipId: Id, targetTrackId: Id, options: MutationOptions & {
    startFrame?: number;
} = {}): void;
```

### splitAudioClip

```ts
splitAudioClip(clipId: Id, frame: number, options: MutationOptions = {}): Id;
```

### comment

```ts
comment(body: string, anchor: ReviewComment["anchor"], options: MutationOptions & {
    author?: string;
} = {}): Id;
```

### resolveComment

```ts
resolveComment(commentId: Id, options: MutationOptions = {}): void;
```

### lock

```ts
lock(targetType: ProjectLock["targetType"], targetId: Id, reason: string, options: MutationOptions = {}): Id;
```

### unlock

```ts
unlock(lockId: Id, options: MutationOptions = {}): void;
```

## normalizeRate

```ts
function normalizeRate(value: number | RationalRate): RationalRate;
```

## rescaleTime

```ts
/** Integer tick conversion with exact intermediate arithmetic; nearest ties round toward +infinity. */
export function rescaleTime(value: number, sourceRate: number | RationalRate, targetRate: number | RationalRate, rounding: TimeRounding = "nearest"): TimeConversion;
```

## defineShotAnimation

```ts
function defineShotAnimation(input: unknown): ShotAnimation;
```

## defineEditorialSequence

```ts
function defineEditorialSequence(input: unknown, animations: readonly ShotAnimation[]): EditorialSequence;
```

## resolveEditorialFrame

```ts
function resolveEditorialFrame(sequence: EditorialSequence, animations: readonly ShotAnimation[], frame: number): ResolvedEditorialFrame;
```

## createEditorialResolver

```ts
/** Validate and copy inputs once; returned frame mappings never expose the snapshot. */
export function createEditorialResolver(sequence: EditorialSequence, animations: readonly ShotAnimation[]): {
    durationFrames: number;
    frameRate: { numerator: number; denominator: number; };
    resolve: (frame: number) => ResolvedEditorialFrame;
};
```

## reviseEditorialSequence

```ts
/** Apply ordered edits to an isolated sequence, then ripple positions and validate its final state. */
export function reviseEditorialSequence(sequence: EditorialSequence, animations: readonly ShotAnimation[], edits: readonly EditorialEdit[]): EditorialSequence;
```

## reviseShotAnimation

```ts
function reviseShotAnimation(animation: ShotAnimation, edits: readonly ShotAnimationEdit[]): ShotAnimation;
```

## shotCoordinates

```ts
function shotCoordinates(input: ShotAnimation, targetId: string, options: CoordinateOptions = {}): ShotCoordinateSpace;
```

## mergeShotAnimation

```ts
/** Merge snapshots with shared IDs; unresolved conflicts produce no animation. */
export function mergeShotAnimation(baseInput: ShotAnimation, localInput: ShotAnimation, incomingInput: ShotAnimation, options: ShotMergeOptions = {}): ShotMergeReport & {
    animation: ShotAnimation | null;
};
```

## planShotMerge

```ts
/** Preview a worker revision against the current shot and prepare its native, version-bound edit plan. */
export function planShotMerge(project: StoryboardProject, base: ShotAnimation, incoming: ShotAnimation, options: ShotMergeOptions = {}): {
    plan: EditPlan | null;
    conflicts: ValueMergeConflict[];
    incomingChanges: string[];
    retainedLocalChanges: string[];
};
```

## planShotHandoffMerge

```ts
/** Check native handoff provenance and resource compatibility before preparing a worker merge. */
export function planShotHandoffMerge(assembly: StoryboardProject, baseline: StoryboardProject, worker: StoryboardProject, options: ShotMergeOptions & {
    animationId: string;
}): {
    plan: EditPlan | null;
    dependencyConflicts: { kind: "component" | "origin" | "palette" | "swatch" | "asset" | "font"; id: string; baseline: ShotDependency | null; local: ShotDependency | null; incoming: ShotDependency; }[];
    source: { projectId: string; version: number; };
    worker: { projectId: string; version: number; };
    conflicts: ValueMergeConflict[];
    incomingChanges: string[];
    retainedLocalChanges: string[];
};
```

## planPaletteMerge

```ts
/** Resolve one palette against the current project and prepare its existing native command. */
export function planPaletteMerge(project: StoryboardProject, base: Palette | null, incoming: Palette | null, options: PaletteMergeOptions = {}): {
    plan: EditPlan | null;
    conflictsResolved: boolean;
    palette: Palette | null;
    conflicts: ValueMergeConflict[];
    incomingChanges: string[];
    retainedLocalChanges: string[];
    id: string;
};
```

## mergePalette

```ts
/** Merge one shared palette identity; null snapshots represent absence, not inferred matches. */
export function mergePalette(baseInput: Palette | null, localInput: Palette | null, incomingInput: Palette | null, options: PaletteMergeOptions = {}): {
    conflictsResolved: boolean;
    palette: Palette | null;
    conflicts: ValueMergeConflict[];
    incomingChanges: string[];
    retainedLocalChanges: string[];
    id: string;
};
```

## shotPointCoordinates

```ts
/** Map geometry through the ordered deformation stack; preserve every face candidate. */
export function shotPointCoordinates(input: ShotAnimation, targetId: string, point: {
    x: number;
    y: number;
}, options: ShotPointOptions): {
    animationId: string;
    targetId: string;
    frame: number;
    direction: "localToFrame" | "frameToLocal";
    candidates: ShotPointCandidate[];
};
```

## retimeShotAnimation

```ts
/** Retime every shot-local frame collection on a detached snapshot; never stretch audio samples. */
export function retimeShotAnimation(input: ShotAnimation, options: ShotRetimeOptions): {
    animation: ShotAnimation;
    report: ShotRetimeReport;
};
```

## shotMeshData

```ts
/** Page detached mesh geometry or key metadata without returning the entire pose track. */
export function shotMeshData(input: ShotAnimation, layerId: string, query: ShotMeshQuery = { collection: "keyframes" }): { animationId: string; layerId: string; bindingKind: "skin" | "mesh" | "curve" | "envelope"; curveRest: CurveMeshPose | null; curveSegments: number | null; envelopeRest: EnvelopeMeshPose | null; envelopeGrid: { columns: number; rows: number; } | null; collection: "joints"; offset: number; limit: number; total: number; nextOffset: number | null; counts: { joints: number; weights: number; vertices: number; triangles: number; keyframes: number; }; items: { layerId: string; id: string; bind: Readonly<AffineMatrix>; index: number; }[]; } | { animationId: string; layerId: string; bindingKind: "skin" | "mesh" | "curve" | "envelope"; curveRest: CurveMeshPose | null; curveSegments: number | null; envelopeRest: EnvelopeMeshPose | null; envelopeGrid: { columns: number; rows: number; } | null; collection: "weights"; offset: number; limit: number; total: number; nextOffset: number | null; counts: { joints: number; weights: number; vertices: number; triangles: number; keyframes: number; }; items: { index: number; influences: readonly { jointId: string; weight: number; }[]; }[]; } | { animationId: string; layerId: string; bindingKind: "skin" | "mesh" | "curve" | "envelope"; curveRest: CurveMeshPose | null; curveSegments: number | null; envelopeRest: EnvelopeMeshPose | null; envelopeGrid: { columns: number; rows: number; } | null; collection: "triangles"; offset: number; limit: number; total: number; nextOffset: number | null; counts: { joints: number; weights: number; vertices: number; triangles: number; keyframes: number; }; items: { index: number; vertices: number[]; }[]; } | { animationId: string; layerId: string; bindingKind: "skin" | "mesh" | "curve" | "envelope"; curveRest: CurveMeshPose | null; curveSegments: number | null; envelopeRest: EnvelopeMeshPose | null; envelopeGrid: { columns: number; rows: number; } | null; collection: "keyframes"; offset: number; limit: number; total: number; nextOffset: number | null; counts: { joints: number; weights: number; vertices: number; triangles: number; keyframes: number; }; items: { index: number; frame: number; easing: Easing; }[]; } | { frame: number | null; animationId: string; layerId: string; bindingKind: "skin" | "mesh" | "curve" | "envelope"; curveRest: CurveMeshPose | null; curveSegments: number | null; envelopeRest: EnvelopeMeshPose | null; envelopeGrid: { columns: number; rows: number; } | null; collection: "vertices"; offset: number; limit: number; total: number; nextOffset: number | null; counts: { joints: number; weights: number; vertices: number; triangles: number; keyframes: number; }; items: { x: number; y: number; index: number; }[]; };
```

## bakeCurveMesh

```ts
/** Bake sampled curve ribbons into editable mesh keys; interpolation remains vertex-based. */
export function bakeCurveMesh(input: CurveMeshInput): MeshAnimation;
```

## createCurveMeshEvaluator

```ts
/** Evaluate controls first, then sample normals; no previous frame contributes to the pose. */
export function createCurveMeshEvaluator(input: CurveMeshInput): (frame: number) => IndexedMeshWarp;
```

## bakeEnvelopeMesh

```ts
/** Tessellate a four-boundary Coons patch into an editable vertex animation. */
export function bakeEnvelopeMesh(input: EnvelopeMeshInput): MeshAnimation;
```

## createSkinMeshEvaluator

```ts
/** Bind explicit weights once; joint poses and output are in the mesh's local coordinate space. */
export function createSkinMeshEvaluator(input: SkinMeshInput): (poses: readonly SkinJointPose[]) => IndexedMeshWarp;
```

## shotControllerData

```ts
/** Inspect detached controller records and optional final, fully blended layer states. */
export function shotControllerData(input: ShotAnimation, controllerId: string, query: ShotControllerQuery = { collection: "keyframes" }): { collection: "targets" | "keyframes"; total: number; nextOffset: number | null; items: { frame: number; weight: number; easing: Easing; index: number; }[]; animationId: string; controllerId: string; name: string; mode: "replace" | "additive"; stackIndex: number; staticWeight: number; activeRange: { startFrame: number; endFrame: number; } | null; frame: number | null; evaluatedWeight: number | null; counts: { targets: number; keyframes: number; }; offset: number; limit: number; } | { collection: "targets" | "keyframes"; total: number; nextOffset: number | null; items: { evaluatedState: EvaluatedLayerState | null; layerId: string; values: Partial<Record<LayerChannel, number>>; index: number; }[]; animationId: string; controllerId: string; name: string; mode: "replace" | "additive"; stackIndex: number; staticWeight: number; activeRange: { startFrame: number; endFrame: number; } | null; frame: number | null; evaluatedWeight: number | null; counts: { targets: number; keyframes: number; }; offset: number; limit: number; };
```

## compileControllerTransfer

```ts
/** Prepare new controller definitions; preserve destination base animation and existing controllers. */
export function compileControllerTransfer(sourceInput: ShotAnimation, targetInput: ShotAnimation, input: ControllerTransferOptions): ShotAnimationEdit[];
```

## captureShotController

```ts
/** Capture explicit local channels into an inactive controller without changing the source. */
export function captureShotController(input: ShotAnimation, options: ControllerCaptureOptions): ShotController;
```

## readControllerPerformance

```ts
/** Validate the versioned JSON envelope, logical payload checksum and controller invariants. */
export function readControllerPerformance(input: unknown): ControllerPerformance;
```

## createControllerPerformance

```ts
/** Capture selected controllers in their source stack order; no artwork or base keys are included. */
export function createControllerPerformance(input: ShotAnimation, options: {
    id: string;
    name: string;
    controllerIds: readonly string[];
}): ControllerPerformance;
```

## compileControllerPerformance

```ts
function compileControllerPerformance(input: unknown, target: ShotAnimation, options: ControllerTransferOptions): ShotAnimationEdit[];
```

## importOTIO

```ts
/** Conform one cut-only video track to existing animations without reading external media. */
export function importOTIO(json: string, animations: readonly ShotAnimation[], options: OTIOImportOptions): {
    sequence: EditorialSequence;
    losses: OTIOLoss[];
};
```

## exportOTIO

```ts
/** Export a single video cut list. Media bindings describe already-rendered media, not artwork. */
export function exportOTIO(input: EditorialSequence, animations: readonly ShotAnimation[], options: OTIOOptions): {
    json: string;
    losses: OTIOLoss[];
};
```

## defineStudioAudio

```ts
function defineStudioAudio(input: unknown): StudioAudioTrack[];
```

## compileStudioAudio

```ts
/** Resolve audible placements to a chosen sample clock without resampling or reading media. */
export function compileStudioAudio(tracks: readonly StudioAudioTrack[], sampleRate: number, options: {
    rounding?: AudioSampleRounding;
} = {}): CompiledAudioClip[];
```

## reviseStudioAudio

```ts
/** Ordered metadata edits; sample fades/ranges are validated on the complete final state. */
export function reviseStudioAudio(tracks: readonly StudioAudioTrack[], edits: readonly StudioAudioEdit[]): StudioAudioTrack[];
```

## conformShotAudio

```ts
function conformShotAudio(animation: ShotAnimation, sampleRate = 48000, options: {
    tracks?: readonly AudioTrackRef[];
    rounding?: AudioSampleRounding;
} = {}): AudioConform;
```

## conformEditorialAudio

```ts
/** Conform at normal playback speed; source audio is cropped, never frame-duplicated or time-stretched. */
export function conformEditorialAudio(sequence: EditorialSequence, animations: readonly ShotAnimation[], options: {
    sampleRate: number;
    transitions: "sum" | "linear";
    tracks?: readonly AudioTrackRef[];
    rounding?: AudioSampleRounding;
}): AudioConform;
```

## mixShotAudio

```ts
async function mixShotAudio(animation: ShotAnimation, decode: StudioAudioDecoder, input: AudioMixOptions = {}): Promise<AudioMixResult>;
```

## mixEditorialAudio

```ts
async function mixEditorialAudio(sequence: EditorialSequence, animations: readonly ShotAnimation[], decode: StudioAudioDecoder, input: AudioMixOptions & {
    transitions: "sum" | "linear";
}): Promise<AudioMixResult>;
```

## createFFmpegAudioDecoder

```ts
/** Asset byte identity is pinned on first use for the lifetime of the returned decoder. */
export function createFFmpegAudioDecoder(readAsset: (id: string) => Promise<Uint8Array> | Uint8Array, options: FFmpegAudioDecoderOptions = {}): StudioAudioDecoder;
```
