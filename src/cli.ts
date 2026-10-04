#!/usr/bin/env node
import { Command } from "commander";
import { readFileSync } from "node:fs";
import { findPackageJSON } from "node:module";
import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { starter } from "./starter.js";
import { confirmUpdate, installUpdate, latestRelease, newerRelease, notifyUpdate } from "./updates.js";
import { exportMovie } from "./export/movie-export.js";
import { StoryboardProject } from "./core/project.js";
import { exportStoryboard } from "./export/storyboard-export.js";
import { exportAnimaticPackage } from "./export/animatic-export.js";
import { startPreview } from "./preview/server.js";
import { ProjectStore } from "./storage/store.js";

const packagePath = findPackageJSON(import.meta.url);
if (!packagePath) throw new Error("Codeboard package metadata is missing");
const { version } = JSON.parse(readFileSync(packagePath, "utf8")) as { version: string };

const program = new Command()
  .name("codeboard")
  .enablePositionalOptions()
  .description("Draw, animate, and render through JavaScript or TypeScript")
  .version(version);

program.hook("preAction", async (_command, action) => {
  if (action.name() !== "update") await notifyUpdate(packagePath, version);
});

program.command("update")
  .description("Check for and install the latest stable GitHub release")
  .option("--check", "Check without installing")
  .option("-y, --yes", "Install without an interactive confirmation")
  .action(async (options: { check?: boolean; yes?: boolean }) => {
    try {
      const latest = await latestRelease();
      if (!newerRelease(latest, version)) { console.log(`Codeboard ${version} is up to date (latest stable: ${latest}).`); return; }
      console.log(`Codeboard ${latest} is available (installed: ${version}).`);
      if (!options.check && (options.yes || await confirmUpdate())) await installUpdate(packagePath, version, latest);
    } catch (error) { program.error(error instanceof Error ? error.message : String(error)); }
  });

program.command("init")
  .argument("[file]", "New JavaScript authoring file", "scene.mjs")
  .action(async (file: string) => {
    await writeFile(resolve(file), starter, { flag: "wx" });
    console.log(`Created ${file}. Run: codeboard run ${JSON.stringify(file)}`);
  });

program.command("run")
  .argument("<script>", "JavaScript or TypeScript authoring file")
  .argument("[arguments...]", "Arguments passed to your script")
  .passThroughOptions()
  .action(async (script: string, args: string[]) => {
    const child = spawn(process.execPath, [fileURLToPath(new URL("./authoring-runner.js", import.meta.url)), resolve(script), ...args], {
      stdio: "inherit", windowsHide: true,
    });
    const forward = () => child.kill("SIGINT");
    process.on("SIGINT", forward);
    try {
      process.exitCode = await new Promise<number>((accept, reject) => {
        child.once("error", reject);
        child.once("exit", (code) => accept(code ?? 1));
      });
    } finally { process.off("SIGINT", forward); }
  });

program.command("render")
  .argument("<project>", "Path to a .cboard file")
  .option("-o, --output <directory>", "Export directory", "storyboard-export")
  .option("--columns <number>", "Panels per sheet row", "2")
  .option("--rows <number>", "Panel rows per sheet page", "2")
  .action(async (projectPath: string, options: { output: string; columns: string; rows: string }) => {
    const project = await StoryboardProject.open(resolve(projectPath));
    const result = await exportStoryboard(project, resolve(options.output), { columns: Number(options.columns), rows: Number(options.rows) });
    console.log(`Rendered ${result.panelFiles.length} panels and ${result.pdfFile}`);
  });

program.command("validate")
  .argument("<project>", "Path to a .cboard file")
  .action(async (projectPath: string) => {
    const store=ProjectStore.open(resolve(projectPath));
    try { store.verify(); console.log(JSON.stringify(store.inspect(),null,2)); } finally { store.close(); }
  });

program.command("animatic")
  .argument("<project>", "Path to a .cboard file")
  .option("-o, --output <directory>", "Animatic package directory", "animatic-export")
  .action(async (projectPath: string, options: { output: string }) => {
    const project = await StoryboardProject.open(resolve(projectPath));
    const result = await exportAnimaticPackage(project, resolve(options.output));
    console.log(`Rendered ${result.frameFiles.length} frames and ${result.manifestFile}`);
  });

program.command("preview")
  .argument("<project>", "Path to a .cboard file")
  .option("-p, --port <number>", "Preview port", "4173")
  .action(async (projectPath: string, options: { port: string }) => {
    await startPreview(resolve(projectPath), { port: Number(options.port) });
  });

program.command("movie").argument("<project>").requiredOption("-o, --output <file>").option("--ffmpeg <path>")
  .action(async (path: string, options: {output: string; ffmpeg?: string}) => {
    const project = await StoryboardProject.open(resolve(path));
    console.log(await exportMovie(project, options.output, { onProgress:(n,total)=>{if(n%24===0)console.log(`${n}/${total} frames`);}, ...(options.ffmpeg ? {ffmpegPath: options.ffmpeg} : {}) }));
  });

program.command("inspect").argument("<project>").option("--panel <id>").option("--name <text>").option("--limit <number>","Result count (maximum 200)","50").option("--offset <number>","Skip matching objects","0").action((path:string,options:{panel?:string;name?:string;limit:string;offset:string})=>{
  const store=ProjectStore.open(resolve(path));
  try{console.log(JSON.stringify({storage:store.inspect(),objects:store.findObjects({limit:Number(options.limit),offset:Number(options.offset),...options.panel?{panelId:options.panel}:{},...options.name?{name:options.name}:{}})},null,2));}finally{store.close();}
});

await program.parseAsync();
