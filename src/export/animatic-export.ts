import { mkdir, writeFile, readFile, rename, rm } from "node:fs/promises";
import { join, resolve, extname, dirname, relative, isAbsolute, sep } from "node:path";
import { createHash } from "node:crypto";
import { snapshotDocument, isProjectSource } from "../render/source.js";
import { encodePNG } from "../render/png.js";
import { createRenderSession, type RenderSource } from "../render/panel-renderer.js";
import { assertFrameLimit } from "./limits.js";
import { CodeboardError } from "../model/errors.js";

export interface AnimaticPackageResult {
  directory: string;
  manifestFile: string;
  frameFiles: string[];
}

export async function exportAnimaticPackage(
  source: RenderSource,
  outputDir: string,
  options: { assetRoot?: string; maxFrames?: number; signal?: AbortSignal } = {},
): Promise<AnimaticPackageResult> {
  options.signal?.throwIfAborted();
  const document = snapshotDocument(source);
  const settings = { ...options };
  const session = createRenderSession(document);
  const durationFrames = session.durationFrames;
  const audioAssets = document.assets.filter((asset) => asset.kind === "audio");
  assertFrameLimit(durationFrames, settings.maxFrames);
  if (!settings.assetRoot && !isProjectSource(source) && audioAssets.length > 0)
    throw new Error("assetRoot is required for a raw document with audio");
  const readAsset =
    !settings.assetRoot && audioAssets.length > 0 && isProjectSource(source)
      ? source.captureAssetReader()
      : undefined;
  const directory = resolve(outputDir),
    parent = dirname(directory);
  await mkdir(parent, { recursive: true });
  settings.signal?.throwIfAborted();
  try {
    await mkdir(directory);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST")
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Animatic output directory must not already exist",
        { details: { directory }, cause: error },
      );
    throw error;
  }
  try {
    const framesDir = join(directory, "frames");
    await mkdir(framesDir, { recursive: true });
    const assets = [];
    for (const asset of audioAssets) {
      settings.signal?.throwIfAborted();
      let bytes: Buffer;
      if (settings.assetRoot) bytes = await readFile(resolve(settings.assetRoot, asset.path));
      else if (readAsset) bytes = readAsset(asset.id);
      else throw new Error("assetRoot is required for a raw document with audio");
      settings.signal?.throwIfAborted();
      const checksum = createHash("sha256").update(bytes).digest("hex");
      if (asset.checksum && asset.checksum !== checksum)
        throw new Error(`Asset checksum mismatch: ${asset.id}`);
      const path = `assets/${checksum}${extname(asset.path)}`;
      await mkdir(join(directory, "assets"), { recursive: true });
      await writeFile(join(directory, path), bytes);
      assets.push({ ...asset, path, checksum });
    }
    const frameFiles: string[] = [];
    for (let frame = 0; frame < durationFrames; frame += 1) {
      settings.signal?.throwIfAborted();
      const file = join(framesDir, `${String(frame).padStart(6, "0")}.png`);
      const png = await encodePNG(session.frame(frame));
      settings.signal?.throwIfAborted();
      await writeFile(file, png, { flag: "wx" });
      frameFiles.push(file);
    }
    const manifest = {
      format: "codeboard-animatic-package",
      version: 1,
      projectId: document.id,
      projectVersion: document.version,
      frameRate: document.frameRate,
      durationFrames,
      framePattern: "frames/%06d.png",
      panels: document.panels.map(
        ({ id, number, title, shotId, startFrame, durationFrames, transition }) => ({
          id,
          number,
          title,
          shotId,
          startFrame,
          durationFrames,
          transition,
        }),
      ),
      audioTracks: document.audioTracks,
      assets,
      note: "Editable project structure remains in the .cboard document. This package is a rendered PNG sequence with audio timing metadata, not a movie container.",
    };
    const manifestFile = join(directory, "animatic.json");
    const temporaryManifest = join(directory, ".animatic.json.tmp");
    settings.signal?.throwIfAborted();
    await writeFile(temporaryManifest, `${JSON.stringify(manifest, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    settings.signal?.throwIfAborted();
    await rename(temporaryManifest, manifestFile);
    return { directory, manifestFile, frameFiles };
  } catch (error) {
    try {
      const path = relative(parent, directory);
      if (!path || path === ".." || path.startsWith(`..${sep}`) || isAbsolute(path))
        throw new Error("Unsafe animatic cleanup path");
      await rm(directory, { recursive: true, force: true });
    } catch (cleanup) {
      throw new AggregateError(
        [error, cleanup],
        "Animatic export failed and its directory could not be cleaned up",
      );
    }
    throw error;
  }
}
