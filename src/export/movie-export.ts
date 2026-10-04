import { spawn } from "node:child_process";
import { mkdir, rename, unlink, readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { dirname, resolve, join, extname } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { once } from "node:events";
import { StoryboardProject } from "../core/project.js";
import { createRenderSession, type RenderSource } from "../render/panel-renderer.js";
import {encodePNG} from "../render/png.js";
import type {StoryboardDocument} from "../model/types.js";

export interface MovieOptions {
  ffmpegPath?: string;
  assetRoot?: string;
  maxFrames?: number;
  signal?: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
}

export async function exportMovie(source: RenderSource, output: string, options: MovieOptions = {}) {
  const doc=source instanceof StoryboardProject?source.toJSON():structuredClone(source);
  if(options.assetRoot) return exportMovieFiles(doc,output,options);
  if(!doc.audioTracks.some(t=>!t.muted&&t.clips.length)) return exportMovieFiles(doc,output,options);
  if(!(source instanceof StoryboardProject)) throw new Error("assetRoot is required for a raw document with audio");
  const parent=dirname(resolve(output));await mkdir(parent,{recursive:true});
  const temporary=await mkdtemp(join(parent,".codeboard-audio-"));
  try {
    for(let i=0;i<doc.assets.length;i++) {
      const asset=doc.assets[i]!;
      if(!doc.audioTracks.some(t=>!t.muted&&t.clips.some(c=>c.assetId===asset.id)))continue;
      const bytes=source.readAsset(asset.id);
      asset.path=`asset-${i}${extname(asset.path)}`;
      await writeFile(join(temporary,asset.path),bytes);
    }
    return await exportMovieFiles(doc,output,{...options,assetRoot:temporary});
  }finally{await rm(temporary,{recursive:true,force:true});}
}

async function exportMovieFiles(doc: StoryboardDocument, output: string, options: MovieOptions) {
  const session = createRenderSession(doc);
  const total = session.durationFrames;
  if (!total || total > (options.maxFrames ?? 100000)) throw new Error("Movie frame count exceeds export limit or is empty");
  if (doc.panels.some(p => p.width !== doc.canvas.width || p.height !== doc.canvas.height)) throw new Error("Movie panels must share the project dimensions");
  if (doc.canvas.width % 2 || doc.canvas.height % 2) throw new Error("H.264 export requires even frame dimensions");
  const clips = doc.audioTracks.filter(t => !t.muted).flatMap(t => t.clips);
  const args = ["-hide_banner", "-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", String(doc.frameRate), "-vcodec", "png", "-i", "pipe:0"];
  const filters: string[] = [];
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i]!;
    const asset = doc.assets.find(a => a.id === clip.assetId)!;
    const path = resolve(options.assetRoot!, asset.path);
    const bytes = await readFile(path);
    if (asset.checksum && createHash("sha256").update(bytes).digest("hex") !== asset.checksum) throw new Error(`Asset checksum mismatch: ${asset.id}`);
    args.push("-i", path);
    const duration = clip.durationFrames / doc.frameRate;
    const chain = ["aresample=48000",`atrim=start_sample=${Math.round(clip.sourceInFrame/doc.frameRate*48000)}:end_sample=${Math.round((clip.sourceInFrame+clip.durationFrames)/doc.frameRate*48000)}`, "asetpts=N/SR/TB", `volume=${clip.volume}`];
    if (clip.fadeInFrames) chain.push(`afade=t=in:d=${clip.fadeInFrames/doc.frameRate}`);
    if (clip.fadeOutFrames) chain.push(`afade=t=out:st=${duration-clip.fadeOutFrames/doc.frameRate}:d=${clip.fadeOutFrames/doc.frameRate}`);
    chain.push(`adelay=${Math.round(clip.startFrame/doc.frameRate*48000)}S:all=1`);
    filters.push(`[${i+1}:a]${chain.join(",")}[a${i}]`);
  }
  if (clips.length) {
    const samples=Math.round(total/doc.frameRate*48000);
    filters.push(`${clips.map((_,i)=>`[a${i}]`).join("")}${clips.length===1?"anull":`amix=inputs=${clips.length}:normalize=0`},asetpts=N/SR/TB,apad=whole_len=${samples},atrim=end_sample=${samples}[mix]`);
    args.push("-filter_complex", filters.join(";"), "-map", "0:v", "-map", "[mix]", "-c:a", "aac", "-ar", "48000", "-b:a", "192k");
  } else args.push("-map", "0:v", "-an");
  await mkdir(dirname(resolve(output)), { recursive: true });
  const temporary = `${resolve(output)}.${randomUUID()}.mp4`;
  args.push("-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-threads", "2", "-movflags", "+faststart", "-t", String(total/doc.frameRate), temporary);
  const started = performance.now();
  let peakRss=process.memoryUsage().rss;
  const child = spawn(options.ffmpegPath ?? process.env.FFMPEG_PATH ?? "ffmpeg", args, { windowsHide: true, stdio: ["pipe", "ignore", "pipe"], ...(options.signal ? { signal: options.signal } : {}) });
  let error: Error | undefined;
  let stderr = "";
  child.stderr.on("data", (data: Buffer) => { stderr = (stderr + data.toString()).slice(-12000); });
  child.on("error", e => { error = e; });
  child.stdin.on("error", e => { error = e; });
  const finished = new Promise<number | null>(ready => child.on("close", ready));
  try {
    for (let frame = 0; frame < total; frame++) {
      options.signal?.throwIfAborted();
      if (error) throw error;
      const png = await encodePNG(session.frame(frame));
      if (!child.stdin.write(png)) await once(child.stdin, "drain");
      options.onProgress?.(frame+1,total);
      peakRss=Math.max(peakRss,process.memoryUsage().rss);
    }
    child.stdin.end();
    const code = await finished;
    if (error || code !== 0) throw new Error(`FFmpeg failed (${code}): ${error?.message ?? stderr}`);
    await rename(temporary, resolve(output));
    return { file: resolve(output), frames: total, seconds: total/doc.frameRate, renderSeconds: (performance.now()-started)/1000,peakRssBytes:peakRss };
  } finally {
    if (child.exitCode === null) child.kill();
    await finished;
    await unlink(temporary).catch(() => {});
  }
}
