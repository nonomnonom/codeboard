# Project storage API

Open a store with `ProjectStore.open(path)` and always call `close()` in `finally`. For ordinary editing, prefer `StoryboardProject.open` and `save`. See [projects and revisions](../../workflow/projects.md) for partial reads, conflict handling, and named checkpoints.

Use the signatures below to check arguments and return types. A value after `=` is the default; `?` marks an optional input. Named data shapes are listed in [API types](types.md).

## ProjectStore

### open

```ts
static open(path: string): ProjectStore;
```

### create

```ts
static create(path: string): ProjectStore;
```

### close

```ts
close(): void;
```

### [Symbol.dispose]

```ts
[Symbol.dispose](): void;
```

### readHeader

```ts
readHeader(): Header;
```

### version

```ts
get version(): number;
```

### listPanels

```ts
listPanels(): PanelInfo[];
```

### boardPanels

```ts
/** Page saved board timing without decoding panel artwork; legacy catalogs read the header. */
boardPanels(query: {
    limit?: number;
    offset?: number;
} = {}, options: {
    expectedVersion?: number;
} = {}): {
    version: number;
    indexed: boolean;
    frameRate: number;
    durationFrames: number;
    panelCount: number;
    items: { id: string; shotId: string; startFrame: number; durationFrames: number; transition: { type: "cut" | "dissolve" | "wipe-left" | "wipe-right"; durationFrames: number; }; width: number; height: number; revision: number; }[];
};
```

### editorialClips

```ts
/** Page saved editorial clips while leaving sibling shot artwork/resources encoded. */
editorialClips(sequenceId: string, query: {
    limit?: number;
    offset?: number;
} = {}, options: {
    expectedVersion?: number;
} = {}): {
    version: number;
    sequenceId: string;
    frameRate: RationalRate;
    durationFrames: number;
    clipCount: number;
    items: { id: string; animationId: string; startFrame: number; sourceInFrame: number; durationFrames: number; transition: { type: "cut" | "dissolve" | "wipe-left" | "wipe-right"; durationFrames: number; }; holdFrames?: number | undefined; }[];
};
```

### findObjects

```ts
findObjects(query: {
    panelId?: string;
    name?: string;
    kind?: string;
    limit?: number;
    offset?: number;
} = {}): Record<string, SQLOutputValue>[];
```

### query

```ts
/** Saved metadata, ordered by ID. Legacy/stale catalogs fall back without modifying the file. */
query(query: ObjectQuery = {}, options: {
    expectedVersion?: number;
} = {}): {
    version: number;
    items: ObjectSummary[];
    nextCursor?: string;
    summary: { studio: { animations: number; editorialSequences: number; editorialClips: number; audioTracks: number; audioClips: number; }; schemaVersion: 5; version: number; canvas: { width: number; height: number; background: string; }; frameRate: number; durationFrames: number; counts: { sequences: number; scenes: number; shots: number; panels: number; components: number; assets: number; audioTracks: number; comments: number; locks: number; }; titleTruncated?: boolean | undefined; id: string; title: string; };
    indexed: boolean;
};
```

### readPanel

```ts
readPanel(id: string, options: {
    revision?: string;
} = {}): Panel;
```

### panelDocument

```ts
/** Render context contains one decoded panel, plus timeline and small project metadata. */
panelDocument(id: string, options: {
    revision?: string;
} = {}): StoryboardDocument;
```

### readDocument

```ts
readDocument(): StoryboardDocument;
```

### copyTo

```ts
/** Copy the entire current container, including checkpoints, receipts and embedded assets. Never overwrites. */
async copyTo(path: string, options: CopyProjectOptions): Promise<{ projectId: string; version: number; documentHash: string; path: string; }>;
```

### readAsset

```ts
readAsset(id: string, options: {
    expectedVersion?: number;
    revision?: string;
} = {}): Buffer;
```

### readAssetIfPresent

```ts
/** Read a saved-head asset at the expected version, optionally requiring the same source declaration. */
readAssetIfPresent(id: string, options: {
    expectedVersion: number;
    asset?: Asset;
}): Buffer | undefined;
```

### extractAssets

```ts
/** Extract one saved snapshot using the asset writer's path and overwrite checks. */
extractAssets(directory: string, options: {
    expectedVersion?: number;
    revision?: string;
} = {}): void;
```

### save

```ts
save(document: StoryboardDocument, options: SaveOptions = {}): number;
```

### readReceipt

```ts
/** Receipts survive later saves, named revision restores and compaction. */
readReceipt(requestId: string): CommitReceipt | null;
```

### updatePanel

```ts
/** Targeted artwork revision. Topology and timeline edits use the full authoring session. */
updatePanel(panel: Panel, options: {
    expectedVersion: number;
    actor?: string;
}): void;
```

### inspect

```ts
inspect(): {
    format: string;
    formatVersion: number;
    writable: boolean;
    version: number;
    panels: number;
    payloads: Record<string, SQLOutputValue>[];
};
```

### frameDocument

```ts
/** Decode only the current panel and, during a transition, its incoming panel. */
frameDocument(frame: number, options: {
    revision?: string;
} = {}): StoryboardDocument;
```

### saveRevision

```ts
/** A named root of references, not a second copy of the project's media. */
saveRevision(name: string, options: {
    expectedVersion: number;
}): void;
```

### listRevisions

```ts
listRevisions(options: {
    limit?: number;
    offset?: number;
} = {}): { name: string; version: number; createdAt: string; panels: number; }[];
```

### readRevision

```ts
readRevision(name: string): StoryboardDocument;
```

### restoreRevision

```ts
restoreRevision(name: string, options: {
    expectedVersion: number;
    actor?: string;
}): void;
```

### deleteRevision

```ts
deleteRevision(name: string): void;
```

### compact

```ts
/** Optional maintenance, never part of a small edit. No artwork precision is changed. */
compact(): void;
```

### verify

```ts
verify(): void;
```
