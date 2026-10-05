import { readFileSync } from "node:fs";
import { findPackageJSON } from "node:module";
import { z } from "zod";

export function runtimeIdentity(): {
  package: string;
  version: string;
  node: string;
  platform: string;
} {
  const path = findPackageJSON(import.meta.url);
  if (!path) throw new Error("Codeboard package metadata is missing");
  const metadata = z
    .object({ name: z.string(), version: z.string() })
    .parse(JSON.parse(readFileSync(path, "utf8")));
  return {
    package: metadata.name,
    version: metadata.version,
    node: process.versions.node,
    platform: process.platform,
  };
}
