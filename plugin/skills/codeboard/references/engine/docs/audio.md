# Audio

![Audio source seconds 1 through 4 placed at project seconds 2 through 5](https://codeboard.nonom.xyz/art/guides/audio-placement.png)

Explanatory diagram at 24 fps, not a waveform: source trim and timeline position are separate fields. [Run the visual studies](visual-examples.md).

Start with a project containing enough frames for the clip. The first example needs `audio/rain.wav` relative to the supplied asset root; npm does not include it. For a self-contained test, create `scratch.wav` with [the tone helper](#create-an-original-scratch-cue), register that path, and keep the clip duration within the generated sound.

Place dialogue, music, or effects on audio tracks. Each clip references a source asset and uses frame-based placement, trim, volume, and fades.

```ts
const assetId = project.production.addAsset({
  kind: 'audio', name: 'Rain', path: 'audio/rain.wav',
  mimeType: 'audio/wav', source: 'linked',
});
const trackId = project.production.addAudioTrack('Ambience');
const clipId = project.production.addAudioClip(trackId, {
  assetId, name: 'Rain bed',
  startFrame: 0, sourceInFrame: 0, durationFrames: 120,
  volume: .6, fadeInFrames: 12, fadeOutFrames: 24,
});
await project.save('film.cboard', { assetRoot: process.cwd() });
```

`startFrame` is the position in the project timeline. `sourceInFrame` selects where playback starts within the audio. `durationFrames` is the clip's timeline length. Frame values use the project's frame rate. `volume: 1` is the original level; `0` is silent.

Keep clip durations within the scene you want to hear and make sure the source file contains enough audio. Saving embeds the referenced asset so a saved project can travel with its sound.

## Adjust synchronization

At 24 fps, `startFrame: 48`, `sourceInFrame: 24`, and `durationFrames: 72` place three seconds of sound at project time 2–5 seconds, reading source time 1–4 seconds. Moving the timeline start does not change the source trim. The source must contain that entire interval.

```ts
project.production.updateAudioClip(trackId, clipId, {
  startFrame: 8, sourceInFrame: 4, volume: .4,
});
console.log(project.production.audioClips(trackId, { limit: 20 }));
```

`splitAudioClip(clipId, frame)` divides a clip at a global timeline position. `moveAudioClip(clipId, targetTrackId, { startFrame })` moves it to another track. Use `removeAudioClip(trackId, clipId)` to delete it.

## Mute a track

```ts
project.production.updateAudioTrack(trackId, { muted: true });
console.log(project.production.audioTracks({ limit: 20 }));
```

Muting preserves the track and its clips. A locked track rejects edits until unlocked with `updateAudioTrack(trackId, { locked: false })`.

## Create an original scratch cue

```ts
import { createToneWav, encodeWav } from 'codeboard-studio';
import { writeFile } from 'node:fs/promises';
await writeFile('scratch.wav', createToneWav({
  frequency: 220, durationSeconds: .25, volume: .1,
  attackSeconds: .01, releaseSeconds: .12,
}));
```

For procedural sound, pass one or two equal-length `Float32Array` channels to `encodeWav(channels, sampleRate)`. Samples are clipped to -1..1 and encoded as 16-bit PCM WAV. The helper supports 8–192 kHz and up to one hour per buffer. It does not generate dialogue, music arrangements, or recorded Foley for you.

## Trim, split, and move a cue

`sourceInFrame` trims the source head without moving the timeline start. `durationFrames` controls how long the clip plays. Fades use frame counts, and volume belongs to the clip. A split takes a global frame inside the clip and returns the new right-hand clip ID. Inspect both resulting clips and their trims after splitting.

An audio track can be renamed, muted, locked, or removed. Track locking is distinct from the review locks on project artwork. Movie export mixes the placed clips; clipping can occur if overlapping sources are too loud, so check the mix instead of relying only on individual clip volume.

## Audio after retiming

When a panel's duration changes, clips starting at or after its old end ripple by the duration difference. Clips that start inside or before the panel do not stretch or move automatically. Adjust interior sync cues and check crossing music/ambience yourself. A locked track blocks a retime that would move one of its clips.

## Listen to the result

Export a movie with FFmpeg, then review playback:

```sh
codeboard movie film.cboard --output film.mp4
```

Use audio you created or have permission to use. Codeboard does not require TTS, speech synthesis, or a model connection.

Movie export converts frame positions to 48 kHz sample indices using the shared rational tick mapper: source trim endpoints, placement delays and total mix length avoid floating-point intermediate multiplication. This may correct an old one-sample rounding discrepancy at a boundary. Source timing is still authored/stored in frames; persisted sample-accurate source offsets and alignment remain unavailable. Fade durations and movie duration are still passed as seconds to FFmpeg.

## Studio audio clocks

Shot animations and editorial sequences can store `audio` tracks independently of board tracks. Omitted `audio` means no tracks. `project.setStudioAudio(ownerId, tracks)` replaces the complete track list for an animation or editorial sequence through the project transaction. Empty arrays clear it. Track/clip IDs are unique across the project; audio assets must already exist or be created earlier in the same transaction. Discovery exposes `studio-audio-track` and `studio-audio-clip` kinds. Existing board audio methods address only board tracks.

```js
const tracks = defineStudioAudio([{
  id: 'sound:dialogue', name: 'Dialogue', muted: false,
  clips: [{
    id: 'sound:line-1', assetId: 'asset:voice', name: 'Opening line',
    start: { ticks: 12, rate: { numerator: 24, denominator: 1 } },
    source: { sampleRate: 48000, startSample: 24000, sampleCount: 96000 },
    volume: 1, fadeInSamples: 240, fadeOutSamples: 480,
  }],
}]);
project.setStudioAudio('animation:greeting', tracks);
const placements = compileStudioAudio(tracks, 48000);
```

`start` is a nonnegative rational time measured from the owning shot/sequence origin. Its `rate` means ticks per second, so the example starts at half a second. `source.startSample` and `source.sampleCount` address the original media's sample clock; the end is exclusive. Fades use that source sample clock as well. Rate values normalize to reduced fractions. These fields declare the intended media timing; registration does not prove the actual sample rate, decoded duration or codec. The FFmpeg adapter below verifies media metadata/ranges, and studio movie export can use its PCM mix.

`compileStudioAudio(tracks, outputSampleRate)` returns unmuted clip placements and copies of their source records. Start/count/fade outputs are `TimeConversion` values with exactness and reduced quantization error. Conversion uses nearest rounding with positive ties upward; it does not resample PCM, read files, stretch audio or clamp clips to a movie duration. Invalid source ends, overlapping fades, duplicate IDs, unsafe output positions and clip collapse at the chosen sample rate reject. Fades that become overlapping after conversion also reject. Volume is a nonnegative linear gain, without automatic normalization/limiting.

Studio movies require an explicit mix or omission policy when unmuted tracks exist. Use the export APIs described in [export](export.md); `--mix-audio sum|linear` or `--omit-audio` selects the CLI policy. Muting changes authored data; selecting omission changes only this export. Board movie audio retains its existing behavior.


## Conform shot audio to an edit

`conformShotAudio(animation, sampleRate = 48000)` crops unmuted audio to the shot duration. `conformEditorialAudio(sequence, animations, { sampleRate, transitions })` maps shot audio into each editorial clip, combines it with sequence-owned tracks and returns an `AudioConform`. This is an executable timing calculation; it does not decode or mix PCM.

```js
const conform = conformEditorialAudio(sequence, animations, {
  sampleRate: 48000,
  transitions: 'linear',
});
```

Choose `transitions: 'sum'` to retain both sources at their authored gain during picture overlaps, or `'linear'` for linear amplitude crossfades across each overlap. Dissolves and wipes use the same selected audio policy. No equal-power curve or normalization is implied. Sequence-owned tracks are independent and receive no picture-transition envelope.

Each segment retains its owning animation/sequence, editorial clip ID when applicable, original compiled audio clip, output start/count and `clipOffsetSamples`. The offset addresses the already-trimmed/resampled audio clip, so authored fade envelopes continue from their original position rather than restarting at an editorial cut. Transition ramps contain absolute output-sample ranges and endpoint gains; multiply them with authored clip fades and volume. Ramp evaluation clamps outside its endpoints. A reused shot produces separate segments for each editorial occurrence.

Source-in uses the shot rate; clip start/end use the editorial rate. All boundaries are converted to one output sample clock with nearest rounding and reported quantization. `windows` records converted source-in, source duration limit and absolute output endpoints for each clip. Window duration is the difference of converted absolute endpoints, avoiding accumulated per-clip duration rounding. Audio is cropped to each source window, the shot's declared duration and the editorial output duration. It plays at normal speed; it is not duplicated at video frame boundaries or stretched to match source frame counts. The last video frame can outlast available source audio at mixed rates; any resulting tail is silent.

Muted tracks contribute no segments. Silent gaps remain gaps, clips outside the window contribute nothing, and collapsed output clips/transitions or unsafe arithmetic reject. Empty segment lists are valid silent output. The resulting data and gain ramps still require a decoder/mixer before WAV or movie audio delivery; source rate/duration declarations remain unverified against media bytes.

## Mix PCM through a decoder adapter

`mixShotAudio(animation, decoder, options)` and `mixEditorialAudio(sequence, animations, decoder, options)` run conform and mix actual PCM into stereo Float32 channels. Editorial options require `transitions: 'sum' | 'linear'`. Both accept `sampleRate` (default 48000, supported 8000–192000), `maxSamples` (default/hard maximum 16777216 per channel for output and each decoded clip), and `signal`. Inputs are validated and conformed before the first asynchronous decode.

Use `range: {startSample, endSample}` for a nonempty half-open window in the output sample rate. Both positions must be safe integers within the full conformed timeline. The returned channels start at that window's first sample; `result.range` records its absolute bounds, while `result.conform` still describes the complete timeline. Omitting the option mixes the full timeline and reports that full range. Peak/clipping statistics cover only the returned window. Fades and editorial ramps are evaluated at their original positions, not restarted at zero. Clips wholly outside the window are skipped; each intersecting clip is still fully decoded and must fit `maxSamples`. This bounds output allocation but does not implement streaming source decoding.

The decoder receives `AudioDecodeRequest`: asset ID, declared source sample rate, original start/count, output sample rate/count and optional abort signal. It must verify the asset's sample rate and range, trim in original sample units, resample, and return exactly the requested number of samples as one or two `Float32Array` channels. Mono duplicates into left/right; stereo retains its channels. Hand ownership of those arrays to the mixer until it returns. Pin media bytes in the adapter so repeated calls cannot resolve different versions. The FFmpeg decoder below supplies this adapter for supported media.

The mixer validates returned channel shapes, rejects invalid consumed samples/overflow, applies linear volume, original clip fades and absolute transition ramps, then sums overlapping segments. Fade-in starts at zero on the first faded sample; fade-out ends at zero on the last clip sample. Editorial cropping keeps that original fade phase. Output is not normalized, limited or clipped. The result includes `sampleRate`, stereo `channels`, `peak`, `clippedSamples` (individual channel samples with absolute value above 1), and the conform report. Silent gaps are zero. Inspect clipping before delivery; `encodeWav(result.channels, result.sampleRate)` converts to PCM16 and clips values outside ±1.

Mixing yields between 65536-sample blocks and checks cancellation around decoding and blocks. Decoder cancellation still depends on the adapter honoring its signal. Repeated shot occurrences may decode the same clip again; there is no retained media cache. Bounds cover mixer output and requested decoded clip lengths, not caller-owned input assets, source artwork or a misbehaving adapter's allocations. Studio movie export consumes this PCM mix and rejects clipping before encoding.

## FFmpeg decoder adapter

```js
const decode = createFFmpegAudioDecoder(project.captureAssetReader(), {
  ffmpegPath: '/tools/ffmpeg',
  ffprobePath: '/tools/ffprobe',
});
const mix = await mixShotAudio(project.shotAnimation('animation:greeting'), decode);
```

`createFFmpegAudioDecoder(readAsset, options)` takes a synchronous/asynchronous reader of asset bytes. It copies each input and pins its SHA-256 at first use; a subsequent change to the same asset ID rejects. Pins live only in this decoder instance and do not replace project asset checksums or durable provenance. The reader remains responsible for resolving the intended project/revision and can still allocate memory before the decoder checks it.

The adapter probes the first audio stream with ffprobe, checks the declared source rate and accepts mono/stereo at 8–192 kHz. It decodes the requested original sample range to float PCM and requires the exact source count, then resamples when needed. Native trim uses [`atrim` sample counts](https://ffmpeg.org/ffmpeg-filters.html#atrim); probe fields use [ffprobe stream entries](https://ffmpeg.org/ffprobe.html). Samples address decoded audio rather than compressed packet offsets. Output uses the requested nearest-rounded count; one extra trailing resampler sample is discarded, while short or larger-than-budget output rejects. Nonfinite PCM rejects. No silence is inserted to hide missing source samples.

`ffmpegPath`/`FFMPEG_PATH` select FFmpeg; `ffprobePath`/`FFPROBE_PATH` select ffprobe independently, otherwise each executable is found on PATH. Each process has a default 30-second timeout (configurable up to 120 seconds), bounded stdout and 12 KiB stderr retention. Asset bytes default to 64 MiB with a configurable hard maximum of 256 MiB; source/output clips are limited to 16777216 samples per channel. Input protocols are restricted to the byte pipe, so containers needing seekable files or external resources may reject. This is not universal codec support. Child processes are hidden, receive arguments directly and are cancelled/killed on failure or limits. Asset reader cancellation is caller-owned; PCM unpacking yields in blocks. Studio movie mixing can use this adapter.

## Edit individual studio audio objects

`project.editStudioAudio(ownerId, edits)` changes an animation/sequence audio list through the project transaction. `reviseStudioAudio(tracks, edits)` applies the same algorithm to isolated values and returns the new tracks. Each batch contains 1–1000 ordered edits:

- `track.add` with complete `track`; `track.update` with `id` and `changes` for name/muted; `track.remove` with `id`.
- `clip.add` with destination `trackId` and complete `clip`.
- `clip.update` with stable `id` and partial `changes` for any field except ID. Supply the complete nested `source` or `start` when changing one.
- `clip.move` with `id`, destination `trackId` and optional `start`. Omitted start preserves placement and source range; moving within the same track only changes placement when provided.
- `clip.split` with `id`, positive `atSample` offset from the trimmed source start, and explicit `newId` for the right half.
- `clip.remove` with `id`.

```js
project.editStudioAudio('animation:greeting', [
  { op: 'clip.update', id: 'sound:line-1', changes: {
    source: { sampleRate: 48000, startSample: 30000, sampleCount: 72000 },
  } },
  { op: 'clip.update', id: 'sound:line-1', changes: { fadeOutSamples: 240 } },
]);
```

Updates can correct trim and fades together before final range validation. Stable IDs remain unchanged; new IDs must be unique. Missing tracks/clips, duplicate IDs or an invalid final state reject without changing the original tracks. Removing a track removes its clips but retains assets. The project mutation additionally checks global IDs and audio asset references. These edits do not ripple picture timing or infer retiming from track array order. Cross-owner moves require explicit remove/add edits in a project transaction; there is no implicit time-domain conversion.

### Split studio audio at a source sample

```ts
project.editStudioAudio('animation:greeting', [
  {op: 'clip.split', id: 'sound:line-1', atSample: 24000, newId: 'sound:line-1-right'},
]);
```

`atSample` counts source samples relative to the current trim, not absolute media position, timeline frames or output-mixer samples. Both halves must be nonempty. The left keeps its ID/start/fade-in; the right receives the new ID, advances source start by the offset and retains the original fade-out. Inner fades become zero. Asset, name, volume and track membership are retained; the right half follows the left in track order. Duplicate IDs and splits through either outer fade reject before replacement (`AUDIO_SPLIT_RANGE` or `AUDIO_SPLIT_FADE` in error details for range/fade failures).

Right-hand timeline placement is the exact sum of the original rational start and the source-sample offset. Its tick rate may change to a reduced integer clock; no quantization is introduced by the edit. An unrepresentable safe-integer result rejects with `RESOURCE_LIMIT` and `TIME_SUM_RANGE`. For example, a start of 1 tick at 24 Hz plus 1 sample at 48000 Hz becomes 667 ticks at 16000 Hz (exactly 2001/48000 seconds). Stored clip data uses the existing schema; no new persisted split object or media file is created. The same edit works inside `studio.audio.edit` plans.

The compiler still quantizes each resulting clip to the requested output clock, and the decoder may resample each trim independently. Exact edit placement does not guarantee sample-identical PCM at a different output rate. The audio-delivery study now splits its source cue before saving and mixing. Listen for seams with the actual source recording and output clock.

### Inspect studio audio by owner

```js
const tracks = project.studioAudioTracks('animation:greeting', {limit: 50});
const track = tracks[0];
if (!track) throw new Error('Expected an authored audio track');
const clips = project.studioAudioClips('animation:greeting', track.id, {offset: 0, limit: 50});
```

The owner is a shot-animation or editorial-sequence ID. Track results contain `id`, `name`, `muted` and `clipCount`; clip results contain the complete sample ranges, rational start, volume and fades. Use a known track ID or check that a track exists before indexing the array. Missing owners or tracks reject; an existing owner without audio returns an empty track page. Reads copy only selected metadata and never return live arrays. Both methods use the standard offset/default-50/maximum-200 count limit and retain authored order. Restart offset pagination after edits. The existing `editStudioAudio` operation applies revisions.

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

Both modes accept one or two Float32Array channels, matching channel lengths, 8–192 kHz and at most one hour. RIFF size overflow rejects before output-buffer allocation. Float output uses the IEEE format tag, 32-bit samples, an 18-byte format chunk and a sample-count fact chunk. Microsoft documents the float sample width, block alignment and mono/stereo support in [WAVEFORMATEX](https://learn.microsoft.com/en-us/windows/win32/api/mmreg/ns-mmreg-waveformatex). This API allocates a complete WAV buffer; it does not stream stems, add broadcast metadata, dither or write RF64. Decoder/DAW interoperability qualification remains pending.

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

Float32 is the default and preserves finite over-full-scale samples. PCM16 rejects a stem containing samples outside full scale before publication. Ordinary failure or cancellation removes only the newly reserved destination; cleanup errors are reported alongside the original error. Parent directories may remain. Abrupt termination can leave an incomplete directory without `stems.json`; this API does not resume it, fsync for power-loss durability, schedule workers, normalize loudness, categorize content or apply bus effects. Independent WAV/DAW interoperability and failure-recovery behavior still require runtime qualification.

Before consuming a delivered package, call `await verifyAudioStems('delivery/audio-v001', {signal})`. It requires the completion manifest, validates its strict schema and consistent sample/byte counts, rejects linked or non-file entries, and reads each declared WAV in bounded chunks to compare its size and SHA-256. It returns `{directory, manifest}` and performs no writes or repair. Missing files, malformed metadata, size/hash mismatches and cancellation reject. The exporter and verifier both cap `stems.json` at 8 MiB; the verifier also detects growth beyond declared file limits. Additional undeclared files are ignored.

`parseAudioStemManifest(value)` provides detached validation of an already parsed metadata object without opening files. Neither function decodes WAV audio or recomputes peak statistics. A self-consistent manifest is not an authenticity signature: a sender can replace both files and hashes. Verification observes the bytes read through each file handle, not a transaction or lock on a changing directory; keep the completed package immutable during handoff. Successful verification does not prove loudness, channel content, audible quality or trusted provenance.


## Require exact output sample boundaries

```ts
const conform = conformShotAudio(animation, 48000, {rounding: 'exact'});
const mix = await mixShotAudio(animation, decoder, {sampleRate: 48000, rounding: 'exact'});
```

Studio audio conversion accepts `rounding: 'nearest' | 'exact'`. Omission keeps `nearest`, including existing quantization/error reports. `exact` rejects conversions that require rounding, before PCM decoding. The shared policy covers clip placement, source duration, fades, shot duration, editorial source/window/transition boundaries and sequence audio. Conform returns the selected policy in `rounding`. Validation covers the selected unmuted tracks and complete conform, even when a requested mix range uses only part of it.

Pass `{rounding: 'exact'}` as the third argument of `compileStudioAudio`, in conform/mix options, in stem export `mix`, or in movie `audio: {mode: 'mix', decoder, transitions: 'sum', rounding: 'exact'}`. Movie audio also checks the selected picture range endpoints at its 48 kHz output clock. Stem CLI JSON inherits the same mix option. Unsupported rounding values reject.

For example, a one-source-sample duration at 44100 Hz cannot map exactly to 48000 Hz and is rejected in exact mode. Choose an output clock or authored boundaries that represent the required times, or explicitly retain nearest rounding. Exact timing does not remove decoder resampling, guarantee bit-identical split PCM or prove an inaudible seam. Decoder contracts and the default output length rule remain unchanged. The audio-delivery study requests exact conversion after its 48 kHz split.
