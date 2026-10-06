# Scene3d types

Data shapes for scene3d. See [all type groups](../types.md) for other domains and shared units. Import public types from `codeboard-studio`; helper shapes are included to explain nested values.

## Vector3D

```ts
export type Vector3D = [
    number,
    number,
    number
];
```

## Pose3D

```ts
export interface Pose3D {
    position?: Vector3D;
    /** Euler XYZ angles in radians. Values are interpolated directly, allowing multiple turns. */
    rotation?: Vector3D;
    scale?: Vector3D;
}
```

## Scene3DKeyframe

```ts
export interface Scene3DKeyframe extends Pose3D {
    /** Board-global or shot-local frame, matching the containing artwork. */
    frame: number;
    easing: Easing;
}
```

## Scene3DNodeBase

```ts
interface Scene3DNodeBase extends Pose3D {
    /** Unique within this scene, independent of project object IDs. */
    id: string;
    parentId?: string;
    visible?: boolean;
    keyframes?: Scene3DKeyframe[];
}
```

## Scene3DNode

```ts
export type Scene3DNode = (Scene3DNodeBase & {
    kind: "group";
}) | (Scene3DNodeBase & {
    kind: "mesh";
    geometry: "box" | "sphere" | "cylinder" | "cone" | "plane" | "torus";
    material: {
        kind: "basic" | "lambert" | "normal";
        /** Used by basic and Lambert materials; normal materials derive their color from geometry. */
        color?: string;
        opacity?: number;
        doubleSided?: boolean;
    };
});
```

## Scene3DCameraKeyframe

```ts
export interface Scene3DCameraKeyframe {
    frame: number;
    easing: Easing;
    position?: Vector3D;
    target?: Vector3D;
}
```

## Scene3DCamera

```ts
export type Scene3DCamera = {
    position: Vector3D;
    target: Vector3D;
    near?: number;
    far?: number;
    keyframes?: Scene3DCameraKeyframe[];
} & ({
    kind: "perspective";
    fov: number;
} | {
    kind: "orthographic";
    height: number;
});
```

## Scene3DLight

```ts
export type Scene3DLight = {
    kind: "ambient";
    color: string;
    intensity: number;
} | {
    kind: "directional";
    color: string;
    intensity: number;
    position: Vector3D;
    target: Vector3D;
};
```

## Scene3D

```ts
export interface Scene3D {
    width: number;
    height: number;
    /** Omit for transparency; scene colors use #RRGGBB. */
    background?: string;
    camera: Scene3DCamera;
    nodes: Scene3DNode[];
    lights?: Scene3DLight[];
}
```

## Scene3DElement

```ts
/** A persistent scene rendered into its own viewport inside a vector layer. */
export interface Scene3DElement {
    kind: "scene-3d";
    id: string;
    name?: string;
    scene: Scene3D;
    matrix?: AffineMatrix;
    opacity: number;
    visible: boolean;
    colorBindings?: never;
}
```
