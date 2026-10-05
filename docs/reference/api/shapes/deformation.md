# Deformation types

Data shapes for deformation. See [all type groups](../types.md) for other domains and shared units. Import public types from `codeboard-studio`; helper shapes are included to explain nested values.

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
