# Editorial types

Data shapes for editorial. See [all type groups](../types.md) for other domains and shared units. Import public types from `codeboard-studio`; helper shapes are included to explain nested values.

## EditorialClip

```ts
export interface EditorialClip {
    id: string;
    animationId: string;
    startFrame: number;
    sourceInFrame: number;
    /** Editorial frames to hold source-in before normal source playback; shot audio is silent during the hold. */
    holdFrames?: number;
    durationFrames: number;
    transition: Transition;
}
```

## EditorialSequence

```ts
export interface EditorialSequence {
    audio?: StudioAudioTrack[];
    id: string;
    frameRate: RationalRate;
    clips: EditorialClip[];
}
```

## ResolvedEditorialFrame

```ts
export interface ResolvedEditorialFrame {
    frame: number;
    outgoing: {
        clipId: string;
        animationId: string;
        sourceFrame: number;
    };
    incoming?: {
        clipId: string;
        animationId: string;
        sourceFrame: number;
    };
    transition: Transition["type"];
    progress: number;
}
```

## EditorialEdit

```ts
export type EditorialEdit = {
    op: "split";
    id: string;
    atFrame: number;
    newId: string;
} | {
    op: "insert";
    clip: Omit<EditorialClip, "startFrame">;
    beforeId?: string;
} | {
    op: "update";
    id: string;
    changes: Partial<Pick<EditorialClip, "animationId" | "sourceInFrame" | "holdFrames" | "durationFrames" | "transition">>;
} | {
    op: "move";
    id: string;
    beforeId?: string;
} | {
    op: "remove";
    id: string;
};
```
