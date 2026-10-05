import { unzipSync } from "fflate";

export function readBundle(data: Buffer): Record<string, Buffer> {
  let expanded = 0,
    count = 0;
  const entries = unzipSync(data, {
    filter: (entry) => {
      expanded += entry.originalSize;
      if (++count > 4096 || entry.originalSize > 16 * 1024 * 1024 || expanded > 64 * 1024 * 1024)
        throw new Error("Bundle exceeds entry/decompression limits");
      if (entry.name.includes("..") || entry.name.startsWith("/") || entry.name.includes("\\"))
        throw new Error("Unsafe bundle entry path");
      return true;
    },
  });
  const deps = Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, Buffer.from(v)]));
  return deps;
}
