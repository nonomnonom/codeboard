# Project and artwork API

Create documents, address stable IDs, and edit individual layers or elements. Start with [the demo walkthrough](code-board-demo.md) for an executable project.

Parameter declarations below are extracted from the current source. A value after `=` is the default; `?` marks an optional input. Named data shapes are listed in [API types](api-types.md).

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

### readAsset

```ts
readAsset(id: string): Buffer;
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

### select

```ts
select(query: {
    panelId: Id;
    layerId?: Id;
    elementIds?: Id[];
}): Selection;
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
