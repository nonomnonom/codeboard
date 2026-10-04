# Drawing and math API

Named functions are imported from `codeboard-studio`. See [drawing](drawing.md), [brushes](brushes.md), and [math](math.md) for use and constraints. Built-in brushes are `brushes.roughPencil`, `cleanInk`, `shadeBrush`, `charcoal`, and `softEraser`. `brushParameterSchema` validates a preset.

Parameter declarations below are extracted from the current source. A value after `=` is the default; `?` marks an optional input. Named data shapes are listed in [API types](api-types.md).

## line

```ts
function line(from: PointLike, to: PointLike, samples = 24): Point[];
```

## cubic

```ts
function cubic(p0: PointLike, p1: PointLike, p2: PointLike, p3: PointLike, samples = 48): Point[];
```

## catmullRom

```ts
function catmullRom(points: PointLike[], samplesPerSegment = 12, tension = 0.5): Point[];
```

## ellipse

```ts
function ellipse(cx: number, cy: number, rx: number, ry: number, options: {
    samples?: number;
    pressure?: number;
    rotation?: number;
} = {}): Point[];
```

## translate

```ts
function translate(points: Point[], x: number, y: number): Point[];
```

## scale

```ts
function scale(points: Point[], scaleX: number, scaleY = scaleX, origin = { x: 0, y: 0 }): Point[];
```

## withPressure

```ts
function withPressure(points: Point[], pressure: number | ((t: number) => number)): Point[];
```

## hatchPolygon

```ts
function hatchPolygon(polygon: PointLike[], options: {
    angle?: number;
    spacing?: number;
    pressure?: number;
    jitter?: number;
    seed?: number;
    maxSamples?: number;
} = {}): Point[][];
```

## mirrored

```ts
function mirrored(points: Point[], axisX: number): Point[];
```

## pathCommands

```ts
/** SVG's absolute M/L/C/Q/Z subset, retained as editable contour commands. */
export function pathCommands(source: string): PathCommand[];
```

## samplePath

```ts
/** Sample separate pen-down paths. The original editable contour commands remain untouched. */
export function samplePath(commands: readonly PathCommand[], options: PathSamplingOptions = {}): Point[][];
```

## splitPathSegment

```ts
/** Insert a knot using de Casteljau subdivision; retain editable curve commands. */
export function splitPathSegment(commands: readonly PathCommand[], index: number, t = .5): PathCommand[];
```

## combinePaths

```ts
function combinePaths(a: readonly PathCommand[], b: readonly PathCommand[], operation: PathBooleanOperation): PathCommand[];
```

## pathBounds

```ts
function pathBounds(commands: readonly PathCommand[]): { left: number; top: number; right: number; bottom: number; width: number; height: number; } | null;
```

## pathContains

```ts
function pathContains(commands: readonly PathCommand[], x: number, y: number): boolean;
```

## customizeBrush

```ts
function customizeBrush(base: BrushPreset, changes: Partial<Omit<BrushPreset, "dynamics">> & {
    dynamics?: Partial<BrushPreset["dynamics"]>;
}): BrushPreset;
```

## brushTipFromFunction

```ts
function brushTipFromFunction(width: number, height: number, sample: (x: number, y: number) => number, options: {
    angle?: number;
    rotationMode?: "fixed" | "stroke" | "stylus";
} = {}): BrushTip;
```

## importBrushResource

```ts
async function importBrushResource(path: string, options: ImportOptions): Promise<BrushImportReport>;
```

## importBrushResourceBuffer

```ts
async function importBrushResourceBuffer(data: Buffer, name: string, options: ImportOptions): Promise<BrushImportReport>;
```

## brushFromResource

```ts
/** Explicitly reauthor a resource for this engine; never promises source-application parity. */
export function brushFromResource(resource: BrushResource, settings: Omit<BrushPreset, "tip">): BrushPreset;
```

## renderBrushSwatch

```ts
async function renderBrushSwatch(brush: BrushPreset, options: {
    color?: string;
    background?: string;
} = {}): Promise<Buffer>;
```

## createPixels

```ts
function createPixels(width: number, height: number): PixelBuffer;
```

## readPixelRegion

```ts
function readPixelRegion(image: PixelBuffer, region: PixelRegion): PixelBuffer;
```

## writePixelRegion

```ts
function writePixelRegion(image: PixelBuffer, x: number, y: number, patch: PixelBuffer): void;
```

## decodePixels

```ts
async function decodePixels(bytes: Uint8Array): Promise<PixelBuffer>;
```

## encodePixels

```ts
async function encodePixels(image: PixelBuffer): Promise<Buffer>;
```

## comparePixels

```ts
/** Compare visible premultiplied RGBA, ignoring hidden RGB under zero alpha. */
export function comparePixels(before: PixelBuffer, after: PixelBuffer, options: {
    threshold?: number;
} = {}): PixelComparison;
```

## polygonPixelSelection

```ts
function polygonPixelSelection(width: number, height: number, points: Pick<Point, "x" | "y">[], fillRule: "nonzero" | "evenodd" = "nonzero"): PixelSelection;
```

## colorPixelSelection

```ts
/** Four-connected flood or all matching pixels, measured in premultiplied RGBA byte units. */
export function colorPixelSelection(image: PixelBuffer, x: number, y: number, options: {
    tolerance?: number;
    contiguous?: boolean;
} = {}): PixelSelection;
```

## combinePixelSelections

```ts
function combinePixelSelections(a: PixelSelection, b: PixelSelection, operation: "union" | "intersect" | "subtract"): PixelSelection;
```

## invertPixelSelection

```ts
function invertPixelSelection(selection: PixelSelection): PixelSelection;
```

## featherPixelSelection

```ts
/** Gaussian coverage feathering in source-pixel units; boundary samples repeat edge coverage. */
export async function featherPixelSelection(selection: PixelSelection, sigma: number): Promise<PixelSelection>;
```

## fillPixels

```ts
/** Apply coverage without flattening the source surface or its later paint strokes. */
export function fillPixels(image: PixelBuffer, color: PixelColor, options: {
    selection?: PixelSelection;
    mode?: "source-over" | "copy" | "destination-out" | "source-atop";
} = {}): void;
```

## multiplyMatrices

```ts
/** Composition A × B applies B first, then A. */
export function multiplyMatrices(left: readonly number[], right: readonly number[]): AffineMatrix;
```

## matrixFromTransform

```ts
function matrixFromTransform(value: Partial<Transform>, pivot: Pivot = { x: 0, y: 0 }): AffineMatrix;
```

## invertMatrix

```ts
function invertMatrix(value: readonly number[]): AffineMatrix;
```

## transformPoint

```ts
function transformPoint(value: readonly number[], point: Pick<Point, "x" | "y">): {
    x: number;
    y: number;
};
```

## solveTwoBoneIK

```ts
function solveTwoBoneIK(origin: {
    x: number;
    y: number;
}, target: {
    x: number;
    y: number;
}, upperLength: number, lowerLength: number, bend: 1 | -1 = 1): TwoBoneSolution;
```
