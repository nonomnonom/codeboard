import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const result = spawnSync(
  process.execPath,
  [
    fileURLToPath(new URL("../node_modules/vitest/vitest.mjs", import.meta.url)),
    "run",
    "--project",
    "e2e",
    "test/e2e/package.test.ts",
  ],
  {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    stdio: "inherit",
    windowsHide: true,
    env: {
      ...process.env,
      CODEBOARD_TEST_INSTALL: process.argv.includes("--install") ? "1" : "0",
    },
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
