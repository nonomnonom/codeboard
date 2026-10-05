# Layers types

Data shapes for layers. See [all type groups](../types.md) for other domains and shared units. Import public types from `codeboard-studio`; helper shapes are included to explain nested values.

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
