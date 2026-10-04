# Rendering and export API

Render functions return image bytes or canvases; write returned PNG bytes with `writeFile`. Movie export requires FFmpeg. See [review](review.md) and [export](export.md).

Parameter declarations below are extracted from the current source. A value after `=` is the default; `?` marks an optional input. Named data shapes are listed in [API types](api-types.md).

## renderPanelCanvas

```ts
function renderPanelCanvas(source: PanelRenderSource, panelId: string, options: {
    annotations?: boolean;
    frame?: number;
    camera?: boolean;
    layerIds?: readonly string[];
    cache?: RenderCache;
} = {}): Canvas;
```

## renderPanelPNG

```ts
async function renderPanelPNG(source: RenderSource, panelId: string, options: {
    annotations?: boolean;
    frame?: number;
    camera?: boolean;
    layerIds?: readonly string[];
} = {}): Promise<Buffer>;
```

## renderFrameCanvas

```ts
function renderFrameCanvas(source: RenderSource, frame: number, options: {
    annotations?: boolean;
    cache?: RenderCache;
} = {}): Canvas;
```

## renderFramePNG

```ts
async function renderFramePNG(source: RenderSource, frame: number, options: {
    annotations?: boolean;
} = {}): Promise<Buffer>;
```

## createRenderSession

```ts
/** A frozen document snapshot with bounded artwork cache; create another session after edits. */
export function createRenderSession(source: RenderSource, maxCacheBytes?: number): {
    durationFrames: number;
    frame: (frame: number) => Canvas;
    panel: (id: string, frame?: number) => Canvas;
};
```

## renderCompositionGuides

```ts
async function renderCompositionGuides(source: RenderSource, panelId: string, options: CompositionGuides = {}): Promise<Buffer>;
```

## renderContactSheet

```ts
async function renderContactSheet(source: RenderSource, options: {
    columns?: number;
    thumbnailWidth?: number;
    panelIds?: readonly string[];
} = {}): Promise<Buffer>;
```

## renderDetail

```ts
async function renderDetail(source: RenderSource, panelId: string, crop: {
    x: number;
    y: number;
    width: number;
    height: number;
}, frame?: number): Promise<Buffer>;
```

## renderOnionSkin

```ts
async function renderOnionSkin(source: RenderSource, samples: readonly OnionSkinSample[], options: {
    opacity?: number;
    camera?: boolean;
} = {}): Promise<Buffer>;
```

## renderFrameSheet

```ts
/** Timeline samples in caller order, including drawing substitutions and shot transitions. */
export async function renderFrameSheet(source: RenderSource, frames: readonly number[], options: {
    columns?: number;
    thumbnailWidth?: number;
} = {}): Promise<Buffer>;
```

## evaluateDrawing

```ts
/** Undefined is an ordinary group; null is a blank exposure. Keys are sorted on authoring. */
export function evaluateDrawing(sequence: readonly DrawingExposure[] | undefined, frame: number): string | null | undefined;
```

## evaluateLayer

```ts
function evaluateLayer(layer: Layer, frame: number): EvaluatedLayerState;
```

## evaluateCamera

```ts
function evaluateCamera(keyframes: readonly CameraKeyframe[], frame: number): EvaluatedCamera;
```

## exportStoryboard

```ts
async function exportStoryboard(source: RenderSource, outputDir: string, sheet: SheetOptions = {}): Promise<{
    panelFiles: string[];
    pdfFile: string;
    pageCount: number;
}>;
```

## exportAnimaticPackage

```ts
async function exportAnimaticPackage(source: RenderSource, outputDir: string, options: {
    assetRoot?: string;
    maxFrames?: number;
} = {}): Promise<AnimaticPackageResult>;
```

## exportMovie

```ts
async function exportMovie(source: RenderSource, output: string, options: MovieOptions = {}): Promise<{ file: string; frames: number; seconds: number; renderSeconds: number; peakRssBytes: number; }>;
```

## encodeWav

```ts
function encodeWav(channels: Float32Array[], sampleRate = 48000): Buffer;
```

## createToneWav

```ts
function createToneWav(options: ToneOptions = {}): Buffer;
```

## startPreview

```ts
/** Read-only local review endpoints. Authoring remains in the JS/TS API. */
export async function startPreview(projectPath: string, options: {
    port?: number;
} = {}): Promise<Server>;
```
