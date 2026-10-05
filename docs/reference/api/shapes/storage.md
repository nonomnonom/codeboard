# Storage types

Data shapes for storage. See [all type groups](../types.md) for other domains and shared units. Import public types from `codeboard-studio`; helper shapes are included to explain nested values.

## CopyProjectOptions

```ts
export interface CopyProjectOptions {
    expectedVersion: number;
    maxBytes?: number;
    signal?: AbortSignal;
}
```

## Header

```ts
export type Header = Omit<StoryboardDocument, "panels" | "components" | "changes" | "studio">;
```

## PanelInfo

```ts
export type PanelInfo = Omit<Panel, "layers" | "motion">;
```

## SaveOptions

```ts
export type SaveOptions = {
    expectedVersion?: number;
    overwrite?: boolean;
    assetRoot?: string;
    readAsset?: (id: string) => Buffer | undefined;
};
```
