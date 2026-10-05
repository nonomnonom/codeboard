# Shot timing types

Data shapes for shot timing. See [all type groups](../types.md) for other domains and shared units. Import public types from `codeboard-studio`; helper shapes are included to explain nested values.

## ShotRetimeOptions

```ts
export interface ShotRetimeOptions {
    durationFrames: number;
    frameRate?: RationalRate;
    /** Exact by default; any quantization must be explicitly selected. */
    rounding?: TimeRounding;
    /** Source samples/fades are never stretched; choose how cue starts follow the new timing. */
    audio: "preserve-seconds" | "scale-starts";
}
```
