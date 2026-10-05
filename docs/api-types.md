# API types

Import exported types from `codeboard-studio` in TypeScript. JavaScript callers use the same object shapes. These declarations describe inputs and returned artwork; they are not instructions to hand-write a project container. Use handles and production methods to edit stored values.

Positions are canvas units; rotation is radians; pressure and opacity use 0–1; pen timestamps use milliseconds; timeline positions use integer frames. Inherited and helper structural types are included for reference; not every helper type is a named package export.

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

## Id

```ts
export type Id = string;
```

## AffineMatrix

```ts
export type AffineMatrix = [
    number,
    number,
    number,
    number,
    number,
    number
];
```

## Point

```ts
export interface Point {
    x: number;
    y: number;
    pressure?: number;
    time?: number;
    tiltX?: number;
    tiltY?: number;
    rotation?: number;
}
```

## Transform

```ts
export interface Transform {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
}
```

## Pivot

```ts
export interface Pivot {
    x: number;
    y: number;
}
```

## BlendMode

```ts
export type BlendMode = "source-over" | "multiply" | "screen" | "overlay" | "darken" | "lighten";
```

## PageOptions

```ts
export interface PageOptions {
    limit?: number;
    offset?: number;
}
```

## ObjectQuery

```ts
export interface ObjectQuery extends PageOptions {
    name?: string;
    kind?: string;
    panelId?: Id;
    parentId?: Id;
    id?: Id;
}
```

## ObjectSummary

```ts
export interface ObjectSummary {
    id: Id;
    kind: string;
    name: string;
    panelId?: Id;
    parentId?: Id;
    nameTruncated?: true;
}
```

## ObjectPageQuery

```ts
export interface ObjectPageQuery extends Omit<ObjectQuery, "offset"> {
    cursor?: string;
}
```

## ObjectPage

```ts
export interface ObjectPage {
    version: number;
    items: ObjectSummary[];
    nextCursor?: string;
}
```

## TextureKind

```ts
export type TextureKind = "none" | "graphite" | "charcoal" | "dry-brush";
```

## BrushDynamics

```ts
export interface BrushDynamics {
    pressureSize: number;
    pressureOpacity: number;
    speedSize: number;
    speedOpacity: number;
    tiltShape: number;
    pressureSpacing: number;
    pressureHardness: number;
    rotationJitter: number;
}
```

## BrushTip

```ts
export type BrushTip = {
    kind: "round" | "ellipse" | "chisel" | "rake";
    aspect: number;
    angle: number;
    rotationMode: "fixed" | "stroke" | "stylus";
} | {
    kind: "bitmap";
    width: number;
    height: number;
    alpha: number[];
    angle: number;
    rotationMode: "fixed" | "stroke" | "stylus";
    sourceAssetId?: Id;
};
```

## BrushPreset

```ts
export interface BrushPreset {
    provenance?: {
        source: string;
        author?: string;
        license: string;
        redistribution: "allowed" | "unknown" | "forbidden";
        resourceChecksum: string;
    };
    paperTexture?: {
        width: number;
        height: number;
        alpha: number[];
        scale: number;
        strength: number;
    };
    id: Id;
    name: string;
    version: number;
    tip: BrushTip;
    size: number;
    opacity: number;
    flow: number;
    hardness: number;
    spacing: number;
    taperStart: number;
    taperEnd: number;
    texture: TextureKind;
    textureStrength: number;
    dynamics: BrushDynamics;
}
```

## ElementPlacement

```ts
interface ElementPlacement {
    matrix?: AffineMatrix;
    colorBindings?: Partial<Record<ColorChannel, ColorBinding>>;
}
```

## RasterStroke

```ts
export interface RasterStroke extends ElementPlacement {
    /** Owner time domain (board global or shot local): blank at startFrame, complete at endFrame. */
    reveal?: {
        startFrame: number;
        endFrame: number;
    };
    kind: "raster-stroke";
    id: Id;
    name?: string;
    points: Point[];
    brush: BrushPreset;
    color: string;
    opacity: number;
    erase: boolean;
    seed: number;
    visible: boolean;
}
```

## PixelBuffer

```ts
export interface PixelBuffer {
    width: number;
    height: number;
    pixels: Uint8Array;
}
```

## PixelSelection

```ts
export interface PixelSelection {
    width: number;
    height: number;
    coverage: Uint8Array;
}
```

## PixelRegion

```ts
export interface PixelRegion {
    x: number;
    y: number;
    width: number;
    height: number;
}
```

## RasterSurface

```ts
/** Straight-alpha, sRGB RGBA8 pixels; matrix maps source pixels into layer coordinates. */
export interface RasterSurface extends PixelBuffer, ElementPlacement {
    kind: "raster-surface";
    id: Id;
    name?: string;
    matrix: AffineMatrix;
    opacity: number;
    visible: boolean;
}
```

## VectorStroke

```ts
export interface VectorStroke extends ElementPlacement {
    kind: "vector-stroke";
    id: Id;
    name?: string;
    points: Point[];
    color: string;
    width: number;
    opacity: number;
    taperStart: number;
    taperEnd: number;
    pressureSize: number;
    closed: boolean;
    fill?: string;
    visible: boolean;
}
```

## VectorFill

```ts
export type VectorFill = string | {
    kind: "linear";
    from: {
        x: number;
        y: number;
    };
    to: {
        x: number;
        y: number;
    };
    stops: {
        offset: number;
        color: string;
    }[];
} | {
    kind: "radial";
    from: {
        x: number;
        y: number;
        radius: number;
    };
    to: {
        x: number;
        y: number;
        radius: number;
    };
    stops: {
        offset: number;
        color: string;
    }[];
};
```

## VectorPath

```ts
export interface VectorPath extends ElementPlacement {
    kind: "vector-path";
    id: Id;
    name?: string;
    commands: PathCommand[];
    fill?: VectorFill;
    stroke?: string;
    strokeWidth: number;
    opacity: number;
    visible: boolean;
}
```

## TextElement

```ts
export interface TextElement extends ElementPlacement {
    kind: "text";
    id: Id;
    name?: string;
    x: number;
    y: number;
    text: string;
    color: string;
    font: string;
    align: "left" | "center" | "right";
    opacity: number;
    visible: boolean;
}
```

## PathCommand

```ts
export type PathCommand = {
    op: "M" | "L";
    x: number;
    y: number;
} | {
    op: "C";
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    x: number;
    y: number;
} | {
    op: "Q";
    x1: number;
    y1: number;
    x: number;
    y: number;
} | {
    op: "Z";
};
```

## DrawingElement

```ts
export type DrawingElement = RasterStroke | RasterSurface | VectorStroke | VectorPath | TextElement;
```

## NewDrawingElement

```ts
export type NewDrawingElement = (Omit<RasterStroke, "id"> & {
    id?: Id;
}) | (Omit<RasterSurface, "id"> & {
    id?: Id;
}) | (Omit<VectorStroke, "id"> & {
    id?: Id;
}) | (Omit<VectorPath, "id"> & {
    id?: Id;
}) | (Omit<TextElement, "id"> & {
    id?: Id;
});
```

## StrokeOptions

```ts
export interface StrokeOptions {
    reveal?: {
        startFrame: number;
        endFrame: number;
    };
    id?: Id;
    name?: string;
    color?: string;
    opacity?: number;
    erase?: boolean;
    seed?: number;
}
```

## VectorStrokeOptions

```ts
export interface VectorStrokeOptions extends StrokeOptions {
    width?: number;
    taperStart?: number;
    taperEnd?: number;
    pressureSize?: number;
    closed?: boolean;
    fill?: string;
}
```

## TwoBoneRig

```ts
export interface TwoBoneRig {
    elbowId: Id;
    upperLength: number;
    lowerLength: number;
    restPose?: {
        root: {
            x: number;
            y: number;
            rotation: number;
        };
        elbowRotation: number;
    };
}
```

## DrawingExposure

```ts
export interface DrawingExposure {
    frame: number;
    drawingId: Id | null;
}
```

## DrawingInterval

```ts
export interface DrawingInterval {
    startFrame: number;
    endFrame: number;
    drawingId: Id | null;
}
```

## DrawingNeighbors

```ts
export interface DrawingNeighbors {
    current: DrawingInterval;
    previous: DrawingInterval | null;
    next: DrawingInterval | null;
}
```

## Transition

```ts
export interface Transition {
    type: "cut" | "dissolve" | "wipe-left" | "wipe-right";
    durationFrames: number;
}
```

## Easing

```ts
export type Easing = "linear" | "ease-in-out" | "hold" | {
    type: "cubic-bezier";
    x1: number;
    y1: number;
    x2: number;
    y2: number;
};
```

## CameraChannel

```ts
export type CameraChannel = "x" | "y" | "zoom" | "rotation";
```

## CameraKeyframe

```ts
export interface CameraKeyframe {
    id: Id;
    frame: number;
    x?: number;
    y?: number;
    zoom?: number;
    rotation?: number;
    easing: Easing;
    channelEasing?: Partial<Record<CameraChannel, Easing>>;
}
```

## LayerEffectChannel

```ts
export type LayerEffectChannel = "offsetX" | "offsetY" | "opacity";
```

## LayerEffectValue

```ts
export interface LayerEffectValue {
    index: number;
    channel?: LayerEffectChannel;
    value: number;
    easing?: Easing;
}
```

## LayerKeyframe

```ts
export interface LayerKeyframe {
    effectValues?: LayerEffectValue[];
    id: Id;
    frame: number;
    transform: Partial<Transform>;
    opacity?: number;
    depth?: number;
    easing: Easing;
    channelEasing?: Partial<Record<LayerChannel, Easing>>;
}
```

## LayerChannel

```ts
export type LayerChannel = keyof Transform | "opacity" | "depth";
```

## CameraKeyframeInput

```ts
export type CameraKeyframeInput = Partial<Pick<CameraKeyframe, CameraChannel | "easing">>;
```

## CameraKeyframeChanges

```ts
export type CameraKeyframeChanges = Partial<Omit<CameraKeyframe, "id">>;
```

## LayerKeyframeInput

```ts
export interface LayerKeyframeInput {
    effectValues?: LayerKeyframe["effectValues"];
    transform?: Partial<Transform>;
    opacity?: number;
    depth?: number;
    easing?: LayerKeyframe["easing"];
}
```

## LayerKeyframeChanges

```ts
export type LayerKeyframeChanges = Partial<Omit<LayerKeyframe, "id">>;
```

## LayerEffect

```ts
export type LayerEffect = {
    kind: "blur";
    amount: number;
} | {
    kind: "shadow";
    amount: number;
    offsetX: number;
    offsetY: number;
    color: {
        r: number;
        g: number;
        b: number;
    };
    opacity: number;
} | {
    kind: "brightness";
    amount: number;
} | {
    kind: "contrast";
    amount: number;
} | {
    kind: "saturation";
    amount: number;
} | {
    kind: "hue-rotate";
    degrees: number;
};
```

## LayerBase

```ts
interface LayerBase {
    effects?: LayerEffect[];
    pivot?: Pivot;
    componentSource?: {
        id: Id;
        version: number;
    };
    id: Id;
    name: string;
    visible: boolean;
    opacity: number;
    blendMode: BlendMode;
    transform: Transform;
    maskLayerId?: Id;
    clipToBelow: boolean;
    keyframes: LayerKeyframe[];
    depth: number;
    exposure: {
        startFrame: number;
        endFrame: number;
    } | null;
}
```

## DrawingLayer

```ts
export interface DrawingLayer extends LayerBase {
    kind: "raster" | "vector";
    elements: DrawingElement[];
}
```

## GroupLayer

```ts
export interface GroupLayer extends LayerBase {
    kind: "group";
    children: Layer[];
    drawingSequence?: DrawingExposure[];
    twoBoneRig?: TwoBoneRig;
}
```

## Layer

```ts
export type Layer = DrawingLayer | GroupLayer;
```

## LayerChanges

```ts
export type LayerChanges = Partial<Pick<Layer, "name" | "visible" | "opacity" | "blendMode" | "transform" | "clipToBelow" | "pivot" | "effects">> & {
    maskLayerId?: Id | null;
};
```

## DrawingComponent

```ts
export interface DrawingComponent {
    id: Id;
    name: string;
    version: number;
    layers: Layer[];
}
```

## LayerOptions

```ts
export interface LayerOptions {
    effects?: LayerEffect[];
    pivot?: Pivot;
    depth?: number;
    exposure?: {
        startFrame: number;
        endFrame: number;
    };
    id?: Id;
    opacity?: number;
    blendMode?: BlendMode;
    transform?: Partial<Transform>;
    maskLayerId?: Id;
    clipToBelow?: boolean;
    visible?: boolean;
}
```

## MotionAnnotation

```ts
export interface MotionAnnotation {
    id: Id;
    label: string;
    from: Point;
    to: Point;
    color: string;
}
```

## Panel

```ts
export interface Panel {
    id: Id;
    shotId: Id;
    number: string;
    title: string;
    width: number;
    height: number;
    durationFrames: number;
    startFrame: number;
    transition: Transition;
    status: "working" | "review" | "approved";
    action: string;
    dialogue: string;
    camera: string;
    notes: string;
    layers: Layer[];
    motion: MotionAnnotation[];
    revision: number;
}
```

## Shot

```ts
export interface Shot {
    id: Id;
    sceneId: Id;
    name: string;
    panelIds: Id[];
    cameraKeyframes: CameraKeyframe[];
}
```

## Scene

```ts
export interface Scene {
    sequenceId: Id;
    id: Id;
    name: string;
    shotIds: Id[];
}
```

## Sequence

```ts
export interface Sequence {
    id: Id;
    name: string;
    sceneIds: Id[];
}
```

## PanelOptions

```ts
export interface PanelOptions {
    id?: Id;
    number?: string;
    title?: string;
    width?: number;
    height?: number;
    durationFrames?: number;
    action?: string;
    dialogue?: string;
    camera?: string;
    notes?: string;
}
```

## StoryboardDocument

```ts
export interface StoryboardDocument {
    components: DrawingComponent[];
    schemaVersion: 5;
    studio: StudioContent;
    version: number;
    id: Id;
    title: string;
    author?: string;
    createdAt: string;
    updatedAt: string;
    canvas: {
        width: number;
        height: number;
        background: string;
    };
    seed: number;
    frameRate: number;
    idCounter: number;
    scenes: Scene[];
    sequences: Sequence[];
    shots: Shot[];
    panels: Panel[];
    brushes: BrushPreset[];
    assets: Asset[];
    audioTracks: AudioTrack[];
    comments: ReviewComment[];
    locks: ProjectLock[];
    changes: ChangeEntry[];
    metadata: Record<string, string>;
}
```

## ProjectOptions

```ts
export interface ProjectOptions {
    id?: Id;
    title: string;
    author?: string;
    width?: number;
    height?: number;
    background?: string;
    seed?: number;
    frameRate?: number;
}
```

## ProjectChanges

```ts
export interface ProjectChanges {
    title?: string;
    author?: string | null;
    seed?: number;
    frameRate?: {
        value: number;
        timing: "preserve-frames" | "preserve-seconds";
    };
    canvas?: {
        width?: number;
        height?: number;
        background?: string;
        /** Existing artwork coordinates stay unchanged in either mode. */
        applyTo?: "new-panels" | "all-panels";
    };
}
```

## Asset

```ts
export interface Asset {
    id: Id;
    kind: "image" | "audio";
    name: string;
    path: string;
    mimeType: string;
    source: "linked" | "managed";
    checksum?: string;
}
```

## AudioClip

```ts
export interface AudioClip {
    id: Id;
    assetId: Id;
    name: string;
    startFrame: number;
    sourceInFrame: number;
    durationFrames: number;
    volume: number;
    fadeInFrames: number;
    fadeOutFrames: number;
}
```

## AudioTrack

```ts
export interface AudioTrack {
    id: Id;
    name: string;
    muted: boolean;
    locked: boolean;
    clips: AudioClip[];
}
```

## AudioTrackSummary

```ts
export interface AudioTrackSummary extends Omit<AudioTrack, "clips"> {
    clipCount: number;
}
```

## AudioClipQuery

```ts
export interface AudioClipQuery extends PageOptions {
    frame?: number;
    assetId?: Id;
}
```

## AudioTrackChanges

```ts
export type AudioTrackChanges = Partial<Pick<AudioTrack, "name" | "muted" | "locked">>;
```

## AudioClipInput

```ts
export type AudioClipInput = Omit<AudioClip, "id"> & {
    id?: Id;
};
```

## AudioClipChanges

```ts
export type AudioClipChanges = Partial<Pick<AudioClip, "startFrame" | "sourceInFrame" | "durationFrames" | "volume" | "fadeInFrames" | "fadeOutFrames" | "name">>;
```

## ReviewComment

```ts
export interface ReviewComment {
    id: Id;
    author: string;
    body: string;
    status: "open" | "resolved";
    anchor: {
        panelId?: Id;
        layerId?: Id;
        elementId?: Id;
        frame?: number;
        x?: number;
        y?: number;
    };
    createdAt: string;
    resolvedAt?: string;
}
```

## ProjectLock

```ts
export interface ProjectLock {
    id: Id;
    targetType: "project" | "panel" | "layer";
    targetId: Id;
    owner: string;
    reason: string;
    createdAt: string;
}
```

## ChangeEntry

```ts
export interface ChangeEntry {
    id: Id;
    version: number;
    actor: string;
    operation: string;
    targetIds: Id[];
    timestamp: string;
}
```

## SheetOptions

```ts
export interface SheetOptions {
    columns?: number;
    rows?: number;
    pageWidth?: number;
    pageHeight?: number;
    margin?: number;
    gutter?: number;
    captionHeight?: number;
}
```

## ShotRenderOptions

```ts
export interface ShotRenderOptions {
    /** Override the stored shot graph; null explicitly renders the uncomposited layer stack. */
    compositing?: import("./compositing.js").ShotCompositeGraph | null;
    layerIds?: readonly string[];
    background?: "scene" | "transparent";
}
```

## ShotAnimation

```ts
export interface ShotAnimation {
    compositing?: import("./compositing.js").ShotCompositeGraph;
    controllers?: import("./controllers.js").ShotController[];
    meshes?: ShotMeshBinding[];
    boardPanelIds?: string[];
    audio?: StudioAudioTrack[];
    id: string;
    shotId: string;
    name: string;
    frameRate: RationalRate;
    durationFrames: number;
    canvas: {
        width: number;
        height: number;
        background: string;
    };
    layers: Layer[];
    cameraKeyframes: CameraKeyframe[];
}
```

## ShotAnimationEdit

```ts
export type ShotAnimationEdit = import("./controllers.js").ShotControllerEdit | ({
    op: "timing.retime";
} & import("./shot-timing.js").ShotRetimeOptions) | {
    op: "compositing.set";
    graph: import("./compositing.js").ShotCompositeGraph | null;
} | {
    op: "layer.deformation.rest.apply";
    layerId: string;
    frame: number;
    easing?: import("./animation.js").Easing;
} | {
    op: "layer.skin.weights.put";
    layerId: string;
    vertexIndex: number;
    influences: LayerSkinInput["weights"][number];
} | {
    op: "layer.skin.bind.capture";
    layerId: string;
    frame: number;
} | {
    op: "layer.skin";
    layerId: string;
    skin: LayerSkinInput | null;
} | {
    op: "layer.envelope";
    layerId: string;
    envelope: EnvelopeMeshInput | null;
} | {
    op: "layer.envelope.key.put";
    layerId: string;
    key: EnvelopeMeshInput["keyframes"][number];
} | {
    op: "layer.envelope.key.remove";
    layerId: string;
    frame: number;
} | {
    op: "layer.mesh";
    layerId: string;
    mesh: MeshAnimation | null;
} | {
    op: "layer.curve";
    layerId: string;
    curve: CurveMeshInput | null;
} | {
    op: "layer.curve.key.put";
    layerId: string;
    key: CurveMeshInput["keyframes"][number];
} | {
    op: "layer.curve.key.remove";
    layerId: string;
    frame: number;
} | {
    op: "layer.mesh.key.put";
    layerId: string;
    key: MeshAnimation["keyframes"][number];
} | {
    op: "layer.mesh.key.remove";
    layerId: string;
    frame: number;
} | {
    op: "layer.drawing.range";
    layerId: string;
    startFrame: number;
    endFrame: number;
    drawingId: string | null;
} | {
    op: "layer.pose";
    layerId: string;
    frame: number;
    keyId: string;
    mode: "replace" | "additive";
    weight: number;
    values: Partial<Record<import("./animation.js").LayerChannel, number>>;
    easing?: import("./animation.js").Easing;
} | {
    op: "board.link";
    panelIds: string[];
} | {
    op: "layer.rig.rest.capture";
    layerId: string;
    frame: number;
} | {
    op: "layer.rig.rest.apply";
    layerId: string;
    frame: number;
    rootKeyId: string;
    elbowKeyId: string;
    easing?: import("./animation.js").Easing;
} | {
    op: "layer.rig.pose";
    layerId: string;
    frame: number;
    target: {
        x: number;
        y: number;
    };
    rootKeyId: string;
    elbowKeyId: string;
    unreachable: "reject" | "clamp";
    bend?: 1 | -1;
    easing?: import("./animation.js").Easing;
} | {
    op: "layer.add";
    id: string;
    kind: "raster" | "vector" | "group";
    name: string;
    options?: Omit<import("./layers.js").LayerOptions, "id">;
    parentId?: string;
    beforeId?: string;
} | {
    op: "layer.move";
    layerId: string;
    parentId: string | null;
    beforeId?: string;
} | {
    op: "layer.remove";
    layerId: string;
} | {
    op: "layer.rig";
    layerId: string;
    definition: import("./animation.js").TwoBoneRig | null;
} | {
    op: "layer.depth";
    layerId: string;
    depth: number;
} | {
    op: "layer.set";
    layerId: string;
    changes: import("./layers.js").LayerChanges;
} | {
    op: "layer.exposure";
    layerId: string;
    exposure: Layer["exposure"];
} | {
    op: "layer.drawings";
    layerId: string;
    keys: import("./animation.js").DrawingExposure[] | null;
} | {
    op: "layer.key.put";
    layerId: string;
    key: import("./animation.js").LayerKeyframe;
} | {
    op: "layer.key.remove";
    layerId: string;
    id: string;
} | {
    op: "camera.key.put";
    key: CameraKeyframe;
} | {
    op: "camera.key.remove";
    id: string;
};
```

## StudioContent

```ts
export interface StudioContent {
    componentOrigins?: import("./component-origins.js").ComponentOrigin[];
    palettes?: import("./palettes.js").Palette[];
    script?: ProductionScript;
    animations: ShotAnimation[];
    editorial: EditorialSequence[];
}
```

## EditorialClip

```ts
export interface EditorialClip {
    id: string;
    animationId: string;
    startFrame: number;
    sourceInFrame: number;
    /** Editorial frames to hold source-in before normal source playback; shot audio is silent during the hold. */
    holdFrames?: number;
    durationFrames: number;
    transition: Transition;
}
```

## EditorialSequence

```ts
export interface EditorialSequence {
    audio?: StudioAudioTrack[];
    id: string;
    frameRate: RationalRate;
    clips: EditorialClip[];
}
```

## ResolvedEditorialFrame

```ts
export interface ResolvedEditorialFrame {
    frame: number;
    outgoing: {
        clipId: string;
        animationId: string;
        sourceFrame: number;
    };
    incoming?: {
        clipId: string;
        animationId: string;
        sourceFrame: number;
    };
    transition: Transition["type"];
    progress: number;
}
```

## EditorialEdit

```ts
export type EditorialEdit = {
    op: "split";
    id: string;
    atFrame: number;
    newId: string;
} | {
    op: "insert";
    clip: Omit<EditorialClip, "startFrame">;
    beforeId?: string;
} | {
    op: "update";
    id: string;
    changes: Partial<Pick<EditorialClip, "animationId" | "sourceInFrame" | "holdFrames" | "durationFrames" | "transition">>;
} | {
    op: "move";
    id: string;
    beforeId?: string;
} | {
    op: "remove";
    id: string;
};
```

## ScriptEntry

```ts
export interface ScriptEntry {
    id: string;
    kind: "scene" | "action" | "dialogue";
    text: string;
    speaker?: string;
    panelIds: string[];
}
```

## ScriptInput

```ts
export interface ScriptInput {
    id: string;
    title: string;
    entries: ScriptEntry[];
}
```

## ProductionScript

```ts
export interface ProductionScript extends ScriptInput {
    revision: number;
}
```

## ScriptChangeReport

```ts
export interface ScriptChangeReport {
    scriptId: string;
    beforeRevision: number;
    revision: number;
    titleChanged: boolean;
    reordered: boolean;
    added: string[];
    removed: string[];
    updated: {
        id: string;
        fields: ("kind" | "text" | "speaker" | "panelIds")[];
    }[];
}
```

## ColorChannel

```ts
export type ColorChannel = "color" | "fill" | "stroke";
```

## ColorBinding

```ts
export interface ColorBinding {
    swatchId: string;
    override?: string | undefined;
}
```

## PaletteSwatch

```ts
export interface PaletteSwatch {
    id: string;
    name: string;
    color: string;
}
```

## Palette

```ts
export interface Palette {
    id: string;
    name: string;
    swatches: PaletteSwatch[];
}
```

## PaletteBindingUsage

```ts
export interface PaletteBindingUsage {
    ownerKind: "panel" | "component" | "animation";
    ownerId: string;
    layerId: string;
    elementId: string;
    channel: ColorChannel;
    swatchId: string;
    override?: string;
}
```

## MouthCue

```ts
export interface MouthCue {
    startFrame: number;
    endFrame: number;
    mouth: string;
}
```

## LipSyncOptions

```ts
export interface LipSyncOptions {
    startFrame: number;
    endFrame: number;
    mouths: Record<string, string | null>;
    restDrawingId: string | null;
    cues: readonly MouthCue[];
    corrections?: readonly DrawingInterval[];
}
```

## LipSyncTimingOptions

```ts
export interface LipSyncTimingOptions {
    sourceRate: RationalRate;
    targetRate: RationalRate;
    rounding?: TimeRounding;
}
```

## ShotMergeOptions

```ts
export type ShotMergeOptions = ValueMergeOptions;
```

## ShotMergeConflict

```ts
export type ShotMergeConflict = ValueMergeConflict;
```

## ShotMergeReport

```ts
export type ShotMergeReport = ValueMergeReport;
```

## OTIOMediaBinding

```ts
export interface OTIOMediaBinding {
    animationId: string;
    /** Exact external reference URL; never fetched or resolved by the adapter. */
    targetUrl: string;
    /** Media frame corresponding to animation frame zero, at the animation's rate. */
    sourceStartFrame?: number;
}
```

## OTIOOptions

```ts
export interface OTIOOptions {
    media: OTIOMediaBinding[];
    /** Reject unrepresented metadata/audio by default; report permits listed omissions. */
    lossPolicy?: "reject" | "report";
}
```

## OTIOImportOptions

```ts
export interface OTIOImportOptions extends OTIOOptions {
    sequenceId: string;
    frameRate: RationalRate;
}
```

## OTIOLoss

```ts
export interface OTIOLoss {
    path: string;
    reason: string;
}
```

## PSDImportOptions

```ts
export interface PSDImportOptions {
    /** Prefix for deterministic imported layer/element IDs; choose a fresh namespace per source. */
    namespace: string;
    /** Explicit interpretation of this subset's untagged RGB channels. Tagged profiles reject. */
    sourceColorSpace: "srgb";
    lossPolicy?: "reject" | "report";
}
```

## PSDImportLoss

```ts
export interface PSDImportLoss {
    path: string;
    reason: string;
}
```

## PSDImportResult

```ts
export interface PSDImportResult {
    width: number;
    height: number;
    layers: Layer[];
    sourceSha256: string;
    losses: PSDImportLoss[];
}
```

## StudioAudioClip

```ts
export interface StudioAudioClip {
    id: string;
    assetId: string;
    name: string;
    start: {
        ticks: number;
        rate: RationalRate;
    };
    source: {
        sampleRate: number;
        startSample: number;
        sampleCount: number;
    };
    volume: number;
    fadeInSamples: number;
    fadeOutSamples: number;
}
```

## StudioAudioTrack

```ts
export interface StudioAudioTrack {
    id: string;
    name: string;
    muted: boolean;
    clips: StudioAudioClip[];
}
```

## StudioAudioEdit

```ts
export type StudioAudioEdit = {
    op: "track.add";
    track: StudioAudioTrack;
} | {
    op: "track.update";
    id: string;
    changes: Partial<Pick<StudioAudioTrack, "name" | "muted">>;
} | {
    op: "track.remove";
    id: string;
} | {
    op: "clip.add";
    trackId: string;
    clip: StudioAudioClip;
} | {
    op: "clip.update";
    id: string;
    changes: Partial<Omit<StudioAudioClip, "id">>;
} | {
    op: "clip.move";
    id: string;
    trackId: string;
    start?: StudioAudioClip["start"];
} | {
    op: "clip.split";
    id: string;
    atSample: number;
    newId: string;
} | {
    op: "clip.remove";
    id: string;
};
```

## ErrorCode

```ts
export type ErrorCode = "OPERATION_FAILED" | "MISSING_DEPENDENCY" | "INVALID_ARGUMENT" | "INVALID_CURSOR" | "STALE_CURSOR" | "REVISION_CONFLICT" | "RESOURCE_LIMIT" | "REQUEST_ID_REUSED" | "ASSET_MISSING" | "ASSET_CHECKSUM_MISMATCH" | "CANCELLED" | "SCHEMA_MIGRATION_REQUIRED";
```

## CapabilityReport

```ts
export interface CapabilityReport {
    format: "codeboard-capabilities/1";
    runtime: {
        package: string;
        version: string;
        node: string;
        platform: string;
    };
    projectSchemaVersion: number;
    containerFormatVersion: number;
    features: CapabilityEntry[];
    editCommands: string[];
    dependencies: {
        ffmpeg: DependencyAvailability;
        ffprobe: DependencyAvailability;
    };
    formats: {
        project: string[];
        image: string[];
        delivery: string[];
    };
}
```

## CapabilityEntry

```ts
export interface CapabilityEntry {
    id: string;
    status: "supported" | "partial" | "unavailable";
    operations: string[];
    constraints: string[];
}
```

## DependencyAvailability

```ts
export interface DependencyAvailability {
    status: "unchecked" | "available" | "unavailable";
    version?: string;
    reason?: string;
}
```

## ProjectMigrationReport

```ts
export interface ProjectMigrationReport {
    format: "codeboard-project-migration/1";
    source: string;
    target: string;
    sourceContainerVersion: number;
    targetSchemaVersion: number;
    version: number;
    documentHash: string;
    snapshotHash: string;
    preserved: {
        projectId: string;
        boardTiming: true;
        artworkIds: true;
        embeddedAssets: number;
    };
    warnings: string[];
}
```

## PanelCaptureResult

```ts
export interface PanelCaptureResult {
    animationId: string;
    source: {
        projectId: string;
        version: number;
        panelId: string;
        panelRevision: number;
        startFrame: number;
        durationFrames: number;
        captureStartFrame: number;
        captureDurationFrames: number;
    };
    identities: {
        sourceId: string;
        capturedId: string;
    }[];
}
```

## PanelCaptureOptions

```ts
export interface PanelCaptureOptions {
    id: string;
    name?: string;
    preRollFrames?: number;
    postRollFrames?: number;
}
```

## CaptionImportReport

```ts
export interface CaptionImportReport {
    baseVersion: number;
    changes: {
        panelId: string;
        field: CaptionField;
        before: string;
        after: string;
    }[];
    unchangedPanelIds: string[];
    plan: EditPlan | null;
}
```

## ScriptBoardPanel

```ts
export interface ScriptBoardPanel {
    panelId: string;
    shotId: string;
    entryIds: string[];
    durationFrames: number;
    title?: string;
}
```

## ScriptBoardReport

```ts
export interface ScriptBoardReport {
    scriptId: string;
    scriptRevision: number;
    panels: {
        panelId: string;
        shotId: string;
        entryIds: string[];
        durationFrames: number;
    }[];
    plan: EditPlan;
}
```

## CaptionField

```ts
export type CaptionField = (typeof captionFields)[number];
```

## CaptionImportRow

```ts
export type CaptionImportRow = {
    panelId: string;
} & Partial<Record<CaptionField, string | undefined>>;
```

## EditCommand

```ts
export type EditCommand = {
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

## ResourceOrigin

```ts
export interface ResourceOrigin {
    source: string;
    author?: string;
    license: string;
    redistribution: "allowed" | "unknown" | "forbidden";
}
```

## BrushResource

```ts
export interface BrushResource {
    id: string;
    name: string;
    role: "tip" | "texture";
    tip: Extract<BrushTip, {
        kind: "bitmap";
    }>;
    originalWidth: number;
    originalHeight: number;
    checksum: string;
    origin: ResourceOrigin;
}
```

## ImportedPreset

```ts
export interface ImportedPreset {
    name: string;
    engine: string;
    parameters: Record<string, string>;
    resourceIds: string[];
    mapped: Partial<Pick<BrushPreset, "spacing" | "opacity" | "flow">>;
    missingDependencies: string[];
    unsupported: string[];
}
```

## BrushImportReport

```ts
export interface BrushImportReport {
    format: string;
    source: ResourceOrigin;
    checksum: string;
    resources: BrushResource[];
    presets: ImportedPreset[];
    mapped: string[];
    missingDependencies: string[];
    unsupported: string[];
    warnings: string[];
}
```

## ImportOptions

```ts
export interface ImportOptions {
    origin: ResourceOrigin;
    maxTipSize?: number;
    maskMode?: "alpha" | "luminance" | "inverse-luminance";
    dependencies?: Record<string, Buffer>;
    role?: "tip" | "texture";
}
```

## CompositionGuides

```ts
export interface CompositionGuides {
    frame?: number;
    thirds?: boolean;
    /** Fraction of frame width/height inset on each edge; not a broadcast standard. */
    safeInset?: number;
    /** Output-frame pixel coordinates, after camera placement. */
    horizonY?: number;
    vanishingPoints?: readonly {
        x: number;
        y: number;
    }[];
}
```

## OnionSkinSample

```ts
export interface OnionSkinSample {
    panelId: string;
    frame?: number;
    layerIds?: readonly string[];
    tint?: string;
    opacity?: number;
}
```

## PathSamplingOptions

```ts
export interface PathSamplingOptions {
    /** Maximum intended spacing in local canvas units; native curve measurement is approximate. */
    step?: number;
    /** Reject before native sampling if the control-polygon estimate exceeds this allocation budget. */
    maxSamples?: number;
}
```

## PixelColor

```ts
export type PixelColor = readonly [
    number,
    number,
    number,
    number
];
```

## PixelComparison

```ts
export interface PixelComparison {
    width: number;
    height: number;
    changedPixels: number;
    maxChannelDelta: number;
    meanAbsoluteDelta: number;
    bounds: PixelRegion | null;
}
```

## CoordinateSpace

```ts
export interface CoordinateSpace extends ArtworkCoordinateSpace {
    panelId: string;
}
```

## TwoBoneSolution

```ts
export interface TwoBoneSolution {
    rootRotation: number;
    elbowRotation: number;
    elbow: {
        x: number;
        y: number;
    };
    end: {
        x: number;
        y: number;
    };
    reachable: boolean;
    error: number;
}
```

## RationalRate

```ts
export interface RationalRate {
    numerator: number;
    denominator: number;
}
```

## TimeRounding

```ts
export type TimeRounding = "nearest" | "floor" | "ceil" | "exact";
```

## TimeConversion

```ts
export interface TimeConversion {
    value: number;
    exact: boolean;
    /** Rounded value minus the exact position, in destination ticks. */
    error: {
        numerator: string;
        denominator: string;
    };
}
```

## ReviewTarget

```ts
export type ReviewTarget = {
    kind: "board";
} | {
    kind: "shot";
    animationId: string;
} | {
    kind: "editorial";
    sequenceId: string;
};
```

## ReviewFrameSource

```ts
export type ReviewFrameSource = {
    kind: "board";
    panelId: string;
    incomingPanelId?: string;
    transitionProgress: number;
} | {
    kind: "shot";
    animationId: string;
    sourceFrame: number;
} | {
    kind: "editorial";
    sequenceId: string;
    outgoing: {
        clipId: string;
        animationId: string;
        sourceFrame: number;
    };
    incoming?: {
        clipId: string;
        animationId: string;
        sourceFrame: number;
    };
    transition: Transition["type"];
    transitionProgress: number;
};
```

## ReviewExportOptions

```ts
export interface ReviewExportOptions {
    target?: ReviewTarget;
    frames: number[];
    expectedVersion: number;
    revision?: string;
    annotations?: boolean;
    signal?: AbortSignal;
}
```

## ReviewManifest

```ts
export interface ReviewManifest {
    format: "codeboard-review/2";
    createdAt: string;
    source: {
        projectId: string;
        version: number;
        schemaVersion: number;
        documentHash: string;
        revision?: string;
    };
    renderer: {
        package: string;
        version: string;
        node: string;
        platform: string;
    };
    settings: {
        target: ReviewTarget;
        annotations: boolean;
        frameRate: RationalRate;
        space: "camera";
        imageFormat: "PNG";
    };
    frames: {
        frame: number;
        file: string;
        sha256: string;
        bytes: number;
        width: number;
        height: number;
        source: ReviewFrameSource;
    }[];
}
```

## ProjectPublishManifest

```ts
export interface ProjectPublishManifest {
    format: "codeboard-project-publish/1";
    source: {
        projectId: string;
        version: number;
        documentHash: string;
    };
    file: {
        name: "project.cboard";
        bytes: number;
        sha256: string;
    };
    engine: RenderIdentity;
    externalFonts: string[];
    fontFiles?: FontFileDependency[];
}
```

## CopyProjectOptions

```ts
export interface CopyProjectOptions {
    expectedVersion: number;
    maxBytes?: number;
    signal?: AbortSignal;
}
```

## MovieOptions

```ts
export interface MovieOptions extends MovieEncodingOptions {
    fontPolicy?: FontPolicy;
    assetRoot?: string;
}
```

## StudioMovieOptions

```ts
export interface StudioMovieOptions extends MovieEncodingOptions {
    fontPolicy?: FontPolicy;
    range?: {
        startFrame: number;
        endFrame: number;
    };
    audio?: "omit" | {
        mode: "mix";
        decoder: StudioAudioDecoder;
        transitions: "sum" | "linear";
        maxSamples?: number;
        rounding?: AudioSampleRounding;
    };
}
```

## AudioStemTarget

```ts
export type AudioStemTarget = {
    kind: "shot";
    animation: ShotAnimation;
} | {
    kind: "editorial";
    sequence: EditorialSequence;
    animations: readonly ShotAnimation[];
};
```

## AudioStemExportOptions

```ts
export interface AudioStemExportOptions {
    stems: readonly {
        name: string;
        tracks: readonly AudioTrackRef[];
    }[];
    transitions: "sum" | "linear";
    sampleFormat?: "pcm16" | "float32";
    mix?: Omit<AudioMixOptions, "tracks">;
}
```

## AudioStemManifest

```ts
export interface AudioStemManifest {
    format: "codeboard-audio-stems/1";
    source: {
        kind: "shot" | "editorial";
        id: string;
        fingerprint: string;
    };
    sampleRate: number;
    sampleFormat: "pcm16" | "float32";
    transitions: "sum" | "linear";
    range: {
        startSample: number;
        endSample: number;
    };
    stems: {
        name: string;
        tracks: AudioTrackRef[];
        file: string;
        sha256: string;
        bytes: number;
        samples: number;
        peak: number;
        clippedSamples: number;
    }[];
}
```

## FrameJobOptions

```ts
export interface FrameJobOptions {
    expectedVersion: number;
    target: FrameJobManifest["target"];
    range?: {
        startFrame: number;
        endFrame: number;
    };
    maxBytes?: number;
    fontPolicy?: "allow-fallback" | "require-available";
    outputProfile?: FrameJobManifest["outputProfile"];
    fontFiles?: FrameJobManifest["fontFiles"];
}
```

## RunFrameJobOptions

```ts
export interface RunFrameJobOptions {
    sourcePath?: string;
    range?: {
        startFrame: number;
        endFrame: number;
    };
    signal?: AbortSignal;
    onProgress?: (completed: number, total: number) => void;
}
```

## FrameJobMovieOptions

```ts
export interface FrameJobMovieOptions extends Omit<StudioMovieOptions, "range"> {
    sourcePath?: string;
}
```

## VerifyFrameJobOptions

```ts
export interface VerifyFrameJobOptions {
    signal?: AbortSignal;
    onProgress?: (visited: number, total: number) => void;
}
```

## FrameOutputProfile

```ts
export type FrameOutputProfile = {
    width: number;
    height: number;
    fit: "contain" | "cover" | "fill";
} & ({
    alpha: "preserve";
} | {
    alpha: "flatten";
    background: {
        r: number;
        g: number;
        b: number;
    };
});
```

## FrameJobFontFile

```ts
export type FrameJobFontFile = FontFileDependency;
```

## FrameJobManifest

```ts
export interface FrameJobManifest {
    format: "codeboard-frame-job/1";
    source: {
        path: string;
        projectId: string;
        version: number;
        documentHash: string;
    };
    target: {
        kind: "shot";
        animationId: string;
        render?: ShotRenderOptions;
    } | {
        kind: "editorial";
        sequenceId: string;
    };
    range: {
        startFrame: number;
        endFrame: number;
    };
    frameRate: {
        numerator: number;
        denominator: number;
    };
    renderer: RenderIdentity;
    maxBytes: number;
    fontPolicy?: "allow-fallback" | "require-available";
    outputProfile?: FrameOutputProfile;
    fontFiles?: FrameJobFontFile[];
}
```

## FontDependency

```ts
export interface FontDependency {
    ownerId: string;
    layerId: string;
    elementId: string;
    font: string;
    canonicalFont: string | null;
    families: {
        name: string;
        status: "available" | "generic" | "missing";
    }[];
    resolvedFamilies: string[];
    issue: "invalid-declaration" | "unsupported-declaration" | "missing-family" | null;
}
```

## FontInspection

```ts
export interface FontInspection {
    available: boolean;
    elements: FontDependency[];
}
```

## FontPolicy

```ts
export type FontPolicy = "allow-fallback" | "require-available";
```

## MovieEncodingOptions

```ts
export interface MovieEncodingOptions {
    ffmpegPath?: string;
    maxFrames?: number;
    signal?: AbortSignal;
    onProgress?: (completed: number, total: number) => void;
}
```

## MutationOptions

```ts
export interface MutationOptions {
    expectedVersion?: number;
}
```

## PointLike

```ts
export type PointLike = Pick<Point, "x" | "y"> & Partial<Omit<Point, "x" | "y">>;
```

## PathBooleanOperation

```ts
export type PathBooleanOperation = "union" | "intersect" | "difference" | "xor";
```

## RenderSource

```ts
export type RenderSource = StoryboardProject | StoryboardDocument;
```

## PanelRenderSource

```ts
export type PanelRenderSource = StoryboardProject | Pick<StoryboardDocument, "canvas" | "panels" | "shots">;
```

## ToneOptions

```ts
export interface ToneOptions {
    frequency?: number;
    durationSeconds?: number;
    sampleRate?: number;
    volume?: number;
    attackSeconds?: number;
    releaseSeconds?: number;
}
```

## WavEncodingOptions

```ts
export interface WavEncodingOptions {
    sampleFormat?: "pcm16" | "float32";
}
```

## CompiledAudioClip

```ts
export interface CompiledAudioClip {
    trackId: string;
    clip: StudioAudioClip;
    startSample: TimeConversion;
    sampleCount: TimeConversion;
    fadeInSamples: TimeConversion;
    fadeOutSamples: TimeConversion;
}
```

## AudioSampleRounding

```ts
export type AudioSampleRounding = "nearest" | "exact";
```

## AudioGainRamp

```ts
export interface AudioGainRamp {
    startSample: number;
    endSample: number;
    from: number;
    to: number;
}
```

## ConformedAudioSegment

```ts
export interface ConformedAudioSegment {
    ownerId: string;
    editorialClipId?: string;
    audio: CompiledAudioClip;
    outputStartSample: number;
    clipOffsetSamples: number;
    sampleCount: number;
    ramps: AudioGainRamp[];
}
```

## AudioConform

```ts
export interface AudioConform {
    rounding?: AudioSampleRounding;
    trackSelection?: AudioTrackRef[];
    sampleRate: number;
    duration: TimeConversion;
    segments: ConformedAudioSegment[];
    windows: {
        clipId: string;
        sourceStart: TimeConversion;
        outputStart: TimeConversion;
        outputEnd: TimeConversion;
        /** Present when source playback begins after an initial silent picture hold. */
        playbackStart?: TimeConversion;
        sourceLimit: TimeConversion;
    }[];
    transitions: "sum" | "linear";
}
```

## AudioDecodeRequest

```ts
export interface AudioDecodeRequest {
    assetId: string;
    sourceSampleRate: number;
    startSample: number;
    sampleCount: number;
    outputSampleRate: number;
    outputSampleCount: number;
    signal?: AbortSignal;
}
```

## StudioAudioDecoder

```ts
/** Return trimmed/resampled mono or stereo PCM; the adapter must verify source rate and range. */
export type StudioAudioDecoder = (request: AudioDecodeRequest) => Promise<Float32Array[]>;
```

## AudioMixOptions

```ts
export interface AudioMixOptions {
    rounding?: AudioSampleRounding;
    range?: {
        startSample: number;
        endSample: number;
    };
    tracks?: readonly AudioTrackRef[];
    sampleRate?: number;
    maxSamples?: number;
    signal?: AbortSignal;
}
```

## AudioMixResult

```ts
export interface AudioMixResult {
    range: {
        startSample: number;
        endSample: number;
    };
    sampleRate: number;
    channels: [
        Float32Array,
        Float32Array
    ];
    peak: number;
    clippedSamples: number;
    conform: AudioConform;
}
```

## AudioTrackRef

```ts
export interface AudioTrackRef {
    ownerId: string;
    trackId: string;
}
```

## FFmpegAudioDecoderOptions

```ts
export interface FFmpegAudioDecoderOptions {
    ffmpegPath?: string;
    ffprobePath?: string;
    timeoutMs?: number;
    maxAssetBytes?: number;
}
```

## Header

```ts
export type Header = Omit<StoryboardDocument, "panels" | "components" | "changes" | "studio">;
```

## PanelInfo

```ts
export type PanelInfo = Omit<Panel, "layers" | "motion">;
```

## SaveOptions

```ts
export type SaveOptions = {
    expectedVersion?: number;
    overwrite?: boolean;
    assetRoot?: string;
    readAsset?: (id: string) => Buffer | undefined;
};
```

## EvaluatedCamera

```ts
export interface EvaluatedCamera {
    x: number;
    y: number;
    zoom: number;
    rotation: number;
}
```

## BoardCaptureOptions

```ts
export interface BoardCaptureOptions {
    sequenceId: string;
    panels: readonly {
        panelId: string;
        animationId: string;
        clipId: string;
    }[];
    audio: {
        mode: "omit";
    } | {
        mode: "convert";
        sampleRates: Record<string, number>;
        rounding?: TimeRounding;
    };
}
```

## ShotRetimeReport

```ts
export interface ShotRetimeReport {
    animationId: string;
    before: {
        durationFrames: number;
        frameRate: RationalRate;
    };
    after: {
        durationFrames: number;
        frameRate: RationalRate;
    };
    rounding: TimeRounding;
    positions: number;
    movedPositions: number;
    quantizedPositions: number;
    audio: {
        policy: ShotRetimeOptions["audio"];
        clips: number;
        movedStarts: number;
    };
}
```

## ShotRetimeOptions

```ts
export interface ShotRetimeOptions {
    durationFrames: number;
    frameRate?: RationalRate;
    /** Exact by default; any quantization must be explicitly selected. */
    rounding?: TimeRounding;
    /** Source samples/fades are never stretched; choose how cue starts follow the new timing. */
    audio: "preserve-seconds" | "scale-starts";
}
```

## ScriptCSVOptions

```ts
export interface ScriptCSVOptions {
    id: string;
    title: string;
}
```

## FDXLoss

```ts
export interface FDXLoss {
    path: string;
    reason: string;
}
```

## FDXParagraph

```ts
export interface FDXParagraph {
    /** Zero-based direct Paragraph position within Content, including unsupported paragraphs. */
    paragraph: number;
    kind: ScriptEntry["kind"];
    text: string;
    speaker?: string;
}
```

## FDXInspection

```ts
export interface FDXInspection {
    sourceSha256: string;
    paragraphs: FDXParagraph[];
    losses: FDXLoss[];
}
```

## FDXImportOptions

```ts
export interface FDXImportOptions {
    id: string;
    title: string;
    /** Hash from inspection; rejects bindings prepared for different source text. */
    sourceSha256: string;
    /** Exactly one explicit stable identity/link binding per inspected paragraph. */
    bindings: {
        paragraph: number;
        id: string;
        panelIds: string[];
    }[];
    lossPolicy?: "reject" | "report";
}
```

## ShotCompositeNode

```ts
export type ShotCompositeNode = {
    id: string;
    kind: "source";
    layerIds: string[];
} | {
    id: string;
    kind: "effects";
    input: string;
    effects: LayerEffect[];
    keyframes?: {
        frame: number;
        easing: Easing;
        effectValues: LayerEffectValue[];
    }[];
} | {
    id: string;
    kind: "blend";
    background: string;
    foreground: string;
    mode: BlendMode;
    opacity: number;
    keyframes?: {
        frame: number;
        easing: Easing;
        opacity: number;
    }[];
} | {
    id: string;
    kind: "mask";
    input: string;
    mask: string;
    mode: "in" | "out";
};
```

## ShotCompositeGraph

```ts
/** Frame-sized RGBA graph evaluated after source layer placement and camera. */
export interface ShotCompositeGraph {
    nodes: ShotCompositeNode[];
    output: string;
}
```

## SkinMeshInput

```ts
export interface SkinMeshInput {
    source: MeshAnimation["source"];
    triangles: MeshAnimation["triangles"];
    joints: readonly {
        id: string;
        bind: Readonly<AffineMatrix>;
    }[];
    weights: readonly (readonly {
        jointId: string;
        weight: number;
    }[])[];
}
```

## LayerSkinInput

```ts
export interface LayerSkinInput extends SkinMeshInput {
    jointLayers: readonly {
        jointId: string;
        layerId: string;
    }[];
}
```

## SkinJointPose

```ts
export interface SkinJointPose {
    jointId: string;
    matrix: Readonly<AffineMatrix>;
}
```

## Position

```ts
type Position = {
    readonly x: number;
    readonly y: number;
};
```

## CurveMeshPose

```ts
export type CurveMeshPose = {
    curve: readonly [
        Position,
        Position,
        Position,
        Position
    ];
    width: number;
};
```

## CurveMeshInput

```ts
export interface CurveMeshInput {
    rest: CurveMeshPose;
    segments?: number;
    keyframes: readonly (CurveMeshPose & {
        frame: number;
        easing: Easing;
    })[];
}
```

## EnvelopeMeshPose

```ts
export type EnvelopeMeshPose = Record<"top" | "bottom" | "left" | "right", CurveMeshPose["curve"]>;
```

## EnvelopeMeshInput

```ts
export interface EnvelopeMeshInput {
    rest: EnvelopeMeshPose;
    columns?: number;
    rows?: number;
    keyframes: readonly {
        frame: number;
        pose: EnvelopeMeshPose;
        easing: Easing;
    }[];
}
```

## ShotMeshBinding

```ts
export type ShotMeshBinding = {
    layerId: string;
} & ({
    skin: LayerSkinInput;
    mesh?: never;
    curve?: never;
    envelope?: never;
} | {
    mesh: MeshAnimation;
    curve?: never;
    envelope?: never;
    skin?: never;
} | {
    curve: CurveMeshInput;
    mesh?: never;
    envelope?: never;
    skin?: never;
} | {
    envelope: EnvelopeMeshInput;
    mesh?: never;
    curve?: never;
    skin?: never;
});
```

## MeshAnimation

```ts
export interface MeshAnimation {
    source: readonly {
        readonly x: number;
        readonly y: number;
    }[];
    triangles: readonly (readonly [
        number,
        number,
        number
    ])[];
    keyframes: readonly {
        frame: number;
        vertices: readonly {
            readonly x: number;
            readonly y: number;
        }[];
        easing: Easing;
    }[];
}
```

## ShotController

```ts
export interface ShotController {
    id: string;
    name: string;
    mode: "replace" | "additive";
    weight: number;
    activeRange?: {
        startFrame: number;
        endFrame: number;
    };
    targets: readonly {
        layerId: string;
        values: Partial<Record<LayerChannel, number>>;
    }[];
    keyframes: readonly {
        frame: number;
        weight: number;
        easing: Easing;
    }[];
}
```

## ShotControllerEdit

```ts
export type ShotControllerEdit = {
    op: "controller.put";
    controller: ShotController;
} | {
    op: "controller.remove";
    id: string;
} | {
    op: "controller.range";
    id: string;
    range: NonNullable<ShotController["activeRange"]> | null;
} | {
    op: "controller.weight";
    id: string;
    weight: number;
} | {
    op: "controller.key.put";
    id: string;
    key: ShotController["keyframes"][number];
} | {
    op: "controller.key.remove";
    id: string;
    frame: number;
} | {
    op: "controller.move";
    id: string;
    beforeId: string | null;
};
```

## ShotDuplicateOptions

```ts
export interface ShotDuplicateOptions {
    id: string;
    shotId: string;
    name?: string;
}
```

## ShotDuplicateResult

```ts
export interface ShotDuplicateResult {
    animationId: string;
    sourceAnimationId: string;
    identities: {
        sourceId: string;
        copyId: string;
    }[];
}
```

## ShotDependency

```ts
export interface ShotDependency {
    kind: "component" | "origin" | "palette" | "swatch" | "asset" | "font";
    id: string;
    status: "embedded" | "declared" | "missing";
    sha256: string | null;
    version?: number;
    paletteId?: string;
    source?: "linked" | "managed";
    checksum?: string | null;
}
```

## PaletteMergeOptions

```ts
export type PaletteMergeOptions = ValueMergeOptions;
```

## ShotSubsetOptions

```ts
export interface ShotSubsetOptions {
    projectId: string;
    title?: string;
}
```

## PlanStudioLayer

```ts
export type PlanStudioLayer = (Omit<GroupLayer, "children"> & {
    children: PlanStudioLayer[];
}) | (Omit<DrawingLayer, "elements"> & {
    elements: PlanDrawingElement[];
});
```

## ReviewDecisionInput

```ts
export interface ReviewDecisionInput {
    id: string;
    reviewer: {
        id: string;
        kind: "human" | "agent";
    };
    outcome: "approved" | "changes-requested" | "not-reviewed";
    criteria: string[];
    frames: number[];
    notes: string;
}
```

## ReviewDecision

```ts
export interface ReviewDecision extends ReviewDecisionInput {
    format: "codeboard-review-decision/1";
    createdAt: string;
    evidence: {
        manifestSha256: string;
        projectId: string;
        version: number;
        documentHash: string;
        target: ReviewTarget;
    };
    sha256: string;
}
```

## ReviewDecisionVerifyOptions

```ts
export interface ReviewDecisionVerifyOptions {
    decode?: boolean;
    signal?: AbortSignal;
    source?: {
        projectPath: string;
        revision?: string;
    };
}
```

## CoordinateOptions

```ts
export interface CoordinateOptions {
    frame?: number;
    camera?: boolean;
}
```

## ArtworkCoordinateSpace

```ts
export interface ArtworkCoordinateSpace {
    layerId: string;
    rootLayerId: string;
    targetId: string;
    frame: number;
    localToFrame: AffineMatrix;
    frameToLocal: AffineMatrix | null;
    parentToFrame: AffineMatrix;
    frameToParent: AffineMatrix | null;
}
```

## ShotCoordinateSpace

```ts
export interface ShotCoordinateSpace extends ArtworkCoordinateSpace {
    animationId: string;
}
```

## ShotMeshQuery

```ts
export type ShotMeshQuery = PageOptions & ({
    collection: "vertices";
    frame?: number;
} | {
    collection: "triangles" | "keyframes" | "joints" | "weights";
});
```

## ShotPointOptions

```ts
export interface ShotPointOptions extends CoordinateOptions {
    direction: "localToFrame" | "frameToLocal";
}
```

## ShotPointCandidate

```ts
export interface ShotPointCandidate {
    point: {
        x: number;
        y: number;
    };
    faces: {
        layerId: string;
        triangleIndex: number;
        weights: number[];
    }[];
}
```

## VerifyFrameSequenceOptions

```ts
export interface VerifyFrameSequenceOptions {
    decode?: boolean;
    signal?: AbortSignal;
    onProgress?: (verified: number, total: number) => void;
}
```

## FrameJobSequenceOptions

```ts
export interface FrameJobSequenceOptions {
    maxFrames?: number;
    signal?: AbortSignal;
    onProgress?: (completed: number, total: number) => void;
}
```

## PublishProjectOptions

```ts
export interface PublishProjectOptions extends CopyProjectOptions {
    fontFiles?: FontFileDependency[];
}
```

## FontFileDependency

```ts
export interface FontFileDependency {
    family: string;
    path: string;
    sha256: string;
}
```

## ShotControllerQuery

```ts
export type ShotControllerQuery = PageOptions & {
    collection: "targets" | "keyframes";
    frame?: number;
};
```

## ControllerTransferOptions

```ts
export interface ControllerTransferOptions {
    controllers: readonly {
        sourceId: string;
        targetId: string;
    }[];
    layers: readonly {
        sourceId: string;
        targetId: string;
    }[];
    frameOffset: number;
    sourceRange?: {
        startFrame: number;
        endFrame: number;
    };
}
```

## ControllerCaptureOptions

```ts
export type ControllerCaptureOptions = {
    id: string;
    name: string;
    frame: number;
    evaluation: "base" | "controlled";
    targets: readonly {
        layerId: string;
        channels: readonly LayerChannel[];
    }[];
} & ({
    mode: "replace";
} | {
    mode: "additive";
    referenceFrame: number;
});
```

## ControllerPerformance

```ts
export interface ControllerPerformance {
    format: "codeboard-controller-performance";
    version: 1;
    id: string;
    name: string;
    frameRate: RationalRate;
    controllers: ShotController[];
    sha256: string;
}
```

## ComponentOrigin

```ts
export interface ComponentOrigin {
    instanceId: string;
    componentId: string;
    version: number;
    source: Layer[];
    identities: {
        sourceId: string;
        copyId: string;
    }[];
    sha256: string;
}
```

## ComponentUpgradeOptions

```ts
export interface ComponentUpgradeOptions extends ValueMergeOptions {
    newIdentities?: readonly {
        sourceId: string;
        copyId: string;
    }[];
}
```
