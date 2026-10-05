import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const [example, entry, ...args] = process.argv.slice(2);
if (
  !example ||
  !/^[a-z0-9-]+$/.test(example) ||
  !entry?.startsWith("src/") ||
  !entry.endsWith(".ts")
)
  throw new Error(
    "Usage: npm run run --workspace @codeboard/examples -- <example> src/<entry>.ts [arguments]",
  );
const examples = fileURLToPath(new URL("../../", import.meta.url));
const cwd = resolve(examples, example);
const script = resolve(cwd, entry);
const withinSource = relative(resolve(cwd, "src"), script);
if (isAbsolute(withinSource) || withinSource === ".." || withinSource.startsWith(`..${sep}`))
  throw new Error("Example entry must stay within its src directory");
await access(script);
const cli = fileURLToPath(new URL("../../../dist/src/cli.js", import.meta.url));
const child = spawn(process.execPath, [cli, "run", script, ...args], {
  cwd,
  stdio: "inherit",
  windowsHide: true,
});
const interrupt = () => child.kill("SIGINT");
const terminate = () => child.kill("SIGTERM");
process.on("SIGINT", interrupt);
process.on("SIGTERM", terminate);
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("close", (code, signal) => {
  process.off("SIGINT", interrupt);
  process.off("SIGTERM", terminate);
  process.exitCode = code ?? (signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 1);
});
