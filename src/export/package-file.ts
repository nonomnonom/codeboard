import { lstat, open, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import { CodeboardError } from "../model/errors.js";

/** Stream a bounded regular package entry; callers supply a canonical package root. */
export async function* readPackageFile(
  root: string,
  name: string,
  limit: number,
  signal?: AbortSignal,
) {
  const parts = name.split("/");
  if (
    parts.some(
      (part) => !part || part === "." || part === ".." || /[:\\]/.test(part) || part.includes("\0"),
    )
  )
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid package file path");
  let path = root;
  for (const [index, part] of parts.entries()) {
    path = join(path, part);
    const stat = await lstat(path);
    if (stat.isSymbolicLink() || (index < parts.length - 1 ? !stat.isDirectory() : !stat.isFile()))
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Package entries must be regular files/directories, not links",
      );
  }
  const resolved = await realpath(path),
    inside = relative(root, resolved);
  if (!inside || inside === ".." || inside.startsWith(`..${sep}`) || isAbsolute(inside))
    throw new CodeboardError("INVALID_ARGUMENT", "Package file is outside its directory");
  const file = await open(resolved, "r");
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > limit)
      throw new CodeboardError("RESOURCE_LIMIT", "Package file exceeds its byte limit", {
        details: { name, limit },
      });
    let total = 0;
    while (true) {
      signal?.throwIfAborted();
      const chunk = Buffer.allocUnsafe(Math.min(65536, limit + 1 - total));
      const { bytesRead } = await file.read(chunk);
      if (!bytesRead) break;
      total += bytesRead;
      if (total > limit)
        throw new CodeboardError("RESOURCE_LIMIT", "Package file grew beyond its byte limit");
      yield chunk.subarray(0, bytesRead);
    }
  } finally {
    await file.close();
  }
}
