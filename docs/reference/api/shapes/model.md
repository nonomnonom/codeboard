# Model types

Data shapes for model. See [all type groups](../types.md) for other domains and shared units. Import public types from `codeboard-studio`; helper shapes are included to explain nested values.

## ErrorCode

```ts
export type ErrorCode = "OPERATION_FAILED" | "MISSING_DEPENDENCY" | "INVALID_ARGUMENT" | "INVALID_CURSOR" | "STALE_CURSOR" | "REVISION_CONFLICT" | "RESOURCE_LIMIT" | "REQUEST_ID_REUSED" | "ASSET_MISSING" | "ASSET_CHECKSUM_MISMATCH" | "CANCELLED" | "SCHEMA_MIGRATION_REQUIRED";
```

## ShotDependency

```ts
export interface ShotDependency {
    kind: "component" | "origin" | "palette" | "swatch" | "asset" | "font";
    id: string;
    status: "embedded" | "declared" | "missing";
    sha256: string | null;
    version?: number;
    paletteId?: string;
    source?: "linked" | "managed";
    checksum?: string | null;
}
```

## PaletteMergeOptions

```ts
export type PaletteMergeOptions = ValueMergeOptions;
```

## ShotSubsetOptions

```ts
export interface ShotSubsetOptions {
    projectId: string;
    title?: string;
}
```

## FontFileDependency

```ts
export interface FontFileDependency {
    family: string;
    path: string;
    sha256: string;
}
```

## ComponentUpgradeOptions

```ts
export interface ComponentUpgradeOptions extends ValueMergeOptions {
    newIdentities?: readonly {
        sourceId: string;
        copyId: string;
    }[];
}
```
