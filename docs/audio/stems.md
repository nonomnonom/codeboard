# Export a mix or stems

Write a WAV mix or aligned dialogue, music and effects stems. Save the project first so the decoder can read its embedded media.

<!-- study:audio-delivery:start -->
**Hear the cue inside the silence.** Does the exported sound start and stop where you placed it?

[![Play the two-second clip. Listen for the tone between 0.5 and 1 second, and compare that interval with the waveform.](../../website/public/art/guides/audio-delivery.png)](../../website/public/art/guides/audio-delivery.png)

Play the two-second clip. Listen for the tone between 0.5 and 1 second, and compare that interval with the waveform. The waveform comes from decoded mixed audio. The clip contains a generated tone, not speech.

<!-- study:audio-delivery:end -->

## Save an unquantized studio mix

```ts
import {writeFile} from 'node:fs/promises';
import {createFFmpegAudioDecoder, mixEditorialAudio, encodeWav} from 'codeboard-studio';

const decoder = createFFmpegAudioDecoder(project.captureAssetReader());
const mix = await mixEditorialAudio(
  project.editorialSequence('edit:main'), project.studio.animations,
  decoder, {sampleRate: 48000, transitions: 'linear'},
);
await writeFile('mix-float.wav', encodeWav(mix.channels, mix.sampleRate, {
  sampleFormat: 'float32',
}), {flag: 'wx'});
```

`encodeWav(channels, sampleRate, {sampleFormat})` accepts `pcm16` (the unchanged default) or `float32`. PCM16 retains the existing rounding/clamping behavior. Float32 writes finite Float32 samples directly, preserving values outside [-1, 1] and negative zero; it does not normalize or limit the mix. Use the mix's peak and clipped-sample diagnostics when deciding whether a downstream playback/delivery format needs gain adjustment.

Both modes accept one or two Float32Array channels, matching channel lengths, 8–192 kHz and at most one hour. RIFF size overflow rejects before output-buffer allocation. Float output uses the IEEE format tag, 32-bit samples, an 18-byte format chunk and a sample-count fact chunk. Microsoft documents the float sample width, block alignment and mono/stereo support in [WAVEFORMATEX](https://learn.microsoft.com/en-us/windows/win32/api/mmreg/ns-mmreg-waveformatex). This API allocates a complete WAV buffer; it does not stream stems, add broadcast metadata, dither or write RF64.

## Mix selected tracks as aligned stems

```ts
const dialogue = await mixEditorialAudio(sequence, animations, decoder, {
  sampleRate: 48000,
  transitions: 'linear',
  tracks: [
    {ownerId: 'animation:shot-a', trackId: 'audio:dialogue-a'},
    {ownerId: 'animation:shot-b', trackId: 'audio:dialogue-b'},
  ],
});
await writeFile('dialogue.wav', encodeWav(dialogue.channels, dialogue.sampleRate, {
  sampleFormat: 'float32',
}), {flag: 'wx'});
```

Both mix functions accept `tracks?: readonly AudioTrackRef[]`. Omit it to mix all unmuted tracks; pass an empty array for full-duration silence. Each reference contains an exact owner ID and track ID. For editorial mixing, owners can be the selected sequence or animations actually referenced by its clips. Unused library animations are not selectable. Duplicate references, unknown owners/tracks and more than 4096 references reject before decoding. Selecting a muted track does not unmute it.

Selection keeps authored gain, fades, source cropping and editorial transition policy. Reused shots contribute the selected source track at every editorial occurrence. Without a sample range the result remains the full timeline length, including silence, so separate dialogue/music/effects selections align. `mix.conform.trackSelection` records the copied explicit selection; omitted selection leaves that field absent. Call `conformShotAudio(animation, sampleRate, {tracks})` or pass `tracks` in editorial conform options for the same metadata-only calculation. Mixing does not edit project tracks. Floating-point accumulation order can prevent bit-identical recombination even when selections partition the full mix.

### Deliver a stem package

```ts
import {exportAudioStems, createFFmpegAudioDecoder} from 'codeboard-studio';

const decoder = createFFmpegAudioDecoder(project.captureAssetReader());
const result = await exportAudioStems(
  {kind: 'editorial', sequence: project.editorialSequence('edit:main'),
    animations: project.studio.animations},
  decoder,
  'delivery/audio-v001',
  {
    transitions: 'linear',
    sampleFormat: 'float32',
    mix: {sampleRate: 48000},
    stems: [
      {name: 'Dialogue', tracks: [
        {ownerId: 'animation:shot-a', trackId: 'audio:dialogue-a'},
      ]},
      {name: 'Music', tracks: [
        {ownerId: 'edit:main', trackId: 'audio:music'},
      ]},
    ],
  },
);
console.log(result.manifestFile);
```

A shot target uses `{kind: 'shot', animation}`. Supply 1–32 uniquely named stems with explicit track selections; empty selections produce silence. Track references follow the same owner, mute and reuse rules as mixing. Source data, stem selections and options are captured before asynchronous work. All stems share the sample rate and optional `mix.range`; mixer `maxSamples` and cancellation apply to each sequential mix. Intersecting clips are fully decoded for each stem, with no shared decode cache or streaming guarantee.

The destination must be new. Files use generated names such as `stem-001.wav`; display names never become filesystem paths. `stems.json` is renamed into place only after every WAV is written. It records the normalized source-data fingerprint, exact sample range, selections, peak/clipped-sample counts, file sizes and SHA-256 hashes. This fingerprint identifies supplied timeline/artwork data, not media bytes or a saved project revision; use a captured asset reader/checksum-verifying decoder to pin media. The manifest does not contain decoded source media.

Float32 is the default and preserves finite over-full-scale samples. PCM16 rejects a stem containing samples outside full scale before publication. Ordinary failure or cancellation removes only the newly reserved destination; cleanup errors are reported alongside the original error. Parent directories may remain. Abrupt termination can leave an incomplete directory without `stems.json`; this API does not resume it, fsync for power-loss durability, schedule workers, normalize loudness, categorize content or apply bus effects.

Before consuming a delivered package, call `await verifyAudioStems('delivery/audio-v001', {signal})`. It requires the completion manifest, validates its strict schema and consistent sample/byte counts, rejects linked or non-file entries, and reads each declared WAV in bounded chunks to compare its size and SHA-256. It returns `{directory, manifest}` and performs no writes or repair. Missing files, malformed metadata, size/hash mismatches and cancellation reject. The exporter and verifier both cap `stems.json` at 8 MiB; the verifier also detects growth beyond declared file limits. Additional undeclared files are ignored.

`parseAudioStemManifest(value)` provides detached validation of an already parsed metadata object without opening files. Neither function decodes WAV audio or recomputes peak statistics. A self-consistent manifest is not an authenticity signature: a sender can replace both files and hashes. Verification observes the bytes read through each file handle, not a transaction or lock on a changing directory; keep the completed package immutable during handoff. Successful verification does not prove loudness, channel content, audible quality or trusted provenance.
