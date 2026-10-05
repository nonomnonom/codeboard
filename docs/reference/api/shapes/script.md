# Script types

Data shapes for script. See [all type groups](../types.md) for other domains and shared units. Import public types from `codeboard-studio`; helper shapes are included to explain nested values.

## ScriptEntry

```ts
export interface ScriptEntry {
    id: string;
    kind: "scene" | "action" | "dialogue";
    text: string;
    speaker?: string;
    panelIds: string[];
}
```

## ScriptInput

```ts
export interface ScriptInput {
    id: string;
    title: string;
    entries: ScriptEntry[];
}
```

## ProductionScript

```ts
export interface ProductionScript extends ScriptInput {
    revision: number;
}
```

## ScriptChangeReport

```ts
export interface ScriptChangeReport {
    scriptId: string;
    beforeRevision: number;
    revision: number;
    titleChanged: boolean;
    reordered: boolean;
    added: string[];
    removed: string[];
    updated: {
        id: string;
        fields: ("kind" | "text" | "speaker" | "panelIds")[];
    }[];
}
```

## CaptionImportReport

```ts
export interface CaptionImportReport {
    baseVersion: number;
    changes: {
        panelId: string;
        field: CaptionField;
        before: string;
        after: string;
    }[];
    unchangedPanelIds: string[];
    plan: EditPlan | null;
}
```

## ScriptBoardPanel

```ts
export interface ScriptBoardPanel {
    panelId: string;
    shotId: string;
    entryIds: string[];
    durationFrames: number;
    title?: string;
}
```

## ScriptBoardReport

```ts
export interface ScriptBoardReport {
    scriptId: string;
    scriptRevision: number;
    panels: {
        panelId: string;
        shotId: string;
        entryIds: string[];
        durationFrames: number;
    }[];
    plan: EditPlan;
}
```

## CaptionField

```ts
export type CaptionField = (typeof captionFields)[number];
```

## CaptionImportRow

```ts
export type CaptionImportRow = {
    panelId: string;
} & Partial<Record<CaptionField, string | undefined>>;
```

## BoardCaptureOptions

```ts
export interface BoardCaptureOptions {
    sequenceId: string;
    panels: readonly {
        panelId: string;
        animationId: string;
        clipId: string;
    }[];
    audio: {
        mode: "omit";
    } | {
        mode: "convert";
        sampleRates: Record<string, number>;
        rounding?: TimeRounding;
    };
}
```
