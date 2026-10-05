# Media types

Data shapes for media. See [all type groups](../types.md) for other domains and shared units. Import public types from `codeboard-studio`; helper shapes are included to explain nested values.

## Asset

```ts
export interface Asset {
    id: Id;
    kind: "image" | "audio";
    name: string;
    path: string;
    mimeType: string;
    source: "linked" | "managed";
    checksum?: string;
}
```

## AudioClip

```ts
export interface AudioClip {
    id: Id;
    assetId: Id;
    name: string;
    startFrame: number;
    sourceInFrame: number;
    durationFrames: number;
    volume: number;
    fadeInFrames: number;
    fadeOutFrames: number;
}
```

## AudioTrack

```ts
export interface AudioTrack {
    id: Id;
    name: string;
    muted: boolean;
    locked: boolean;
    clips: AudioClip[];
}
```

## AudioTrackSummary

```ts
export interface AudioTrackSummary extends Omit<AudioTrack, "clips"> {
    clipCount: number;
}
```

## AudioClipQuery

```ts
export interface AudioClipQuery extends PageOptions {
    frame?: number;
    assetId?: Id;
}
```

## AudioTrackChanges

```ts
export type AudioTrackChanges = Partial<Pick<AudioTrack, "name" | "muted" | "locked">>;
```

## AudioClipInput

```ts
export type AudioClipInput = Omit<AudioClip, "id"> & {
    id?: Id;
};
```

## AudioClipChanges

```ts
export type AudioClipChanges = Partial<Pick<AudioClip, "startFrame" | "sourceInFrame" | "durationFrames" | "volume" | "fadeInFrames" | "fadeOutFrames" | "name">>;
```
