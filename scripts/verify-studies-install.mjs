import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const result = spawnSync(
  process.execPath,
  [
    fileURLToPath(new URL("../node_modules/vitest/vitest.mjs", import.meta.url)),
    "run",
    "--project",
    process.env.FFMPEG_PATH && process.env.FFPROBE_PATH ? "media" : "e2e",
    "test/e2e/studies-assets.test.ts",
  ],
  {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
    env: { ...process.env, CODEBOARD_STUDIES_NETWORK_INSTALL: "1" },
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
