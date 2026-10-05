import { parseAudioStemOptions } from "./audio-stem-options.js";
import { mkdir, writeFile, rename, rm } from "node:fs/promises";
import { resolve, dirname, join, relative, isAbsolute, sep } from "node:path";
import { createHash } from "node:crypto";
import type { ShotAnimation } from "../model/types/shot.js";
import type { EditorialSequence } from "../model/types/editorial.js";
import { defineShotAnimation } from "../animation/shot.js";
import { prepareEditorial } from "../animation/editorial.js";
import {
  mixShotAudio,
  mixEditorialAudio,
  type AudioMixOptions,
  type StudioAudioDecoder,
} from "../audio/mix.js";
import { prepareTrackSelection, type AudioTrackRef } from "../audio/selection.js";
import { encodeWav } from "../audio/wav.js";
import { fingerprint } from "../core/edit-plan/fingerprint.js";
import { CodeboardError } from "../model/errors.js";
import { parseAudioStemManifest, MAX_STEM_MANIFEST_BYTES } from "./audio-stems-manifest.js";

export type AudioStemTarget =
  | { kind: "shot"; animation: ShotAnimation }
  | { kind: "editorial"; sequence: EditorialSequence; animations: readonly ShotAnimation[] };

export interface AudioStemExportOptions {
  stems: readonly { name: string; tracks: readonly AudioTrackRef[] }[];
  transitions: "sum" | "linear";
  sampleFormat?: "pcm16" | "float32";
  mix?: Omit<AudioMixOptions, "tracks">;
}

export interface AudioStemManifest {
  format: "codeboard-audio-stems/1";
  source: { kind: "shot" | "editorial"; id: string; fingerprint: string };
  sampleRate: number;
  sampleFormat: "pcm16" | "float32";
  transitions: "sum" | "linear";
  range: { startSample: number; endSample: number };
  stems: {
    name: string;
    tracks: AudioTrackRef[];
    file: string;
    sha256: string;
    bytes: number;
    samples: number;
    peak: number;
    clippedSamples: number;
  }[];
}

/** Export aligned WAV stems into a new directory; stems.json is the completion marker. */
export async function exportAudioStems(
  target: AudioStemTarget,
  decoder: StudioAudioDecoder,
  output: string,
  options: AudioStemExportOptions,
) {
  const settings = parseAudioStemOptions(options);
  if (
    typeof decoder !== "function" ||
    new Set(settings.stems.map((stem) => stem.name)).size !== settings.stems.length
  )
    throw new CodeboardError("INVALID_ARGUMENT", "Stems require a decoder and unique names");
  if (!target || (target.kind !== "shot" && target.kind !== "editorial"))
    throw new CodeboardError("INVALID_ARGUMENT", "Choose a shot or editorial audio target");
  const prepared =
    target.kind === "shot"
      ? { kind: "shot" as const, animation: defineShotAnimation(target.animation) }
      : (() => {
          const editorial = prepareEditorial(target.sequence, target.animations);
          const ids = new Set(editorial.sequence.clips.map((clip) => clip.animationId));
          return {
            kind: "editorial" as const,
            sequence: editorial.sequence,
            animations: [...editorial.sources.values()].filter((animation) =>
              ids.has(animation.id),
            ),
          };
        })();
  const owners =
    prepared.kind === "shot" ? [prepared.animation] : [prepared.sequence, ...prepared.animations];
  for (const stem of settings.stems) prepareTrackSelection(owners, stem.tracks);
  const source = {
    kind: prepared.kind,
    id: prepared.kind === "shot" ? prepared.animation.id : prepared.sequence.id,
    fingerprint: fingerprint(prepared),
  };
  const directory = resolve(output),
    parent = dirname(directory);
  settings.mix.signal?.throwIfAborted();
  await mkdir(parent, { recursive: true });
  try {
    await mkdir(directory);
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "EEXIST")
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Audio stem destination must be a new directory",
        { cause },
      );
    throw cause;
  }
  try {
    const stems: AudioStemManifest["stems"] = [];
    let range: AudioStemManifest["range"] | undefined;
    for (const [index, stem] of settings.stems.entries()) {
      settings.mix.signal?.throwIfAborted();
      const mixOptions: AudioMixOptions = {
        sampleRate: settings.mix.sampleRate,
        rounding: settings.mix.rounding,
        maxSamples: settings.mix.maxSamples,
        tracks: stem.tracks,
        ...(settings.mix.range === undefined ? {} : { range: settings.mix.range }),
        ...(settings.mix.signal === undefined ? {} : { signal: settings.mix.signal }),
      };
      const mixed =
        prepared.kind === "shot"
          ? await mixShotAudio(prepared.animation, decoder, mixOptions)
          : await mixEditorialAudio(prepared.sequence, prepared.animations, decoder, {
              ...mixOptions,
              transitions: settings.transitions,
            });
      if (
        range &&
        (range.startSample !== mixed.range.startSample || range.endSample !== mixed.range.endSample)
      )
        throw new Error("Stem sample ranges differ");
      range = mixed.range;
      if (settings.sampleFormat === "pcm16" && mixed.clippedSamples)
        throw new CodeboardError("INVALID_ARGUMENT", `Stem exceeds PCM16 full scale: ${stem.name}`);
      const bytes = encodeWav(mixed.channels, mixed.sampleRate, {
        sampleFormat: settings.sampleFormat,
      });
      const file = `stem-${String(index + 1).padStart(3, "0")}.wav`;
      settings.mix.signal?.throwIfAborted();
      await writeFile(join(directory, file), bytes, { flag: "wx" });
      stems.push({
        name: stem.name,
        tracks: stem.tracks,
        file,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        bytes: bytes.length,
        samples: mixed.channels[0].length,
        peak: mixed.peak,
        clippedSamples: mixed.clippedSamples,
      });
    }
    const manifest: AudioStemManifest = {
      format: "codeboard-audio-stems/1",
      source,
      sampleRate: settings.mix.sampleRate,
      sampleFormat: settings.sampleFormat,
      transitions: settings.transitions,
      range: range!,
      stems,
    };
    const manifestFile = join(directory, "stems.json"),
      temporary = join(directory, ".stems.json.tmp");
    parseAudioStemManifest(manifest);
    const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
    if (Buffer.byteLength(manifestJson) > MAX_STEM_MANIFEST_BYTES)
      throw new CodeboardError("RESOURCE_LIMIT", "Stem manifest exceeds 8 MiB");
    settings.mix.signal?.throwIfAborted();
    await writeFile(temporary, manifestJson, {
      encoding: "utf8",
      flag: "wx",
    });
    settings.mix.signal?.throwIfAborted();
    await rename(temporary, manifestFile);
    return { directory, manifestFile, manifest };
  } catch (error) {
    try {
      const path = relative(parent, directory);
      if (!path || path === ".." || path.startsWith(`..${sep}`) || isAbsolute(path))
        throw new Error("Unsafe stem cleanup path");
      await rm(directory, { recursive: true, force: true });
    } catch (cleanup) {
      throw new AggregateError(
        [error, cleanup],
        "Stem export failed and its directory could not be cleaned up",
      );
    }
    throw error;
  }
}
