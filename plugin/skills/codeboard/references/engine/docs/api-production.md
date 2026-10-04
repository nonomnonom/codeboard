# Timeline and production API

Access these methods through `project.production`. Timeline positions use global integer frames. Read values are inspection copies; use the mutation methods to apply changes. See [animation](animation.md), [camera](camera.md), [audio](audio.md), and [components](components.md).

Parameter declarations below are extracted from the current source. A value after `=` is the default; `?` marks an optional input. Named data shapes are listed in [API types](api-types.md).

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

### instantiateComponent

```ts
instantiateComponent(componentId: Id, panelId: Id, transform: Partial<Transform> = {}, options: MutationOptions & {
    id?: Id;
} = {}): Id;
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
    readonly schemaVersion: 3;
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
addCameraKeyframe(shotId: Id, frame: number, value: Partial<Pick<CameraKeyframe, CameraChannel | "easing">>, options: MutationOptions = {}): Id;
```

### updateCameraKeyframe

```ts
updateCameraKeyframe(shotId: Id, keyframeId: Id, changes: Partial<Omit<CameraKeyframe, "id">>, options: MutationOptions = {}): void;
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
addLayerKeyframe(layerId: Id, frame: number, value: {
    transform?: Partial<Transform>;
    opacity?: number;
    depth?: number;
    easing?: LayerKeyframe["easing"];
}, options: MutationOptions = {}): Id;
```

### updateLayerKeyframe

```ts
updateLayerKeyframe(layerId: Id, keyframeId: Id, changes: Partial<Omit<LayerKeyframe, "id">>, options: MutationOptions = {}): void;
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
updateAudioTrack(trackId: Id, changes: {
    name?: string;
    muted?: boolean;
    locked?: boolean;
}, options: MutationOptions = {}): void;
```

### removeAudioTrack

```ts
removeAudioTrack(trackId: Id, options: MutationOptions = {}): void;
```

### addAudioClip

```ts
addAudioClip(trackId: Id, clip: Omit<AudioClip, "id"> & {
    id?: Id;
}, options: MutationOptions = {}): Id;
```

### updateAudioClip

```ts
updateAudioClip(trackId: Id, clipId: Id, changes: Partial<Pick<AudioClip, "startFrame" | "sourceInFrame" | "durationFrames" | "volume" | "fadeInFrames" | "fadeOutFrames" | "name">>, options: MutationOptions = {}): void;
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
