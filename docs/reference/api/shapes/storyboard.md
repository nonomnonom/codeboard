# Storyboard types

Data shapes for storyboard. See [all type groups](../types.md) for other domains and shared units. Import public types from `codeboard-studio`; helper shapes are included to explain nested values.

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
