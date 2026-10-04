import { Canvas } from "skia-canvas";
import type { StoryboardDocument, Layer } from "../model/types.js";
import { StoryboardProject } from "../core/project.js";
import { compositeLayers, RenderCache } from "./layer-compositor.js";
import { drawMotionAnnotations } from "./annotations.js";
import { evaluateCamera } from "../animation/evaluate.js";
import {parseStoryboardDocument} from "../model/validate.js";
import {assertRenderFrame,selectFramePanels} from "../animation/frame.js";
import {isDrawingColor} from "../drawing/color.js";
import {encodePNG} from "./png.js";

export type RenderSource = StoryboardProject | StoryboardDocument;
export type PanelRenderSource = StoryboardProject | Pick<StoryboardDocument,"canvas"|"panels"|"shots">;

function documentOf(source: RenderSource): StoryboardDocument {
  return source instanceof StoryboardProject ? source.toJSON() : source;
}

export function renderPanelCanvas(source: PanelRenderSource, panelId: string, options: { annotations?: boolean; frame?: number; camera?: boolean; layerIds?: readonly string[]; cache?: RenderCache } = {}): Canvas {
  const document = source instanceof StoryboardProject?source._readRenderPanels([panelId]):source;
  const panel = document.panels.find((entry) => entry.id === panelId);
  if (!panel) throw new Error(`Panel not found: ${panelId}`);
  const frame = options.frame ?? panel.startFrame;
  assertRenderFrame(frame);
  if(!isDrawingColor(document.canvas.background))throw new Error("Invalid canvas background color");
  const shot = document.shots.find((entry) => entry.id === panel.shotId);
  const camera = evaluateCamera(shot?.cameraKeyframes ?? [], frame);
  let selection:Set<string>|undefined;
  if(options.layerIds){
    selection=new Set(options.layerIds);
    if(!selection.size||selection.size!==options.layerIds.length)throw new Error("Layer render selection requires nonempty unique layer IDs");
    const ids=new Set<string>();const visit=(layers:Layer[])=>{for(const layer of layers){ids.add(layer.id);if(layer.kind==="group")visit(layer.children);}};visit(panel.layers);
    for(const id of selection)if(!ids.has(id))throw new Error(`Render layer not found in panel ${panelId}: ${id}`);
  }
  const stage = new Canvas(panel.width, panel.height),stageContext=stage.getContext("2d");
  try{
    stageContext.fillStyle=document.canvas.background;
    stageContext.fillRect(0,0,panel.width,panel.height);
    compositeLayers(panel, panel.layers, stageContext, frame, options.cache??new RenderCache(), options.camera === false ? undefined : camera,undefined,undefined,1,undefined,selection);
    if (options.annotations ?? true) drawMotionAnnotations(stageContext, panel);
    return stage;
  }catch(error){stageContext.reset();throw error;}
}

export async function renderPanelPNG(source: RenderSource, panelId: string, options: { annotations?: boolean; frame?: number; camera?: boolean; layerIds?: readonly string[] } = {}): Promise<Buffer> {
  return encodePNG(renderPanelCanvas(source, panelId, options));
}

export function renderFrameCanvas(source: RenderSource, frame: number, options: { annotations?: boolean; cache?: RenderCache } = {}): Canvas {
  assertRenderFrame(frame);
  const document = source instanceof StoryboardProject?source._readRenderFrame(frame):source;
  const {panel,incoming:next,progress}=selectFramePanels(document.panels,frame);
  const current = renderPanelCanvas(document, panel.id, { ...options, frame, annotations: options.annotations ?? false });
  const transition = panel.transition;
  if (!next) return current;
  let incoming:Canvas|undefined,output:Canvas|undefined;
  try{
    incoming = renderPanelCanvas(document, next.id, { ...options, frame: next.startFrame, annotations: options.annotations ?? false });
    output = new Canvas(panel.width, panel.height);
    const ctx = output.getContext("2d");
    if (transition.type === "dissolve") {
      ctx.globalAlpha = 1-progress;
      ctx.drawImage(current, 0, 0);
      ctx.globalAlpha = progress;
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(incoming, 0, 0);
    } else {
      ctx.drawImage(current, 0, 0);
      const width = panel.width * progress;
      const left=transition.type==="wipe-left"?panel.width-width:0;
      ctx.clearRect(left,0,width,panel.height);
      ctx.save();
      ctx.beginPath();
      ctx.rect(left,0,width,panel.height);
      ctx.clip();
      ctx.drawImage(incoming, 0, 0);
      ctx.restore();
    }
    return output;
  }catch(error){output?.getContext("2d").reset();throw error;}
  finally{
    incoming?.getContext("2d").reset();
    current.getContext("2d").reset();
  }
}

export async function renderFramePNG(source: RenderSource, frame: number, options: { annotations?: boolean } = {}): Promise<Buffer> {
  return encodePNG(renderFrameCanvas(source, frame, options));
}

/** A frozen document snapshot with bounded artwork cache; create another session after edits. */
export function createRenderSession(source: RenderSource, maxCacheBytes?: number) {
  const document = parseStoryboardDocument(documentOf(source));
  const cache = new RenderCache(maxCacheBytes);
  let lastPanel="";
  const select=(id:string)=>{if(lastPanel!==id){cache.clear();lastPanel=id;}};
  return {
    durationFrames: document.panels.reduce((n,p) => Math.max(n,p.startFrame+p.durationFrames),0),
    frame: (frame: number) => {select(document.panels.find(p=>frame>=p.startFrame&&frame<p.startFrame+p.durationFrames)?.id??"");return renderFrameCanvas(document, frame, { cache });},
    panel: (id: string, frame?: number) => {select(id);return renderPanelCanvas(document, id, { cache, annotations: false, ...(frame === undefined ? {} : {frame}) });},
  };
}
