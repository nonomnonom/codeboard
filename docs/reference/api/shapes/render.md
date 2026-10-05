# Render types

Data shapes for render. See [all type groups](../types.md) for other domains and shared units. Import public types from `codeboard-studio`; helper shapes are included to explain nested values.

## CompositionGuides

```ts
export interface CompositionGuides {
    frame?: number;
    thirds?: boolean;
    /** Fraction of frame width/height inset on each edge; not a broadcast standard. */
    safeInset?: number;
    /** Output-frame pixel coordinates, after camera placement. */
    horizonY?: number;
    vanishingPoints?: readonly {
        x: number;
        y: number;
    }[];
}
```

## OnionSkinSample

```ts
export interface OnionSkinSample {
    panelId: string;
    frame?: number;
    layerIds?: readonly string[];
    tint?: string;
    opacity?: number;
}
```

## FontDependency

```ts
export interface FontDependency {
    ownerId: string;
    layerId: string;
    elementId: string;
    font: string;
    canonicalFont: string | null;
    families: {
        name: string;
        status: "available" | "generic" | "missing";
    }[];
    resolvedFamilies: string[];
    issue: "invalid-declaration" | "unsupported-declaration" | "missing-family" | null;
}
```

## FontInspection

```ts
export interface FontInspection {
    available: boolean;
    elements: FontDependency[];
}
```

## FontPolicy

```ts
export type FontPolicy = "allow-fallback" | "require-available";
```

## RenderSource

```ts
export type RenderSource = StoryboardProject | StoryboardDocument;
```

## PanelRenderSource

```ts
export type PanelRenderSource = StoryboardProject | Pick<StoryboardDocument, "canvas" | "panels" | "shots">;
```
