import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, relative } from "node:path";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = resolve(root, "dist");
if (relative(root, output) !== "dist") throw new Error("Invalid build output target");
await rm(output, { recursive: true, force: true });
const result = spawnSync(
  process.execPath,
  [resolve(root, "node_modules/typescript/bin/tsc"), "-p", resolve(root, "tsconfig.json")],
  { stdio: "inherit", windowsHide: true },
);
process.exit(result.status ?? 1);
