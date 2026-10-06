# Edit plans types

Data shapes for edit plans. See [all type groups](../types.md) for other domains and shared units. Import public types from `codeboard-studio`; helper shapes are included to explain nested values.

## ValueMergeOptions

```ts
export interface ValueMergeOptions {
    /** JSON Pointer paths from a previous conflict report, with explicit choices. */
    resolutions?: Record<string, "local" | "incoming">;
}
```

## ValueMergeConflict

```ts
export interface ValueMergeConflict {
    path: string;
    kind: "value" | "structure" | "timing";
    resolution: "unresolved" | "local" | "incoming";
}
```

## ValueMergeReport

```ts
export interface ValueMergeReport {
    conflicts: ValueMergeConflict[];
    incomingChanges: string[];
    retainedLocalChanges: string[];
}
```

## EditCommand

```ts
export type EditCommand = ({
    op: "character.instantiate";
    sourceAnimationId: string;
} & import("../../model/types/characters.js").CharacterInstanceOptions) | {
    op: "palette.put";
    palette: import("../../model/types/palettes.js").Palette;
} | {
    op: "palette.remove";
    id: string;
} | {
    op: "palette.bind";
    elementId: string;
    channel: import("../../model/types/palettes.js").ColorChannel;
    binding: import("../../model/types/palettes.js").ColorBinding | null;
} | {
    op: "animation.element.add";
    animationId: string;
    layerId: string;
    element: PlanDrawingElement;
} | {
    op: "animation.element.remove";
    animationId: string;
    layerId: string;
    ids: string[];
} | {
    op: "animation.edit";
    id: string;
    edits: import("../../model/types/shot.js").ShotAnimationEdit[];
} | {
    op: "studio.audio.edit";
    ownerId: string;
    edits: import("../../model/types/studio-audio.js").StudioAudioEdit[];
} | {
    op: "studio.audio.set";
    ownerId: string;
    tracks: import("../../model/types/studio-audio.js").StudioAudioTrack[];
} | {
    op: "editorial.edit";
    id: string;
    edits: import("../../model/types/editorial.js").EditorialEdit[];
} | ({
    op: "animation.capturePanel";
    panelId: string;
} & import("../project/capture.js").PanelCaptureOptions) | {
    op: "animation.duplicate";
    sourceAnimationId: string;
    id: string;
    shotId: string;
    name?: string;
} | {
    op: "animation.element.replace";
    animationId: string;
    layerId: string;
    id: string;
    element: PlanDrawingElement;
} | {
    op: "animation.pixels.patch";
    animationId: string;
    layerId: string;
    id: string;
    region: PixelRegion;
    pixelsBase64: string;
} | {
    op: "animation.put";
    animation: import("./studio.js").PlanShotAnimation;
} | {
    op: "animation.remove";
    id: string;
} | {
    op: "editorial.put";
    sequence: import("../../model/types/editorial.js").EditorialSequence;
} | {
    op: "editorial.remove";
    id: string;
} | {
    op: "project.configure";
    changes: ProjectChanges;
} | {
    op: "project.metadata";
    key: string;
    value: string;
} | {
    op: "script.replace";
    script: ScriptInput;
    expectedRevision: number;
} | {
    op: "panel.revise";
    id: string;
    changes: Partial<Pick<Panel, "title" | "durationFrames" | "action" | "dialogue" | "camera" | "notes">>;
} | {
    op: "panel.status";
    id: string;
    status: Panel["status"];
} | {
    op: "layer.set";
    panelId: string;
    id: string;
    changes: LayerChanges;
} | {
    op: "layer.exposure";
    id: string;
    exposure: Layer["exposure"];
} | {
    op: "layer.depth";
    id: string;
    depth: number;
} | {
    op: "drawing.sequence";
    id: string;
    keys: DrawingExposure[] | null;
} | {
    op: "drawing.range";
    id: string;
    startFrame: number;
    endFrame: number;
    drawingId: string | null;
} | {
    op: "rig.define";
    id: string;
    definition: TwoBoneRig | null;
} | {
    op: "rig.pose";
    id: string;
    frame: number;
    target: {
        x: number;
        y: number;
    };
    bend?: 1 | -1;
    unreachable?: "reject" | "clamp";
} | {
    op: "camera.key";
    shotId: string;
    frame: number;
    value: CameraKeyframeInput;
} | {
    op: "camera.key.update";
    shotId: string;
    id: string;
    changes: CameraKeyframeChanges;
} | {
    op: "camera.key.remove";
    shotId: string;
    id: string;
} | {
    op: "camera.key.removeChannels";
    shotId: string;
    id: string;
    channels: CameraChannel[];
} | {
    op: "layer.key";
    layerId: string;
    frame: number;
    value: LayerKeyframeInput;
} | {
    op: "layer.key.update";
    layerId: string;
    id: string;
    changes: LayerKeyframeChanges;
} | {
    op: "layer.key.remove";
    layerId: string;
    id: string;
} | {
    op: "layer.key.removeChannels";
    layerId: string;
    id: string;
    channels: LayerChannel[];
} | {
    op: "audio.track.add";
    id: string;
    name: string;
} | {
    op: "audio.track.update";
    id: string;
    changes: AudioTrackChanges;
} | {
    op: "audio.track.remove";
    id: string;
} | {
    op: "audio.clip.add";
    trackId: string;
    clip: AudioClipInput;
} | {
    op: "audio.clip.update";
    trackId: string;
    id: string;
    changes: AudioClipChanges;
} | {
    op: "audio.clip.remove";
    trackId: string;
    id: string;
} | {
    op: "audio.clip.move";
    id: string;
    trackId: string;
    startFrame?: number;
} | {
    op: "audio.clip.split";
    id: string;
    frame: number;
} | {
    op: "asset.add";
    asset: Asset & {
        checksum: string;
    };
} | {
    op: "asset.update";
    id: string;
    changes: Partial<Omit<Asset, "id">> & {
        checksum: string;
    };
} | {
    op: "sequence.add";
    id: string;
    name: string;
} | {
    op: "scene.add";
    sequenceId: string;
    id: string;
    name: string;
} | {
    op: "shot.add";
    sceneId: string;
    id: string;
    name: string;
} | {
    op: "panel.add";
    shotId: string;
    options: PanelOptions & {
        id: string;
    };
} | {
    op: "panel.duration";
    id: string;
    durationFrames: number;
    mode: "ripple" | "preserve";
} | {
    op: "panel.transition";
    id: string;
    transition: Transition;
} | {
    op: "panel.number";
    id: string;
    number: string;
} | {
    op: "panel.move";
    id: string;
    beforeId?: string;
} | {
    op: "panel.duplicate";
    id: string;
} | {
    op: "panel.remove";
    id: string;
} | {
    op: "layer.add";
    panelId: string;
    kind: "raster" | "vector" | "group";
    name: string;
    options: LayerOptions & {
        id: string;
    };
    parentId?: string;
} | {
    op: "layer.move";
    id: string;
    beforeId?: string;
} | {
    op: "layer.reparent";
    id: string;
    parentId: string | null;
    beforeId?: string;
} | {
    op: "layer.remove";
    id: string;
} | {
    op: "element.add";
    panelId: string;
    layerId: string;
    element: PlanDrawingElement;
} | {
    op: "element.replace";
    panelId: string;
    layerId: string;
    id: string;
    element: PlanDrawingElement;
} | {
    op: "element.remove";
    panelId: string;
    layerId: string;
    ids: string[];
} | {
    op: "element.outline";
    panelId: string;
    layerId: string;
    id: string;
} | {
    op: "element.boolean";
    panelId: string;
    layerId: string;
    id: string;
    tool: PathCommand[];
    operation: PathBooleanOperation;
} | {
    op: "pixels.patch";
    panelId: string;
    layerId: string;
    id: string;
    region: PixelRegion;
    pixelsBase64: string;
} | {
    op: "brush.create";
    definition: Omit<BrushPreset, "version">;
} | {
    op: "brush.revise";
    id: string;
    changes: Partial<Omit<BrushPreset, "id" | "version">>;
} | {
    op: "brush.duplicate";
    id: string;
    name: string;
} | {
    op: "component.capture";
    layerId: string;
    id: string;
    name: string;
} | {
    op: "component.source.replace";
    componentId: string;
    layers: import("./layers.js").PlanStudioLayer[];
    expectedComponentVersion: number;
} | {
    op: "component.element.replace";
    componentId: string;
    layerId: string;
    element: PlanDrawingElement;
    expectedComponentVersion: number;
} | ({
    op: "component.upgrade";
    id: string;
    expectedInputHash: string;
} & import("../../model/component-upgrade.js").ComponentUpgradeOptions) | {
    op: "component.revise";
    id: string;
    sourceLayerId: string;
} | {
    op: "component.instantiate";
    id: string;
    componentId: string;
    panelId: string;
    transform?: Partial<Transform>;
} | {
    op: "component.refresh";
    id: string;
    comments: "reject" | "anchor-to-instance";
} | {
    op: "review.comment";
    body: string;
    anchor: ReviewComment["anchor"];
} | {
    op: "review.resolve";
    id: string;
} | {
    op: "lock.acquire";
    targetType: ProjectLock["targetType"];
    targetId: string;
    reason: string;
} | {
    op: "lock.release";
    id: string;
};
```

## EditPlan

```ts
export interface EditPlan {
    format: "codeboard-edit-plan/1";
    projectId: string;
    actor: string;
    baseVersion: number;
    baseHash: string;
    label: string;
    commands: EditCommand[];
    digest: string;
}
```

## CommitReceipt

```ts
export interface CommitReceipt {
    requestId: string;
    digest: string;
    projectId: string;
    actor: string;
    baseVersion: number;
    committedVersion: number;
    committedAt: string;
}
```

## CommitResult

```ts
export interface CommitResult {
    receipt: CommitReceipt;
    replayed: boolean;
}
```

## PlanDrawingElement

```ts
export type PlanDrawingElement = Exclude<DrawingElement, RasterSurface> | (Omit<RasterSurface, "pixels"> & {
    pixelsBase64: string;
});
```

## PlanShotAnimation

```ts
export type PlanShotAnimation = Omit<ShotAnimation, "layers"> & {
    layers: PlanStudioLayer[];
};
```

## PlanStudioLayer

```ts
export type PlanStudioLayer = (Omit<GroupLayer, "children"> & {
    children: PlanStudioLayer[];
}) | (Omit<DrawingLayer, "elements"> & {
    elements: PlanDrawingElement[];
});
```
