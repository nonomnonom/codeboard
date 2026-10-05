# Compositing types

Data shapes for compositing. See [all type groups](../types.md) for other domains and shared units. Import public types from `codeboard-studio`; helper shapes are included to explain nested values.

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
