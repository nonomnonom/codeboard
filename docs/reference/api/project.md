# Project and artwork API

Create documents, address stable IDs, and edit individual layers or elements. Read [project concepts](../../start/project-model.md) for ownership and [the quickstart](../../start/first-drawing.md) for a minimal executable operation.

Use the signatures below to check arguments and return types. A value after `=` is the default; `?` marks an optional input. Named data shapes are listed in [API types](types.md).

## StoryboardProject

### create

```ts
static create(options: ProjectOptions): StoryboardProject;
```

### fromJSON

```ts
static fromJSON(input: unknown, options: {
    actor?: string;
} = {}): StoryboardProject;
```

### open

```ts
static async open(path: string, options: {
    actor?: string;
} = {}): Promise<StoryboardProject>;
```

### id

```ts
get id(): string;
```

### title

```ts
get title(): string;
```

### canUndo

```ts
get canUndo(): boolean;
```

### canRedo

```ts
get canRedo(): boolean;
```

### version

```ts
get version(): number;
```

### toJSON

```ts
toJSON(): StoryboardDocument;
```

### previewComponentUpgrade

```ts
previewComponentUpgrade(instanceId: string, options: ComponentUpgradeOptions = {}): {
    conflicts: ValueMergeConflict[];
    incomingChanges: string[];
    retainedLocalChanges: string[];
    version: number;
    instanceId: string;
    sourceVersion: number;
    owner: { kind: "panel" | "animation"; id: string; };
    inputHash: string;
    conflictsResolved: boolean;
};
```

### componentOriginData

```ts
componentOriginData(instanceId: string, options: PageOptions = {}): {
    version: number;
    instanceId: string;
    componentId: string;
    baselineVersion: number;
    sha256: string;
    instanceState: "missing" | "detached" | "matching" | "stale";
    instanceSource: { id: Id; version: number; } | null;
    libraryVersion: number | null;
    offset: number;
    limit: number;
    total: number;
    nextOffset: number | null;
    items: { location: "missing" | "instance" | "elsewhere"; sourceId: string; copyId: string; }[];
};
```

### shotDependencyData

```ts
shotDependencyData(animationId: string, options: PageOptions = {}): {
    version: number;
    animationId: string;
    dependencyHash: string;
    total: number;
    offset: number;
    limit: number;
    nextOffset: number | null;
    items: ShotDependency[];
};
```

### studio

```ts
get studio(): import("../model/types/studio.js").StudioContent;
```

### boardPanels

```ts
boardPanels(options: PageOptions = {}): { id: string; shotId: string; startFrame: number; durationFrames: number; transition: Transition; width: number; height: number; revision: number; }[];
```

### shotAnimation

```ts
shotAnimation(id: string): ShotAnimation;
```

### editorialSequence

```ts
editorialSequence(id: string): EditorialSequence;
```

### shotCoordinates

```ts
shotCoordinates(animationId: string, targetId: string, options: CoordinateOptions = {}): ShotCoordinateSpace;
```

### shotControllerData

```ts
shotControllerData(animationId: string, controllerId: string, query: ShotControllerQuery = { collection: "keyframes" }): { collection: "targets" | "keyframes"; total: number; nextOffset: number | null; items: { frame: number; weight: number; easing: Easing; index: number; }[]; animationId: string; controllerId: string; name: string; mode: "replace" | "additive"; stackIndex: number; staticWeight: number; activeRange: { startFrame: number; endFrame: number; } | null; frame: number | null; evaluatedWeight: number | null; counts: { targets: number; keyframes: number; }; offset: number; limit: number; } | { collection: "targets" | "keyframes"; total: number; nextOffset: number | null; items: { evaluatedState: EvaluatedLayerState | null; layerId: string; values: Partial<Record<LayerChannel, number>>; index: number; }[]; animationId: string; controllerId: string; name: string; mode: "replace" | "additive"; stackIndex: number; staticWeight: number; activeRange: { startFrame: number; endFrame: number; } | null; frame: number | null; evaluatedWeight: number | null; counts: { targets: number; keyframes: number; }; offset: number; limit: number; };
```

### shotMeshData

```ts
shotMeshData(animationId: string, layerId: string, query: ShotMeshQuery = { collection: "keyframes" }): { animationId: string; layerId: string; bindingKind: "skin" | "mesh" | "curve" | "envelope"; curveRest: CurveMeshPose | null; curveSegments: number | null; envelopeRest: EnvelopeMeshPose | null; envelopeGrid: { columns: number; rows: number; } | null; collection: "joints"; offset: number; limit: number; total: number; nextOffset: number | null; counts: { joints: number; weights: number; vertices: number; triangles: number; keyframes: number; }; items: { layerId: string; id: string; bind: Readonly<AffineMatrix>; index: number; }[]; } | { animationId: string; layerId: string; bindingKind: "skin" | "mesh" | "curve" | "envelope"; curveRest: CurveMeshPose | null; curveSegments: number | null; envelopeRest: EnvelopeMeshPose | null; envelopeGrid: { columns: number; rows: number; } | null; collection: "weights"; offset: number; limit: number; total: number; nextOffset: number | null; counts: { joints: number; weights: number; vertices: number; triangles: number; keyframes: number; }; items: { index: number; influences: readonly { jointId: string; weight: number; }[]; }[]; } | { animationId: string; layerId: string; bindingKind: "skin" | "mesh" | "curve" | "envelope"; curveRest: CurveMeshPose | null; curveSegments: number | null; envelopeRest: EnvelopeMeshPose | null; envelopeGrid: { columns: number; rows: number; } | null; collection: "triangles"; offset: number; limit: number; total: number; nextOffset: number | null; counts: { joints: number; weights: number; vertices: number; triangles: number; keyframes: number; }; items: { index: number; vertices: number[]; }[]; } | { animationId: string; layerId: string; bindingKind: "skin" | "mesh" | "curve" | "envelope"; curveRest: CurveMeshPose | null; curveSegments: number | null; envelopeRest: EnvelopeMeshPose | null; envelopeGrid: { columns: number; rows: number; } | null; collection: "keyframes"; offset: number; limit: number; total: number; nextOffset: number | null; counts: { joints: number; weights: number; vertices: number; triangles: number; keyframes: number; }; items: { index: number; frame: number; easing: Easing; }[]; } | { frame: number | null; animationId: string; layerId: string; bindingKind: "skin" | "mesh" | "curve" | "envelope"; curveRest: CurveMeshPose | null; curveSegments: number | null; envelopeRest: EnvelopeMeshPose | null; envelopeGrid: { columns: number; rows: number; } | null; collection: "vertices"; offset: number; limit: number; total: number; nextOffset: number | null; counts: { joints: number; weights: number; vertices: number; triangles: number; keyframes: number; }; items: { x: number; y: number; index: number; }[]; };
```

### shotPointCoordinates

```ts
shotPointCoordinates(animationId: string, targetId: string, point: {
    x: number;
    y: number;
}, options: ShotPointOptions): {
    animationId: string;
    targetId: string;
    frame: number;
    direction: "localToFrame" | "frameToLocal";
    candidates: ShotPointCandidate[];
};
```

### editorialClips

```ts
editorialClips(sequenceId: string, options: PageOptions = {}): EditorialClip[];
```

### scriptSummary

```ts
scriptSummary(): { id: string; title: string; revision: number; entryCount: number; } | null;
```

### palettes

```ts
palettes(options: PageOptions = {}): { id: string; name: string; swatchCount: number; }[];
```

### paletteSwatches

```ts
paletteSwatches(id: string, options: PageOptions = {}): PaletteSwatch[];
```

### paletteBindings

```ts
paletteBindings(swatchId: string, options: PageOptions = {}): PaletteBindingUsage[];
```

### putPalette

```ts
putPalette(palette: Palette): this;
```

### removePalette

```ts
removePalette(id: string): this;
```

### setColorBinding

```ts
setColorBinding(elementId: string, channel: ColorChannel, binding: ColorBinding | null): this;
```

### scriptEntries

```ts
scriptEntries(options: PageOptions = {}): ScriptEntry[];
```

### replaceScript

```ts
replaceScript(input: ScriptInput, expectedRevision: number): ScriptChangeReport;
```

### shotBoardPanels

```ts
shotBoardPanels(animationId: string, options: PageOptions = {}): { id: Id; shotId: Id; number: string; title: string; width: number; height: number; durationFrames: number; startFrame: number; transition: Transition; status: "working" | "review" | "approved"; action: string; dialogue: string; camera: string; notes: string; revision: number; }[];
```

### studioAudioTracks

```ts
studioAudioTracks(ownerId: string, options: PageOptions = {}): { clipCount: number; id: string; name: string; muted: boolean; }[];
```

### studioAudioClips

```ts
studioAudioClips(ownerId: string, trackId: string, options: PageOptions = {}): StudioAudioClip[];
```

### addShotElement

```ts
addShotElement(animationId: string, layerId: string, element: DrawingElement): this;
```

### removeShotElements

```ts
removeShotElements(animationId: string, layerId: string, ids: readonly string[]): this;
```

### reviseShotElement

```ts
reviseShotElement(animationId: string, layerId: string, id: string, element: DrawingElement): this;
```

### patchShotPixels

```ts
patchShotPixels(animationId: string, layerId: string, id: string, x: number, y: number, patch: import("../model/types.js").PixelBuffer): this;
```

### setStudio

```ts
setStudio(content: import("../model/types/studio.js").StudioContent): this;
```

### capturePanelAnimation

```ts
capturePanelAnimation(panelId: string, options: PanelCaptureOptions): PanelCaptureResult;
```

### duplicateShotAnimation

```ts
duplicateShotAnimation(sourceAnimationId: string, options: ShotDuplicateOptions): ShotDuplicateResult;
```

### instantiateShotCharacter

```ts
instantiateShotCharacter(sourceAnimationId: string, options: CharacterInstanceOptions): CharacterInstanceResult;
```

### editShotAnimation

```ts
editShotAnimation(id: string, edits: readonly import("../model/types/shot.js").ShotAnimationEdit[]): this;
```

### putShotAnimation

```ts
putShotAnimation(animation: ShotAnimation): this;
```

### putEditorialSequence

```ts
putEditorialSequence(sequence: EditorialSequence): this;
```

### editStudioAudio

```ts
editStudioAudio(ownerId: string, edits: readonly import("../model/types/studio-audio.js").StudioAudioEdit[]): this;
```

### setStudioAudio

```ts
setStudioAudio(ownerId: string, tracks: readonly import("../model/types/studio-audio.js").StudioAudioTrack[]): this;
```

### editEditorial

```ts
editEditorial(id: string, edits: readonly EditorialEdit[]): this;
```

### removeShotAnimation

```ts
removeShotAnimation(id: string): this;
```

### removeEditorialSequence

```ts
removeEditorialSequence(id: string): this;
```

### plan

```ts
/** Validate serializable changes on an isolated draft, without changing this session. */
plan(label: string, commands: EditCommand[]): EditPlan;
```

### commit

```ts
/** Atomically save a plan and its receipt to this session's existing .cboard. */
async commit(input: EditPlan, options: {
    requestId: string;
}): Promise<CommitResult>;
```

### readAsset

```ts
readAsset(id: string): Buffer;
```

### captureAssetReader

```ts
/** Capture the saved media source independently of later session saves or Save As. */
captureAssetReader(): (id: string) => Buffer;
```

### save

```ts
async save(path: string, options: {
    overwrite?: boolean;
    expectedVersion?: number;
    assetRoot?: string;
} = {}): Promise<void>;
```

### transaction

```ts
transaction<T>(label: string, work: () => T): T;
```

### undo

```ts
undo(): boolean;
```

### redo

```ts
redo(): boolean;
```

### setMetadata

```ts
setMetadata(key: string, value: string): this;
```

### configure

```ts
configure(changes: ProjectChanges): this;
```

### addScene

```ts
addScene(name: string, id?: Id): SceneHandle;
```

### addSequence

```ts
addSequence(name: string, id?: Id): SequenceHandle;
```

### scene

```ts
scene(id: Id): SceneHandle;
```

### panel

```ts
panel(id: Id): PanelHandle;
```

### panelCaptions

```ts
panelCaptions(id: Id): {
    id: string;
    title: string;
    action: string;
    dialogue: string;
    camera: string;
    notes: string;
};
```

### select

```ts
select(query: {
    panelId: Id;
    layerId?: Id;
    elementIds?: Id[];
}): Selection;
```

## migrateProject

```ts
/** Copy the current saved document; never replaces a source or existing destination. */
export async function migrateProject(sourcePath: string, targetPath: string, options: {
    expectedVersion?: number;
} = {}): Promise<ProjectMigrationReport>;
```

## SequenceHandle

### addScene

```ts
addScene(name: string, id?: Id): SceneHandle;
```

## SceneHandle

### addShot

```ts
addShot(name: string, id?: Id): ShotHandle;
```

## ShotHandle

### addPanel

```ts
addPanel(options: PanelOptions = {}): PanelHandle;
```

## PanelHandle

### addRasterLayer

```ts
addRasterLayer(name: string, options: LayerOptions = {}, parentGroupId?: Id): LayerHandle;
```

### addVectorLayer

```ts
addVectorLayer(name: string, options: LayerOptions = {}, parentGroupId?: Id): LayerHandle;
```

### addGroup

```ts
addGroup(name: string, options: LayerOptions = {}, parentGroupId?: Id): LayerHandle;
```

### addMotion

```ts
addMotion(label: string, from: Point, to: Point, color = "#d14a32", id?: Id): Id;
```

### revise

```ts
revise(changes: Partial<Pick<Panel, "title" | "durationFrames" | "action" | "dialogue" | "camera" | "notes">>): this;
```

### layer

```ts
layer(id: Id): LayerHandle;
```

## LayerHandle

### scene3D

```ts
scene3D(scene: Scene3D, options: Partial<Pick<Scene3DElement, "id" | "name" | "matrix" | "opacity" | "visible">> = {}): Id;
```

### rasterSurface

```ts
rasterSurface(image: PixelBuffer, options: Partial<Pick<RasterSurface, "id" | "name" | "matrix" | "opacity" | "visible">> = {}): Id;
```

### readPixels

```ts
readPixels(elementId: Id, region?: PixelRegion): PixelBuffer;
```

### editPixels

```ts
editPixels(elementId: Id, region: PixelRegion, edit: (patch: PixelBuffer) => void): this;
```

### rasterStroke

```ts
rasterStroke(points: Point[], brush: BrushPreset, options: StrokeOptions = {}): Id;
```

### erase

```ts
erase(points: Point[], brush: BrushPreset, options: Omit<StrokeOptions, "erase"> = {}): Id;
```

### vectorStroke

```ts
vectorStroke(points: Point[], options: VectorStrokeOptions = {}): Id;
```

### path

```ts
path(commands: PathCommand[], options: {
    id?: Id;
    name?: string;
    fill?: VectorFill;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
} = {}): Id;
```

### text

```ts
text(text: string, x: number, y: number, options: {
    id?: Id;
    name?: string;
    color?: string;
    font?: string;
    align?: "left" | "center" | "right";
    opacity?: number;
} = {}): Id;
```

### set

```ts
set(changes: LayerChanges): this;
```

### edit

```ts
edit(elementId: Id, updater: (element: DrawingElement) => DrawingElement): this;
```

### outlineStroke

```ts
outlineStroke(elementId: Id): this;
```

### booleanPath

```ts
booleanPath(elementId: Id, tool: readonly PathCommand[], operation: PathBooleanOperation): this;
```

## Selection

### transform

```ts
transform(transform: Partial<Transform>, options: {
    pivot?: Pivot;
} = {}): this;
```

### opacity

```ts
opacity(value: number): this;
```

### remove

```ts
remove(): void;
```

## CodeboardError

### toJSON

```ts
toJSON(): {
    code: ErrorCode;
    message: string;
    retryable: boolean;
    details: Readonly<Record<string, unknown>>;
};
```

## capabilities

```ts
/** Implementation inventory, not a production qualification or codec guarantee. */
export async function capabilities(options: {
    probeDependencies?: boolean;
    ffmpegPath?: string;
    ffprobePath?: string;
} = {}): Promise<CapabilityReport>;
```

## planDrawingElement

```ts
function planDrawingElement(element: DrawingElement): PlanDrawingElement;
```

## planShotElement

```ts
function planShotElement(element: DrawingElement): PlanDrawingElement;
```

## planShotAnimation

```ts
function planShotAnimation(input: ShotAnimation): PlanShotAnimation;
```

## planComponentSource

```ts
function planComponentSource(input: readonly Layer[]): PlanStudioLayer[];
```

## planCaptionImport

```ts
/** Prepare an atomic caption-only plan; the caller persists it and commits with a request ID. */
export function planCaptionImport(project: StoryboardProject, input: readonly CaptionImportRow[]): CaptionImportReport;
```

## importScriptCSV

```ts
/** Import explicit stable entry IDs and panel links; does not mutate a project. */
export function importScriptCSV(csv: string, options: ScriptCSVOptions): ScriptInput;
```

## exportScriptCSV

```ts
/** Export editable script fields; callers retain project/script revision separately. */
export function exportScriptCSV(input: ScriptInput | ProductionScript): string;
```

## inspectScriptFDX

```ts
/** Inspect the supported screenplay subset and every omitted element/attribute before binding IDs. */
export function inspectScriptFDX(xml: string): FDXInspection;
```

## importScriptFDX

```ts
/** Import hash-bound, explicitly identified records; project revision and panel checks apply later. */
export function importScriptFDX(xml: string, input: FDXImportOptions): {
    script: ScriptInput;
    sourceSha256: string;
    losses: FDXLoss[];
};
```

## planScriptBoard

```ts
/** Create explicitly staged panels and append their script links in the same recoverable commit. */
export function planScriptBoard(project: StoryboardProject, input: readonly ScriptBoardPanel[]): ScriptBoardReport;
```

## planBoardCapture

```ts
/** Capture every board panel and conform its frozen incoming transitions in one version-pinned plan. */
export function planBoardCapture(project: StoryboardProject, input: BoardCaptureOptions): {
    plan: EditPlan;
    source: { projectId: string; version: number; durationFrames: number; };
    sequenceId: string;
    panels: { startFrame: number; durationFrames: number; revision: number; panelId: string; animationId: string; clipId: string; }[];
    audio: { mode: "omit" | "convert"; omittedTracks: number; mappings: { sourceId: string; targetId: string; }[]; quantizedPositions: number; };
};
```

## planShotLipSync

```ts
/** Replace only the selected local-frame window of an existing shot mouth drawing track. */
export function planShotLipSync(project: StoryboardProject, animationId: string, layerId: string, options: LipSyncOptions): EditPlan;
```

## parseCaptionCSV

```ts
/** Strict CSV: commas, escaped quotes and multiline quoted fields; no inferred panel matching. */
export function parseCaptionCSV(input: string): CaptionImportRow[];
```
