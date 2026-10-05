import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const result = spawnSync(
  process.execPath,
  [
    fileURLToPath(new URL("../node_modules/jest/bin/jest.js", import.meta.url)),
    "test/studies-assets.test.ts",
    "--runInBand",
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
