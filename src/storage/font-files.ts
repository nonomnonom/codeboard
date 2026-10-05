import { realpathSync, fstatSync, openSync, readSync, closeSync } from "node:fs";
import { dirname, resolve, relative, isAbsolute, sep } from "node:path";
import { createHash } from "node:crypto";
import { CodeboardError } from "../model/errors.js";
import { fontFilesSchema, type FontFileDependency } from "../model/schema/font-files.js";

export function readPinnedFonts(source: string, input: FontFileDependency[]) {
  const parsed = fontFilesSchema.safeParse(input);
  if (!parsed.success) throw new CodeboardError("INVALID_ARGUMENT", "Invalid font files");
  const root = realpathSync(dirname(resolve(source)));
  const files: (FontFileDependency & { bytes: Buffer })[] = [];
  let total = 0;
  for (const font of parsed.data) {
    let path: string, bytes: Buffer;
    try {
      path = realpathSync(resolve(root, font.path));
      const local = relative(root, path);
      if (isAbsolute(local) || local === ".." || local.startsWith(`..${sep}`))
        throw new CodeboardError("INVALID_ARGUMENT", "Font file escapes the source directory");
      const descriptor = openSync(path, "r");
      try {
        const stats = fstatSync(descriptor),
          size = stats.size;
        if (!stats.isFile())
          throw new CodeboardError("INVALID_ARGUMENT", "Font path must be a regular file");
        total += size;
        if (size > 32 * 1024 * 1024 || total > 128 * 1024 * 1024)
          throw new CodeboardError(
            "RESOURCE_LIMIT",
            "Pinned fonts exceed the 32 MiB file / 128 MiB total budget",
          );
        bytes = Buffer.alloc(size);
        let offset = 0;
        while (offset < size) {
          const count = readSync(descriptor, bytes, offset, size - offset, null);
          if (count === 0)
            throw new CodeboardError("REVISION_CONFLICT", "Font changed during read");
          offset += count;
        }
        if (readSync(descriptor, Buffer.alloc(1), 0, 1, null) !== 0)
          throw new CodeboardError("REVISION_CONFLICT", "Font changed during read");
      } finally {
        closeSync(descriptor);
      }
    } catch (cause) {
      if (cause instanceof CodeboardError) throw cause;
      throw new CodeboardError("ASSET_MISSING", "Font file is unavailable", {
        details: { path: font.path },
        cause,
      });
    }
    if (createHash("sha256").update(bytes).digest("hex") !== font.sha256)
      throw new CodeboardError("ASSET_CHECKSUM_MISMATCH", "Font checksum differs", {
        details: { path: font.path },
      });
    files.push({ ...font, bytes });
  }
  return files;
}
