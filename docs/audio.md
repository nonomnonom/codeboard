# Audio

![Audio source seconds 1 through 4 placed at project seconds 2 through 5](../website/public/art/guides/audio-placement.png)

Explanatory diagram at 24 fps, not a waveform: source trim and timeline position are separate fields. [Run the visual studies](visual-examples.md).

Start with a project containing enough frames for the clip. The first example needs `audio/rain.wav` relative to the supplied asset root; npm does not include it. For a self-contained test, create `scratch.wav` with [the tone helper](#create-an-original-scratch-cue), register that path, and keep the clip duration within the generated sound.

Place dialogue, music, or effects on audio tracks. Each clip references a source asset and uses frame-based placement, trim, volume, and fades.

```js
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

```js
project.production.updateAudioClip(trackId, clipId, {
  startFrame: 8, sourceInFrame: 4, volume: .4,
});
console.log(project.production.audioClips(trackId, { limit: 20 }));
```

`splitAudioClip(clipId, frame)` divides a clip at a global timeline position. `moveAudioClip(clipId, targetTrackId, { startFrame })` moves it to another track. Use `removeAudioClip(trackId, clipId)` to delete it.

## Mute a track

```js
project.production.updateAudioTrack(trackId, { muted: true });
console.log(project.production.audioTracks({ limit: 20 }));
```

Muting preserves the track and its clips. A locked track rejects edits until unlocked with `updateAudioTrack(trackId, { locked: false })`.

## Create an original scratch cue

```js
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
