# Interchange types

Data shapes for interchange. See [all type groups](../types.md) for other domains and shared units. Import public types from `codeboard-studio`; helper shapes are included to explain nested values.

## OTIOMediaBinding

```ts
export interface OTIOMediaBinding {
    animationId: string;
    /** Exact external reference URL; never fetched or resolved by the adapter. */
    targetUrl: string;
    /** Media frame corresponding to animation frame zero, at the animation's rate. */
    sourceStartFrame?: number;
}
```

## OTIOOptions

```ts
export interface OTIOOptions {
    media: OTIOMediaBinding[];
    /** Reject unrepresented metadata/audio by default; report permits listed omissions. */
    lossPolicy?: "reject" | "report";
}
```

## OTIOImportOptions

```ts
export interface OTIOImportOptions extends OTIOOptions {
    sequenceId: string;
    frameRate: RationalRate;
}
```

## OTIOLoss

```ts
export interface OTIOLoss {
    path: string;
    reason: string;
}
```

## PSDImportOptions

```ts
export interface PSDImportOptions {
    /** Prefix for deterministic imported layer/element IDs; choose a fresh namespace per source. */
    namespace: string;
    /** Explicit interpretation of this subset's untagged RGB channels. Tagged profiles reject. */
    sourceColorSpace: "srgb";
    lossPolicy?: "reject" | "report";
}
```

## PSDImportLoss

```ts
export interface PSDImportLoss {
    path: string;
    reason: string;
}
```

## PSDImportResult

```ts
export interface PSDImportResult {
    width: number;
    height: number;
    layers: Layer[];
    sourceSha256: string;
    losses: PSDImportLoss[];
}
```

## ScriptCSVOptions

```ts
export interface ScriptCSVOptions {
    id: string;
    title: string;
}
```

## FDXLoss

```ts
export interface FDXLoss {
    path: string;
    reason: string;
}
```

## FDXParagraph

```ts
export interface FDXParagraph {
    /** Zero-based direct Paragraph position within Content, including unsupported paragraphs. */
    paragraph: number;
    kind: ScriptEntry["kind"];
    text: string;
    speaker?: string;
}
```

## FDXInspection

```ts
export interface FDXInspection {
    sourceSha256: string;
    paragraphs: FDXParagraph[];
    losses: FDXLoss[];
}
```

## FDXImportOptions

```ts
export interface FDXImportOptions {
    id: string;
    title: string;
    /** Hash from inspection; rejects bindings prepared for different source text. */
    sourceSha256: string;
    /** Exactly one explicit stable identity/link binding per inspected paragraph. */
    bindings: {
        paragraph: number;
        id: string;
        panelIds: string[];
    }[];
    lossPolicy?: "reject" | "report";
}
```
