# Review types

Data shapes for review. See [all type groups](../types.md) for other domains and shared units. Import public types from `codeboard-studio`; helper shapes are included to explain nested values.

## ReviewComment

```ts
export interface ReviewComment {
    id: Id;
    author: string;
    body: string;
    status: "open" | "resolved";
    anchor: {
        panelId?: Id;
        layerId?: Id;
        elementId?: Id;
        frame?: number;
        x?: number;
        y?: number;
    };
    createdAt: string;
    resolvedAt?: string;
}
```

## ProjectLock

```ts
export interface ProjectLock {
    id: Id;
    targetType: "project" | "panel" | "layer";
    targetId: Id;
    owner: string;
    reason: string;
    createdAt: string;
}
```

## ChangeEntry

```ts
export interface ChangeEntry {
    id: Id;
    version: number;
    actor: string;
    operation: string;
    targetIds: Id[];
    timestamp: string;
}
```
