#!/usr/bin/env node
import { Command } from "commander";
import { readFileSync } from "node:fs";
import { findPackageJSON } from "node:module";
import { resolve } from "node:path";
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
  .description("Render, validate, and preview code-authored storyboard projects")
  .version(version);

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
