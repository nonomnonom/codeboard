# Animation types

Data shapes for animation. See [all type groups](../types.md) for other domains and shared units. Import public types from `codeboard-studio`; helper shapes are included to explain nested values.

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

## EvaluatedCamera

```ts
export interface EvaluatedCamera {
    x: number;
    y: number;
    zoom: number;
    rotation: number;
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
