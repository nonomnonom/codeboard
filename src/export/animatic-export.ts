import { mkdir, writeFile,readFile } from "node:fs/promises";
import { join,resolve,extname } from "node:path";
import { createHash } from "node:crypto";
import type { StoryboardDocument } from "../model/types.js";
import { StoryboardProject } from "../core/project.js";
import { createRenderSession, type RenderSource } from "../render/panel-renderer.js";

function documentOf(source: RenderSource): StoryboardDocument {
  return source instanceof StoryboardProject ? source.toJSON() : structuredClone(source);
}

export interface AnimaticPackageResult {
  directory: string;
  manifestFile: string;
  frameFiles: string[];
}

export async function exportAnimaticPackage(source: RenderSource, outputDir: string,options:{assetRoot?:string;maxFrames?:number}={}): Promise<AnimaticPackageResult> {
  const document = documentOf(source);
  const framesDir = join(outputDir, "frames");
  await mkdir(framesDir, { recursive: true });
  const durationFrames = document.panels.reduce((end, panel) => Math.max(end, panel.startFrame + panel.durationFrames), 0);
  if(durationFrames>(options.maxFrames??100000))throw new Error("Frame export limit exceeded");
  const assets=[];
  for(const asset of document.assets.filter(a=>a.kind==="audio")){
    if(!options.assetRoot && !(source instanceof StoryboardProject))throw new Error("assetRoot is required for a raw document with audio");
    const bytes=options.assetRoot?await readFile(resolve(options.assetRoot,asset.path)):(source as StoryboardProject).readAsset(asset.id),checksum=createHash("sha256").update(bytes).digest("hex");
    if(asset.checksum&&asset.checksum!==checksum)throw new Error(`Asset checksum mismatch: ${asset.id}`);
    const path=`assets/${checksum}${extname(asset.path)}`;await mkdir(join(outputDir,"assets"),{recursive:true});await writeFile(join(outputDir,path),bytes);assets.push({...asset,path,checksum});
  }
  const session=createRenderSession(document);
  const frameFiles: string[] = [];
  for (let frame = 0; frame < durationFrames; frame += 1) {
    const file = join(framesDir, `${String(frame).padStart(6, "0")}.png`);
    await writeFile(file, await session.frame(frame).toBuffer("png"));
    frameFiles.push(file);
  }
  const manifest = {
    format: "codeboard-animatic-package",
    version: 1,
    projectId: document.id,
    projectVersion: document.version,
    frameRate: document.frameRate,
    durationFrames,
    framePattern: "frames/%06d.png",
    panels: document.panels.map(({ id, number, title, shotId, startFrame, durationFrames, transition }) => ({ id, number, title, shotId, startFrame, durationFrames, transition })),
    audioTracks: document.audioTracks,
    assets,
    note: "Editable project structure remains in the .cboard document. This package is a rendered PNG sequence with audio timing metadata, not a movie container.",
  };
  const manifestFile = join(outputDir, "animatic.json");
  await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { directory: outputDir, manifestFile, frameFiles };
}
