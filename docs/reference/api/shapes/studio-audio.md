# Studio audio types

Data shapes for studio audio. See [all type groups](../types.md) for other domains and shared units. Import public types from `codeboard-studio`; helper shapes are included to explain nested values.

## StudioAudioClip

```ts
export interface StudioAudioClip {
    id: string;
    assetId: string;
    name: string;
    start: {
        ticks: number;
        rate: RationalRate;
    };
    source: {
        sampleRate: number;
        startSample: number;
        sampleCount: number;
    };
    volume: number;
    fadeInSamples: number;
    fadeOutSamples: number;
}
```

## StudioAudioTrack

```ts
export interface StudioAudioTrack {
    id: string;
    name: string;
    muted: boolean;
    clips: StudioAudioClip[];
}
```

## StudioAudioEdit

```ts
export type StudioAudioEdit = {
    op: "track.add";
    track: StudioAudioTrack;
} | {
    op: "track.update";
    id: string;
    changes: Partial<Pick<StudioAudioTrack, "name" | "muted">>;
} | {
    op: "track.remove";
    id: string;
} | {
    op: "clip.add";
    trackId: string;
    clip: StudioAudioClip;
} | {
    op: "clip.update";
    id: string;
    changes: Partial<Omit<StudioAudioClip, "id">>;
} | {
    op: "clip.move";
    id: string;
    trackId: string;
    start?: StudioAudioClip["start"];
} | {
    op: "clip.split";
    id: string;
    atSample: number;
    newId: string;
} | {
    op: "clip.remove";
    id: string;
};
```
