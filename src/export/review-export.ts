import { mkdir, mkdtemp, writeFile, rename, rm } from "node:fs/promises";
import { join, resolve, dirname, basename } from "node:path";
import { createHash } from "node:crypto";
import { CodeboardError } from "../model/errors.js";
import { renderFramePNG } from "../render/panel-renderer.js";
import {
  parseReviewOptions,
  type ReviewExportOptions,
  type ReviewManifest,
} from "./review-contract.js";
import { prepareReviewSource } from "./review-source.js";
import { readReviewManifest, MAX_REVIEW_MANIFEST_BYTES } from "./review-manifest.js";
export type {
  ReviewTarget,
  ReviewFrameSource,
  ReviewExportOptions,
  ReviewManifest,
} from "./review-contract.js";

/** Render one saved snapshot; manifest.json is published only after every PNG succeeds. */
export async function exportReview(
  projectPath: string,
  outputRoot: string,
  options: ReviewExportOptions,
): Promise<{ directory: string; manifestFile: string; manifest: ReviewManifest }> {
  const input = parseReviewOptions(options);
  const checkCancelled = () => {
    if (input.signal?.aborted) throw new CodeboardError("CANCELLED", "Review export cancelled");
  };
  checkCancelled();
  const { document, session, selected, manifest } = prepareReviewSource(projectPath, input);
  const root = resolve(outputRoot);
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(join(root, "review-"));
  try {
    let totalBytes = 0;
    for (const [index, { frame, source, canvases }] of selected.entries()) {
      checkCancelled();
      const png = session
        ? await session.png(frame)
        : await renderFramePNG(document, frame, { annotations: manifest.settings.annotations });
      checkCancelled();
      totalBytes += png.byteLength;
      if (totalBytes > 128 * 1024 * 1024)
        throw new CodeboardError("RESOURCE_LIMIT", "Review PNG data exceeds 128 MiB");
      const file = `${String(index + 1).padStart(3, "0")}-frame-${frame}.png`;
      await writeFile(join(directory, file), png, { flag: "wx" });
      manifest.frames.push({
        frame,
        file,
        sha256: createHash("sha256").update(png).digest("hex"),
        bytes: png.byteLength,
        width: canvases[0]!.width,
        height: canvases[0]!.height,
        source,
      });
    }
    checkCancelled();
    const manifestFile = join(directory, "manifest.json"),
      temporary = join(directory, "manifest.pending");
    readReviewManifest(manifest);
    const manifestJSON = `${JSON.stringify(manifest, null, 2)}\n`;
    if (Buffer.byteLength(manifestJSON) > MAX_REVIEW_MANIFEST_BYTES)
      throw new CodeboardError("RESOURCE_LIMIT", "Review manifest exceeds 2 MiB");
    await writeFile(temporary, manifestJSON, { flag: "wx" });
    checkCancelled();
    await rename(temporary, manifestFile);
    return { directory, manifestFile, manifest };
  } catch (error) {
    if (dirname(directory) !== root || !basename(directory).startsWith("review-")) throw error;
    try {
      await rm(directory, { recursive: true, force: true });
    } catch (cleanup) {
      throw new AggregateError(
        [error, cleanup],
        `Review failed; incomplete output remains at ${directory}`,
      );
    }
    throw error;
  }
}
