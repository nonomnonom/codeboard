import { openSync, readSync, closeSync } from "node:fs";
import { basename } from "node:path";
import { createHash } from "node:crypto";
import { CodeboardError } from "../model/errors.js";

const rendererBinary =
  /^(?:skia\.node|sharp[^/\\]*\.node|libvips[^/\\]*\.(?:dll|dylib|so(?:\.\d+)*))$/i;

/** Hash loaded renderer addons and libvips; never serialize the diagnostic report itself. */
export function nativeRendererFiles(): Record<string, string> {
  const { excludeEnv } = process.report;
  let report: object;
  try {
    process.report.excludeEnv = true;
    report = process.report.getReport();
  } finally {
    process.report.excludeEnv = excludeEnv;
  }
  const shared = "sharedObjects" in report ? report.sharedObjects : undefined;
  if (!Array.isArray(shared) || shared.some((path) => typeof path !== "string"))
    throw new CodeboardError("MISSING_DEPENDENCY", "Cannot inspect loaded native renderer files");
  const paths = [...new Set<string>(shared)].filter((path) => rendererBinary.test(basename(path)));
  if (paths.length > 32)
    throw new CodeboardError("RESOURCE_LIMIT", "Native renderer identity exceeds 32 files");
  const entries = new Map<string, string>();
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  for (const path of paths) {
    const file = openSync(path, "r"),
      hash = createHash("sha256");
    try {
      let total = 0;
      while (true) {
        const bytes = readSync(file, buffer, 0, buffer.length, null);
        if (bytes === 0) break;
        total += bytes;
        if (total > 256 * 1024 * 1024)
          throw new CodeboardError("RESOURCE_LIMIT", "Native renderer file exceeds 256 MiB");
        hash.update(buffer.subarray(0, bytes));
      }
    } finally {
      closeSync(file);
    }
    const name = basename(path),
      digest = hash.digest("hex");
    if (entries.has(name) && entries.get(name) !== digest)
      throw new CodeboardError(
        "MISSING_DEPENDENCY",
        "Multiple different native renderer files share a name",
        {
          details: { name },
        },
      );
    entries.set(name, digest);
  }
  return Object.fromEntries([...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}
