# Artwork types

Data shapes for artwork. See [all type groups](../types.md) for other domains and shared units. Import public types from `codeboard-studio`; helper shapes are included to explain nested values.

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
export type DrawingElement = RasterStroke | RasterSurface | VectorStroke | VectorPath | TextElement | Scene3DElement;
```

## NewDrawingElement

```ts
export type NewDrawingElement = (Omit<Scene3DElement, "id"> & {
    id?: Id;
}) | (Omit<RasterStroke, "id"> & {
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
