# API types

Import exported types from `codeboard-studio` in TypeScript. JavaScript callers use the same object shapes. These declarations describe inputs and returned artwork; they are not instructions to hand-write a project container. Use handles and production methods to edit stored values.

Positions are canvas units; rotation is radians; pressure and opacity use 0–1; pen timestamps use milliseconds; timeline positions use integer frames. Inherited and helper structural types are included for reference; not every helper type is a named package export.

## Id

```ts
export type Id = string;
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
}
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

## ElementPlacement

```ts
interface ElementPlacement {
    matrix?: AffineMatrix;
}
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

## RasterStroke

```ts
export interface RasterStroke extends ElementPlacement {
    /** Global timeline frames: blank at startFrame, complete at endFrame. */
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
export interface RasterSurface extends PixelBuffer {
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

## LayerBase

```ts
interface LayerBase {
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

## TwoBoneRig

```ts
export interface TwoBoneRig {
    elbowId: Id;
    upperLength: number;
    lowerLength: number;
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

## Layer

```ts
export type Layer = DrawingLayer | GroupLayer;
```

## LayerChanges

```ts
export type LayerChanges = Partial<Pick<Layer, "name" | "visible" | "opacity" | "blendMode" | "transform" | "clipToBelow" | "pivot">> & {
    maskLayerId?: Id | null;
};
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

## StoryboardDocument

```ts
export interface StoryboardDocument {
    components: DrawingComponent[];
    schemaVersion: 3;
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

## DrawingComponent

```ts
export interface DrawingComponent {
    id: Id;
    name: string;
    version: number;
    layers: Layer[];
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

## LayerOptions

```ts
export interface LayerOptions {
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

## LayerKeyframe

```ts
export interface LayerKeyframe {
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

## PixelSelection

```ts
export interface PixelSelection {
    width: number;
    height: number;
    coverage: Uint8Array;
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

## CoordinateOptions

```ts
export interface CoordinateOptions {
    frame?: number;
    camera?: boolean;
}
```

## CoordinateSpace

```ts
export interface CoordinateSpace {
    panelId: string;
    layerId: string;
    rootLayerId: string;
    targetId: string;
    frame: number;
    localToFrame: AffineMatrix;
    frameToLocal: AffineMatrix | null;
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

## MutationOptions

```ts
export interface MutationOptions {
    expectedVersion?: number;
}
```

## PointLike

```ts
type PointLike = Pick<Point, "x" | "y"> & Partial<Omit<Point, "x" | "y">>;
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

## Header

```ts
type Header = Omit<StoryboardDocument, "panels" | "components" | "changes">;
```

## PanelInfo

```ts
type PanelInfo = Omit<Panel, "layers" | "motion">;
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
