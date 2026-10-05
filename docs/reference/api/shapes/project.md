# Project types

Data shapes for project. See [all type groups](../types.md) for other domains and shared units. Import public types from `codeboard-studio`; helper shapes are included to explain nested values.

## StoryboardDocument

```ts
export interface StoryboardDocument {
    components: DrawingComponent[];
    schemaVersion: 5;
    studio: StudioContent;
    version: number;
    id: Id;
    title: string;
    author?: string;
    createdAt: string;
    updatedAt: string;
    canvas: {
        width: number;
        height: number;
        background: string;
    };
    seed: number;
    frameRate: number;
    idCounter: number;
    scenes: Scene[];
    sequences: Sequence[];
    shots: Shot[];
    panels: Panel[];
    brushes: BrushPreset[];
    assets: Asset[];
    audioTracks: AudioTrack[];
    comments: ReviewComment[];
    locks: ProjectLock[];
    changes: ChangeEntry[];
    metadata: Record<string, string>;
}
```

## ProjectOptions

```ts
export interface ProjectOptions {
    id?: Id;
    title: string;
    author?: string;
    width?: number;
    height?: number;
    background?: string;
    seed?: number;
    frameRate?: number;
}
```

## ProjectChanges

```ts
export interface ProjectChanges {
    title?: string;
    author?: string | null;
    seed?: number;
    frameRate?: {
        value: number;
        timing: "preserve-frames" | "preserve-seconds";
    };
    canvas?: {
        width?: number;
        height?: number;
        background?: string;
        /** Existing artwork coordinates stay unchanged in either mode. */
        applyTo?: "new-panels" | "all-panels";
    };
}
```

## ProjectMigrationReport

```ts
export interface ProjectMigrationReport {
    format: "codeboard-project-migration/1";
    source: string;
    target: string;
    sourceContainerVersion: number;
    targetSchemaVersion: number;
    version: number;
    documentHash: string;
    snapshotHash: string;
    preserved: {
        projectId: string;
        boardTiming: true;
        artworkIds: true;
        embeddedAssets: number;
    };
    warnings: string[];
}
```

## PanelCaptureResult

```ts
export interface PanelCaptureResult {
    animationId: string;
    source: {
        projectId: string;
        version: number;
        panelId: string;
        panelRevision: number;
        startFrame: number;
        durationFrames: number;
        captureStartFrame: number;
        captureDurationFrames: number;
    };
    identities: {
        sourceId: string;
        capturedId: string;
    }[];
}
```

## PanelCaptureOptions

```ts
export interface PanelCaptureOptions {
    id: string;
    name?: string;
    preRollFrames?: number;
    postRollFrames?: number;
}
```

## CoordinateSpace

```ts
export interface CoordinateSpace extends ArtworkCoordinateSpace {
    panelId: string;
}
```

## MutationOptions

```ts
export interface MutationOptions {
    expectedVersion?: number;
}
```

## ShotDuplicateOptions

```ts
export interface ShotDuplicateOptions {
    id: string;
    shotId: string;
    name?: string;
}
```

## ShotDuplicateResult

```ts
export interface ShotDuplicateResult {
    animationId: string;
    sourceAnimationId: string;
    identities: {
        sourceId: string;
        copyId: string;
    }[];
}
```
