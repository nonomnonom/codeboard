# Brushes types

Data shapes for brushes. See [all type groups](../types.md) for other domains and shared units. Import public types from `codeboard-studio`; helper shapes are included to explain nested values.

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
