#!/usr/bin/env node
import { Command, CommanderError } from "commander";
import { registerAuthoringCommands } from "./cli/authoring.js";
import { registerInspectionCommands } from "./cli/inspection.js";
import { registerDeliveryCommands } from "./cli/delivery.js";
import { registerAudioCommands } from "./cli/audio.js";
import { registerFrameJobCommands } from "./cli/frame-jobs.js";
import { registerDocsCommands } from "./cli/docs.js";
import { readFileSync } from "node:fs";
import { findPackageJSON } from "node:module";
import { resolve } from "node:path";

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { commandErrorReport } from "./cli/error-report.js";

const packagePath = findPackageJSON(import.meta.url);
if (!packagePath) throw new Error("Codeboard package metadata is missing");
const { version } = JSON.parse(readFileSync(packagePath, "utf8")) as { version: string };

const program = new Command()
  .exitOverride()
  .configureOutput({
    outputError: () => {
      // The parse rejection handler emits the error once as JSON.
    },
  })
  .name("codeboard")
  .enablePositionalOptions()
  .description("Draw, animate, and render through JavaScript or TypeScript")
  .version(version);

registerDeliveryCommands(program);
registerAuthoringCommands(program);
registerInspectionCommands(program);
registerAudioCommands(program);
registerFrameJobCommands(program);
registerDocsCommands(program, version);

program
  .command("run")
  .argument("<script>", "JavaScript or TypeScript authoring file")
  .argument("[arguments...]", "Arguments passed to your script")
  .passThroughOptions()
  .action(async (script: string, args: string[]) => {
    const child = spawn(
      process.execPath,
      [fileURLToPath(new URL("./authoring-runner.js", import.meta.url)), resolve(script), ...args],
      {
        stdio: "inherit",
        windowsHide: true,
      },
    );
    const forward = () => child.kill("SIGINT");
    process.on("SIGINT", forward);
    try {
      process.exitCode = await new Promise<number>((accept, reject) => {
        child.once("error", reject);
        child.once("exit", (code) => accept(code ?? 1));
      });
    } finally {
      process.off("SIGINT", forward);
    }
  });

program
  .command("preview")
  .argument("<project>", "Path to a .cboard file")
  .option("-p, --port <number>", "Preview port", "4173")
  .action(async (projectPath: string, options: { port: string }) => {
    const { startPreview } = await import("./preview/server.js");
    await startPreview(resolve(projectPath), { port: Number(options.port) });
  });

await program.parseAsync().catch((error: unknown) => {
  if (
    error instanceof CommanderError &&
    ["commander.help", "commander.helpDisplayed", "commander.version"].includes(error.code)
  ) {
    process.exitCode = error.exitCode;
    return;
  }
  console.error(JSON.stringify({ error: commandErrorReport(error) }));
  process.exitCode = 1;
});
