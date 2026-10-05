import { readdirSync, readFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { runtimeIdentity } from "./version.js";
import { findPackageJSON } from "node:module";
import sharp from "sharp";
import { renderIdentitySchema } from "../model/schema/render-identity.js";
import { nativeRendererFiles } from "./native-identity.js";

/** Conservatively bind jobs to this engine's on-disk implementation, including local edits. */
export function renderIdentity() {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const files: string[] = [];
  function collect(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) collect(path);
      else if (entry.isFile() && /\.(?:js|ts)$/.test(entry.name) && !entry.name.endsWith(".d.ts"))
        files.push(path);
    }
  }
  collect(root);
  const hash = createHash("sha256");
  for (const file of files.sort()) {
    const name = relative(root, file).replaceAll("\\", "/"),
      bytes = readFileSync(file);
    hash.update(`${Buffer.byteLength(name)}:${name}:${bytes.length}:`);
    hash.update(bytes);
  }
  const skiaPackage = findPackageJSON("skia-canvas", import.meta.url);
  if (!skiaPackage) throw new Error("Skia Canvas package metadata is missing");
  const skia = JSON.parse(readFileSync(skiaPackage, "utf8"));
  return renderIdentitySchema.parse({
    ...runtimeIdentity(),
    implementationHash: hash.digest("hex"),
    backends: {
      architecture: process.arch,
      skiaCanvas: skia.version,
      sharp: sharp.versions,
      nativeFiles: nativeRendererFiles(),
    },
  });
}
