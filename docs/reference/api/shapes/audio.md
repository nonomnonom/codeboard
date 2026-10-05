# Audio types

Data shapes for audio. See [all type groups](../types.md) for other domains and shared units. Import public types from `codeboard-studio`; helper shapes are included to explain nested values.

## ToneOptions

```ts
export interface ToneOptions {
    frequency?: number;
    durationSeconds?: number;
    sampleRate?: number;
    volume?: number;
    attackSeconds?: number;
    releaseSeconds?: number;
}
```

## WavEncodingOptions

```ts
export interface WavEncodingOptions {
    sampleFormat?: "pcm16" | "float32";
}
```

## CompiledAudioClip

```ts
export interface CompiledAudioClip {
    trackId: string;
    clip: StudioAudioClip;
    startSample: TimeConversion;
    sampleCount: TimeConversion;
    fadeInSamples: TimeConversion;
    fadeOutSamples: TimeConversion;
}
```

## AudioSampleRounding

```ts
export type AudioSampleRounding = "nearest" | "exact";
```

## AudioGainRamp

```ts
export interface AudioGainRamp {
    startSample: number;
    endSample: number;
    from: number;
    to: number;
}
```

## ConformedAudioSegment

```ts
export interface ConformedAudioSegment {
    ownerId: string;
    editorialClipId?: string;
    audio: CompiledAudioClip;
    outputStartSample: number;
    clipOffsetSamples: number;
    sampleCount: number;
    ramps: AudioGainRamp[];
}
```

## AudioConform

```ts
export interface AudioConform {
    rounding?: AudioSampleRounding;
    trackSelection?: AudioTrackRef[];
    sampleRate: number;
    duration: TimeConversion;
    segments: ConformedAudioSegment[];
    windows: {
        clipId: string;
        sourceStart: TimeConversion;
        outputStart: TimeConversion;
        outputEnd: TimeConversion;
        /** Present when source playback begins after an initial silent picture hold. */
        playbackStart?: TimeConversion;
        sourceLimit: TimeConversion;
    }[];
    transitions: "sum" | "linear";
}
```

## AudioDecodeRequest

```ts
export interface AudioDecodeRequest {
    assetId: string;
    sourceSampleRate: number;
    startSample: number;
    sampleCount: number;
    outputSampleRate: number;
    outputSampleCount: number;
    signal?: AbortSignal;
}
```

## StudioAudioDecoder

```ts
/** Return trimmed/resampled mono or stereo PCM; the adapter must verify source rate and range. */
export type StudioAudioDecoder = (request: AudioDecodeRequest) => Promise<Float32Array[]>;
```

## AudioMixOptions

```ts
export interface AudioMixOptions {
    rounding?: AudioSampleRounding;
    range?: {
        startSample: number;
        endSample: number;
    };
    tracks?: readonly AudioTrackRef[];
    sampleRate?: number;
    maxSamples?: number;
    signal?: AbortSignal;
}
```

## AudioMixResult

```ts
export interface AudioMixResult {
    range: {
        startSample: number;
        endSample: number;
    };
    sampleRate: number;
    channels: [
        Float32Array,
        Float32Array
    ];
    peak: number;
    clippedSamples: number;
    conform: AudioConform;
}
```

## AudioTrackRef

```ts
export interface AudioTrackRef {
    ownerId: string;
    trackId: string;
}
```

## FFmpegAudioDecoderOptions

```ts
export interface FFmpegAudioDecoderOptions {
    ffmpegPath?: string;
    ffprobePath?: string;
    timeoutMs?: number;
    maxAssetBytes?: number;
}
```
