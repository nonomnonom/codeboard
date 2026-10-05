# Choose audio rounding

Use exact conversion when fractional output samples should stop the operation. Use nearest rounding when the reported timing difference is acceptable.

## Require exact output sample boundaries

```ts
const conform = conformShotAudio(animation, 48000, {rounding: 'exact'});
const mix = await mixShotAudio(animation, decoder, {sampleRate: 48000, rounding: 'exact'});
```

Studio audio conversion accepts `rounding: 'nearest' | 'exact'`. Omission keeps `nearest`, including existing quantization/error reports. `exact` rejects conversions that require rounding, before PCM decoding. The shared policy covers clip placement, source duration, fades, shot duration, editorial source/window/transition boundaries and sequence audio. Conform returns the selected policy in `rounding`. Validation covers the selected unmuted tracks and complete conform, even when a requested mix range uses only part of it.

Pass `{rounding: 'exact'}` as the third argument of `compileStudioAudio`, in conform/mix options, in stem export `mix`, or in movie `audio: {mode: 'mix', decoder, transitions: 'sum', rounding: 'exact'}`. Movie audio also checks the selected picture range endpoints at its 48 kHz output clock. Stem CLI JSON inherits the same mix option. Unsupported rounding values reject.

For example, a one-source-sample duration at 44100 Hz cannot map exactly to 48000 Hz and is rejected in exact mode. Choose an output clock or authored boundaries that represent the required times, or explicitly retain nearest rounding. Exact timing does not remove decoder resampling, guarantee bit-identical split PCM or prove an inaudible seam. Decoder contracts and the default output length rule remain unchanged. 
