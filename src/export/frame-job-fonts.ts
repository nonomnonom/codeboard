import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join, extname } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { FontLibrary } from "skia-canvas";
import type { FontFileDependency as FrameJobFontFile } from "../model/schema/font-files.js";
import { readPinnedFonts } from "../storage/font-files.js";
import type { StoryboardDocument } from "../model/types.js";
import { iterateLayers } from "../model/layers.js";
import { CodeboardError } from "../model/errors.js";
import { substituteFontFamilies } from "../render/font-families.js";

/** Rewrite only the private render document; saved text retains its authored family names. */
export function prepareJobFonts(
  document: StoryboardDocument,
  source: string,
  input?: FrameJobFontFile[],
): () => void {
  if (input === undefined) return () => {};
  const groups = new Map<string, ReturnType<typeof readPinnedFonts>>();
  for (const file of readPinnedFonts(source, input)) {
    const family = file.family.toLowerCase();
    const group = groups.get(family) ?? [];
    group.push(file);
    groups.set(family, group);
  }
  const aliases = new Map<string, string>();
  for (const [family, files] of groups) {
    const alias = `CodeboardPinned_${createHash("sha256")
      .update(JSON.stringify(files.map((file) => file.sha256)))
      .digest("hex")}`;
    if (!FontLibrary.has(alias)) {
      const directory = mkdtempSync(join(tmpdir(), "codeboard-font-"));
      try {
        const paths = files.map((file, index) => {
          const path = join(directory, `${index}${extname(file.path)}`);
          writeFileSync(path, file.bytes, { flag: "wx" });
          return path;
        });
        FontLibrary.use(alias, paths);
      } catch (cause) {
        throw new CodeboardError("MISSING_DEPENDENCY", "Pinned font could not be loaded", {
          details: { family },
          cause,
        });
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    }
    aliases.set(family, alias);
  }
  for (const owner of [...document.panels, ...document.components, ...document.studio.animations])
    for (const layer of iterateLayers(owner.layers)) {
      if (layer.kind === "group") continue;
      for (const element of layer.elements)
        if (element.kind === "text") element.font = substituteFontFamilies(element.font, aliases);
    }
  return () => {
    for (const [family, alias] of aliases)
      if (!FontLibrary.has(alias))
        throw new CodeboardError(
          "MISSING_DEPENDENCY",
          "Pinned font registry changed during rendering",
          { details: { family } },
        );
  };
}
