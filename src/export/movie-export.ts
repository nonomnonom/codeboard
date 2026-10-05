import { encodeMovie, assertMovieFrames, type MovieEncodingOptions } from "./movie-encoder.js";
import { createTimeMapper } from "../animation/rational-time.js";
import { mkdir, readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { dirname, resolve, join, extname } from "node:path";
import { createHash } from "node:crypto";
import { snapshotDocument, isProjectSource } from "../render/source.js";
import { createRenderSession, type RenderSource } from "../render/panel-renderer.js";
import { encodePNG } from "../render/png.js";
import type { StoryboardDocument } from "../model/types.js";
import { checkBoardFonts, type FontPolicy } from "../render/fonts.js";

export interface MovieOptions extends MovieEncodingOptions {
  fontPolicy?: FontPolicy;
  assetRoot?: string;
}

export async function exportMovie(
  source: RenderSource,
  output: string,
  options: MovieOptions = {},
) {
  const settings = { ...options };
  const doc = snapshotDocument(source);
  checkBoardFonts(doc, settings.fontPolicy);
  if (settings.assetRoot) return exportMovieFiles(doc, output, settings);
  if (!doc.audioTracks.some((t) => !t.muted && t.clips.length))
    return exportMovieFiles(doc, output, settings);
  if (!isProjectSource(source))
    throw new Error("assetRoot is required for a raw document with audio");
  const readAsset = source.captureAssetReader();
  const parent = dirname(resolve(output));
  await mkdir(parent, { recursive: true });
  const temporary = await mkdtemp(join(parent, ".codeboard-audio-"));
  try {
    for (let i = 0; i < doc.assets.length; i++) {
      const asset = doc.assets[i]!;
      if (!doc.audioTracks.some((t) => !t.muted && t.clips.some((c) => c.assetId === asset.id)))
        continue;
      const bytes = readAsset(asset.id);
      asset.path = `asset-${i}${extname(asset.path)}`;
      await writeFile(join(temporary, asset.path), bytes);
    }
    return await exportMovieFiles(doc, output, { ...settings, assetRoot: temporary });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

async function exportMovieFiles(doc: StoryboardDocument, output: string, options: MovieOptions) {
  const session = createRenderSession(doc);
  const total = session.durationFrames;
  assertMovieFrames(total, options.maxFrames);
  if (doc.panels.some((p) => p.width !== doc.canvas.width || p.height !== doc.canvas.height))
    throw new Error("Movie panels must share the project dimensions");
  if (doc.canvas.width % 2 || doc.canvas.height % 2)
    throw new Error("H.264 export requires even frame dimensions");
  const clips = doc.audioTracks.filter((t) => !t.muted).flatMap((t) => t.clips);
  const samplePosition = createTimeMapper(doc.frameRate, 48000);
  const args: string[] = [];
  const filters: string[] = [];
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i]!;
    const asset = doc.assets.find((a) => a.id === clip.assetId)!;
    const path = resolve(options.assetRoot!, asset.path);
    const bytes = await readFile(path);
    if (asset.checksum && createHash("sha256").update(bytes).digest("hex") !== asset.checksum)
      throw new Error(`Asset checksum mismatch: ${asset.id}`);
    args.push("-i", path);
    const duration = clip.durationFrames / doc.frameRate;
    const chain = [
      "aresample=48000",
      `atrim=start_sample=${samplePosition(clip.sourceInFrame).value}:end_sample=${samplePosition(clip.sourceInFrame + clip.durationFrames).value}`,
      "asetpts=N/SR/TB",
      `volume=${clip.volume}`,
    ];
    if (clip.fadeInFrames) chain.push(`afade=t=in:d=${clip.fadeInFrames / doc.frameRate}`);
    if (clip.fadeOutFrames)
      chain.push(
        `afade=t=out:st=${duration - clip.fadeOutFrames / doc.frameRate}:d=${clip.fadeOutFrames / doc.frameRate}`,
      );
    chain.push(`adelay=${samplePosition(clip.startFrame).value}S:all=1`);
    filters.push(`[${i + 1}:a]${chain.join(",")}[a${i}]`);
  }
  if (clips.length) {
    const samples = samplePosition(total).value;
    filters.push(
      `${clips.map((_, i) => `[a${i}]`).join("")}${clips.length === 1 ? "anull" : `amix=inputs=${clips.length}:normalize=0`},asetpts=N/SR/TB,apad=whole_len=${samples},atrim=end_sample=${samples}[mix]`,
    );
    args.push(
      "-filter_complex",
      filters.join(";"),
      "-map",
      "0:v",
      "-map",
      "[mix]",
      "-c:a",
      "aac",
      "-ar",
      "48000",
      "-b:a",
      "192k",
    );
  } else args.push("-map", "0:v", "-an");
  return encodeMovie(
    output,
    total,
    doc.frameRate,
    (frame) => encodePNG(session.frame(frame)),
    args,
    options,
  );
}
