# Rendering and export API

Render functions return image bytes or canvases; write returned PNG bytes with `writeFile`. Movie export requires FFmpeg. See [review](../../workflow/review.md) and [export](../../delivery/export.md).

Use the signatures below to check arguments and return types. A value after `=` is the default; `?` marks an optional input. Named data shapes are listed in [API types](types.md).

## renderPanelCanvas

```ts
function renderPanelCanvas(source: PanelRenderSource, panelId: string, options: {
    annotations?: boolean;
    frame?: number;
    camera?: boolean;
    layerIds?: readonly string[];
    cache?: RenderCache;
    meshPoses?: ReadonlyMap<string, IndexedMeshWarp>;
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

## createShotRenderSession

```ts
function createShotRenderSession(animation: ShotAnimation, options: ShotRenderOptions = {}): {
    durationFrames: number;
    frameRate: { numerator: number; denominator: number; };
    canvas: { background: string; width: number; height: number; };
    frame: (position: number) => Canvas;
    png: (position: number) => Promise<Buffer<ArrayBufferLike>>;
};
```

## renderShotFramePNG

```ts
async function renderShotFramePNG(animation: ShotAnimation, frame: number, options: ShotRenderOptions = {}): Promise<Buffer>;
```

## inspectProjectFonts

```ts
/** Inspect every text element, including hidden layers, drawings and component sources. */
export function inspectProjectFonts(source: RenderSource): FontInspection;
```

## inspectShotFonts

```ts
/** Report declared family availability and the backend's actual families for this shot's text. */
export function inspectShotFonts(animation: ShotAnimation): FontInspection;
```

## createEditorialRenderSession

```ts
function createEditorialRenderSession(sequence: EditorialSequence, animations: readonly ShotAnimation[]): {
    durationFrames: number;
    frameRate: { numerator: number; denominator: number; };
    resolve: (frame: number) => ResolvedEditorialFrame;
    frame: (position: number) => Canvas;
    png: (position: number) => Promise<Buffer<ArrayBufferLike>>;
};
```

## renderEditorialFramePNG

```ts
async function renderEditorialFramePNG(sequence: EditorialSequence, animations: readonly ShotAnimation[], frame: number): Promise<Buffer>;
```

## renderCompositionGuides

```ts
async function renderCompositionGuides(source: RenderSource, panelId: string, options: CompositionGuides = {}): Promise<Buffer>;
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

## renderContactSheet

```ts
async function renderContactSheet(source: RenderSource, options: {
    columns?: number;
    thumbnailWidth?: number;
    panelIds?: readonly string[];
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

## renderOnionSkin

```ts
async function renderOnionSkin(source: RenderSource, samples: readonly OnionSkinSample[], options: {
    opacity?: number;
    camera?: boolean;
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

## rescaleLipSync

```ts
/** Convert cue and correction clocks together without changing drawing assignments. */
export function rescaleLipSync(input: LipSyncOptions, timing: LipSyncTimingOptions): {
    options: LipSyncOptions;
    report: {
        rounding: TimeRounding;
        positions: number;
        quantizedPositions: number;
    };
};
```

## compileLipSync

```ts
/** Bake frame-addressed mouth cues into editable holds; explicit corrections take precedence. */
export function compileLipSync(input: LipSyncOptions): DrawingExposure[];
```

## exportStoryboard

```ts
async function exportStoryboard(source: RenderSource, outputDir: string, sheet: SheetOptions = {}): Promise<{
    panelFiles: string[];
    pdfFile: string;
    pageCount: number;
}>;
```

## exportReview

```ts
/** Render one saved snapshot; manifest.json is published only after every PNG succeeds. */
export async function exportReview(projectPath: string, outputRoot: string, options: ReviewExportOptions): Promise<{
    directory: string;
    manifestFile: string;
    manifest: ReviewManifest;
}>;
```

## readReviewManifest

```ts
/** Validate exported review metadata; hashes bind bytes, not reviewer identity or artistic approval. */
export function readReviewManifest(input: unknown): ReviewManifest;
```

## verifyReviewExport

```ts
/** Verify review evidence without reopening or modifying its source project. */
export async function verifyReviewExport(directory: string, options: {
    decode?: boolean;
    signal?: AbortSignal;
} = {}): Promise<{ directory: string; manifest: ReviewManifest; manifestSha256: string; verified: number; decoded: number; bytes: number; }>;
```

## readReviewDecision

```ts
/** Read an unsigned, checksummed decision record; this does not verify its evidence files. */
export function readReviewDecision(input: unknown): ReviewDecision;
```

## createReviewDecision

```ts
/** Bind an explicit caller decision to a verified package; does not infer approval or change project status. */
export async function createReviewDecision(directory: string, input: ReviewDecisionInput): Promise<ReviewDecision>;
```

## verifyReviewDecision

```ts
/** Recheck decision checksum, manifest binding and file hashes before consuming a saved decision. */
export async function verifyReviewDecision(directory: string, input: unknown, options: ReviewDecisionVerifyOptions = {}): Promise<{ decision: ReviewDecision; verification: { directory: string; manifest: ReviewManifest; manifestSha256: string; verified: number; decoded: number; bytes: number; }; source?: undefined; } | { decision: ReviewDecision; verification: { directory: string; manifest: ReviewManifest; manifestSha256: string; verified: number; decoded: number; bytes: number; }; source: { revision?: string | undefined; projectId: string; version: number; documentHash: string; }; }>;
```

## publishProject

```ts
/** Publish a complete pinned native container; manifest.json is the completion marker. */
export async function publishProject(projectPath: string, outputRoot: string, options: PublishProjectOptions): Promise<{ directory: string; projectFile: string; manifest: ProjectPublishManifest; manifestHash: string; }>;
```

## verifyProjectPublish

```ts
/** Verify bytes, native integrity and source identity. Fonts and renderer dependencies are not installed. */
export async function verifyProjectPublish(directory: string, options: {
    expectedManifestHash?: string;
    signal?: AbortSignal;
} = {}): Promise<{ directory: string; projectFile: string; manifest: ProjectPublishManifest; manifestHash: string; runtimeMatches: boolean; }>;
```

## exportShotProject

```ts
/** Publish a single-shot native project at a new path, using pinned embedded media. */
export async function exportShotProject(sourcePath: string, animationId: string, destination: string, options: CopyProjectOptions & ShotSubsetOptions): Promise<{ animationId: string; source: { projectId: string; version: number; documentHash: string; }; dependencyHash: string; externalFonts: string[]; projectId: string; version: number; documentHash: string; path: string; }>;
```

## parseProjectPublishManifest

```ts
function parseProjectPublishManifest(input: unknown): ProjectPublishManifest;
```

## exportAnimaticPackage

```ts
async function exportAnimaticPackage(source: RenderSource, outputDir: string, options: {
    assetRoot?: string;
    maxFrames?: number;
    signal?: AbortSignal;
} = {}): Promise<AnimaticPackageResult>;
```

## exportMovie

```ts
async function exportMovie(source: RenderSource, output: string, options: MovieOptions = {}): Promise<{ file: string; frames: number; seconds: number; renderSeconds: number; peakRssBytes: number; }>;
```

## exportShotMovie

```ts
/** Export a frozen shot with an explicit mix/omission policy when audio is authored. */
export async function exportShotMovie(animation: ShotAnimation, output: string, options: StudioMovieOptions = {}): Promise<{ audio: { mode: "omitted"; sampleRate?: undefined; samples?: undefined; range?: undefined; peak?: undefined; clippedSamples?: undefined; }; range: { startFrame: number; endFrame: number; }; file: string; frames: number; seconds: number; renderSeconds: number; peakRssBytes: number; } | { range: { startFrame: number; endFrame: number; }; audio: { mode: "mixed"; sampleRate: number; samples: number; range: { startSample: number; endSample: number; }; peak: number; clippedSamples: number; }; file: string; frames: number; seconds: number; renderSeconds: number; peakRssBytes: number; }>;
```

## exportEditorialMovie

```ts
async function exportEditorialMovie(sequence: EditorialSequence, animations: readonly ShotAnimation[], output: string, options: StudioMovieOptions = {}): Promise<{ audio: { mode: "omitted"; sampleRate?: undefined; samples?: undefined; range?: undefined; peak?: undefined; clippedSamples?: undefined; }; range: { startFrame: number; endFrame: number; }; file: string; frames: number; seconds: number; renderSeconds: number; peakRssBytes: number; } | { range: { startFrame: number; endFrame: number; }; audio: { mode: "mixed"; sampleRate: number; samples: number; range: { startSample: number; endSample: number; }; peak: number; clippedSamples: number; }; file: string; frames: number; seconds: number; renderSeconds: number; peakRssBytes: number; }>;
```

## exportAudioStems

```ts
/** Export aligned WAV stems into a new directory; stems.json is the completion marker. */
export async function exportAudioStems(target: AudioStemTarget, decoder: StudioAudioDecoder, output: string, options: AudioStemExportOptions): Promise<{ directory: string; manifestFile: string; manifest: AudioStemManifest; }>;
```

## createFrameJob

```ts
/** Define a new job against saved source content; keep that source or a matching copy available. */
export function createFrameJob(sourcePath: string, jobPath: string, options: FrameJobOptions): {
    file: string;
    manifest: FrameJobManifest;
};
```

## runFrameJob

```ts
/** Persist each PNG and checksum atomically; retries verify and skip already stored frames. */
export async function runFrameJob(jobPath: string, options: RunFrameJobOptions = {}): Promise<{ completed: number; total: number; bytes: number; complete: boolean; file: string; rendered: number; reused: number; }>;
```

## inspectFrameJob

```ts
function inspectFrameJob(jobPath: string): {
    completed: number;
    total: number;
    bytes: number;
    complete: boolean;
    file: string;
    manifest: FrameJobManifest;
};
```

## readFrameJobFrame

```ts
function readFrameJobFrame(jobPath: string, frame: number): Buffer;
```

## exportFrameJobMovie

```ts
/** Encode completed job PNGs without rerendering, with the normal studio audio policy. */
export async function exportFrameJobMovie(jobPath: string, output: string, options: FrameJobMovieOptions = {}): Promise<{ job: string; source: { path: string; projectId: string; version: number; documentHash: string; }; audio: { mode: "omitted"; sampleRate?: undefined; samples?: undefined; range?: undefined; peak?: undefined; clippedSamples?: undefined; }; range: { startFrame: number; endFrame: number; }; file: string; frames: number; seconds: number; renderSeconds: number; peakRssBytes: number; } | { job: string; source: { path: string; projectId: string; version: number; documentHash: string; }; range: { startFrame: number; endFrame: number; }; audio: { mode: "mixed"; sampleRate: number; samples: number; range: { startSample: number; endSample: number; }; peak: number; clippedSamples: number; }; file: string; frames: number; seconds: number; renderSeconds: number; peakRssBytes: number; }>;
```

## exportFrameJobSequence

```ts
/** Publish verified stored PNGs and a completion manifest without rerendering. */
export async function exportFrameJobSequence(jobPath: string, outputDir: string, options: FrameJobSequenceOptions = {}): Promise<{ directory: string; manifestFile: string; frameCount: number; bytes: number; range: { startFrame: number; endFrame: number; }; frameRate: { numerator: number; denominator: number; }; }>;
```

## verifyFrameSequence

```ts
/** Check package records/hashes, optionally decode PNGs, without accessing source paths. */
export async function verifyFrameSequence(directory: string, options: VerifyFrameSequenceOptions = {}): Promise<{ images?: { decoded: number; transparentFrames: number; opaqueFrames: number; width: number; height: number; } | undefined; directory: string; manifest: { source: FrameJobManifest; format: "codeboard-frame-sequence/1"; frameCount: number; framePattern: "frames/%06d.png"; startNumber: 0; bytes: number; checksums: { file: "frames.jsonl"; bytes: number; sha256: string; }; }; verified: number; bytes: number; }>;
```

## verifyFrameJob

```ts
/** Verify all stored frame hashes in one read snapshot, including incomplete jobs. */
export async function verifyFrameJob(jobPath: string, options: VerifyFrameJobOptions = {}): Promise<{ verified: number; missing: number; completed: number; total: number; bytes: number; complete: boolean; file: string; manifest: FrameJobManifest; }>;
```

## parseAudioStemManifest

```ts
function parseAudioStemManifest(input: unknown): AudioStemManifest;
```

## verifyAudioStems

```ts
/** Validate package metadata and stream file hashes; this does not decode or audition WAVs. */
export async function verifyAudioStems(directory: string, options: {
    signal?: AbortSignal;
} = {}): Promise<{ directory: string; manifest: AudioStemManifest; }>;
```

## encodeWav

```ts
function encodeWav(channels: Float32Array[], sampleRate = 48000, options: WavEncodingOptions = {}): Buffer;
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
