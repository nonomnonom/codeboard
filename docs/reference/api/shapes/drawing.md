# Drawing types

Data shapes for drawing. See [all type groups](../types.md) for other domains and shared units. Import public types from `codeboard-studio`; helper shapes are included to explain nested values.

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

## PointLike

```ts
export type PointLike = Pick<Point, "x" | "y"> & Partial<Omit<Point, "x" | "y">>;
```

## PathBooleanOperation

```ts
export type PathBooleanOperation = "union" | "intersect" | "difference" | "xor";
```
