# Project storage API

Open a store with `ProjectStore.open(path)` and always call `close()` in `finally`. For ordinary editing, prefer `StoryboardProject.open` and `save`. See [projects and revisions](projects.md) for partial reads, conflict handling, and named checkpoints.

Parameter declarations below are extracted from the current source. A value after `=` is the default; `?` marks an optional input. Named data shapes are listed in [API types](api-types.md).

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

### readAsset

```ts
readAsset(id: string, options: {
    expectedVersion?: number;
    revision?: string;
} = {}): Buffer;
```

### extractAssets

```ts
/** Explicit extraction for file-based audio encoders; never writes outside destination. */
extractAssets(directory: string): void;
```

### save

```ts
save(document: StoryboardDocument, options: {
    expectedVersion?: number;
    overwrite?: boolean;
    assetRoot?: string;
    readAsset?: (id: string) => Buffer | undefined;
} = {}): number;
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
