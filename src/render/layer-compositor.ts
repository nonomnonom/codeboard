import { Canvas, type CanvasRenderingContext2D } from "skia-canvas";
import type { Layer, Panel, DrawingLayer, AffineMatrix, Transform, Pivot } from "../model/types.js";
import { drawElement } from "./vector-renderer.js";
import { brushPadding } from "./brush-engine.js";
import { evaluateLayer, evaluateDrawing, type EvaluatedCamera } from "../animation/evaluate.js";
import {cameraPlane} from "../animation/camera-plane.js";

export class RenderCache {
  private layers = new Map<DrawingLayer, {canvas:Canvas;x:number;y:number;scale:number}>();
  private bytes = 0;
  constructor(readonly maxBytes = 128 * 1024 * 1024) {}
  clear(){this.layers.clear();this.bytes=0;}
  artwork(panel: Panel, layer: DrawingLayer, frame = Infinity, scale = 1): {canvas:Canvas;x:number;y:number;scale:number} {
    scale=Math.max(1,Math.min(8,Math.ceil(scale*4)/4));
    const active = revealing(layer,frame);
    const found = active ? undefined : this.layers.get(layer);
    if (found?.scale===scale) return found;
    if(found){this.bytes-=found.canvas.width*found.canvas.height*4;this.layers.delete(layer);}
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    const include=(left:number,top:number,right:number,bottom:number,matrix?:AffineMatrix,padding=0)=>{
      const [a,b,c,d,e,f]=matrix??[1,0,0,1,0,0];
      for(const [u,v] of [[left,top],[right,top],[left,bottom],[right,bottom]]){
        const x=a*u!+c*v!+e,y=b*u!+d*v!+f;
        minX=Math.min(minX,x-padding);minY=Math.min(minY,y-padding);maxX=Math.max(maxX,x+padding);maxY=Math.max(maxY,y+padding);
      }
    };
    for(const e of layer.elements){
      if(e.kind==="raster-surface"){
        include(0,0,e.width,e.height,e.matrix,1);continue;
      }
      if(e.kind==="text"){
        const context=new Canvas(1,1).getContext("2d");context.font=e.font;context.textAlign=e.align;const m=context.measureText(e.text);
        include(e.x-m.actualBoundingBoxLeft-2,e.y-m.actualBoundingBoxAscent-2,e.x+m.actualBoundingBoxRight+2,e.y+m.actualBoundingBoxDescent+2,e.matrix);continue;
      }
      const padding=e.kind==="raster-stroke"?brushPadding(e.brush):e.kind==="vector-stroke"?e.width:e.strokeWidth;
      const points=e.kind==="vector-path"?e.commands.flatMap(c=>c.op==="Z"?[]:[{x:c.x,y:c.y},...("x1"in c?[{x:c.x1,y:c.y1}]:[]),...("x2"in c?[{x:c.x2,y:c.y2}]:[])]):e.points;
      for(const p of points)include(p.x-padding,p.y-padding,p.x+padding,p.y+padding,e.matrix);
    }
    if(!Number.isFinite(minX)){minX=0;minY=0;maxX=1;maxY=1;}
    const x=Math.floor(minX),y=Math.floor(minY),width=Math.max(1,Math.ceil(maxX)-x),height=Math.max(1,Math.ceil(maxY)-y);
    const pixelWidth=Math.ceil(width*scale),pixelHeight=Math.ceil(height*scale);
    if(pixelWidth*pixelHeight>32*1024*1024)throw new Error(`Layer ${layer.id} exceeds 32 megapixel artwork bounds`);
    const canvas = new Canvas(pixelWidth, pixelHeight);
    const ctx = canvas.getContext("2d");
    try{
    ctx.scale(scale,scale);ctx.translate(-x,-y);
    for (const element of layer.elements) drawElement(ctx, element, frame);
    const size = pixelWidth * pixelHeight * 4;
    while (this.bytes + size > this.maxBytes && this.layers.size) {
      const first = this.layers.keys().next().value!;
      const old = this.layers.get(first)!;
      this.bytes -= old.canvas.width * old.canvas.height * 4;
      this.layers.delete(first);
    }
    // Keep pixels, not a retained display list of every dab, in the bounded cache.
    const flattened=new Canvas(pixelWidth,pixelHeight);
    flattened.getContext("2d").putImageData(ctx.getImageData(0,0,pixelWidth,pixelHeight),0,0);
    const result={canvas:flattened,x,y,scale};
    if (!active && size <= this.maxBytes) { this.layers.set(layer, result); this.bytes += size; }
    return result;
    }finally{ctx.reset();}
  }
}

function findLayerPath(layers: Layer[], id: string): Layer[] | undefined {
  for (const layer of layers) {
    if (layer.id === id) return [layer];
    if (layer.kind === "group") {
      const nested = findLayerPath(layer.children, id);
      if (nested) return [layer,...nested];
    }
  }
  return undefined;
}

type CompositionBounds = {x:number;y:number;width:number;height:number};
function compositionBounds(panel:Panel,layers:Layer[],frame:number,camera?:EvaluatedCamera):CompositionBounds {
  let left=0,top=0,right=panel.width,bottom=panel.height;
  if(camera){
    const c=Math.cos(camera.rotation),s=Math.sin(camera.rotation);
    for(const layer of layers){
      const {zoom,panX,panY}=cameraPlane(camera,evaluateLayer(layer,frame).depth,panel.width,panel.height);
      for(const [x,y] of [[0,0],[panel.width,0],[0,panel.height],[panel.width,panel.height]]){
        const u=(x!-panel.width/2)/zoom,v=(y!-panel.height/2)/zoom;
        const wx=c*u-s*v+panel.width/2+panX;
        const wy=s*u+c*v+panel.height/2+panY;
        if(!Number.isFinite(wx)||!Number.isFinite(wy))throw new Error('Camera plane composition bounds exceed the supported numerical range');
        left=Math.min(left,Math.floor(wx));top=Math.min(top,Math.floor(wy));
        right=Math.max(right,Math.ceil(wx));bottom=Math.max(bottom,Math.ceil(wy));
      }
    }
  }
  const width=right-left,height=bottom-top;
  if(!Number.isFinite(width)||!Number.isFinite(height))throw new Error('Camera plane composition bounds exceed the supported numerical range');
  return {x:left,y:top,width,height};
}

type Matrix = {a:number;b:number;c:number;d:number;e:number;f:number};
function placeLayer(ctx:CanvasRenderingContext2D,transform:Transform,pivot?:Pivot){
  ctx.translate(transform.x,transform.y);
  if(pivot)ctx.translate(pivot.x,pivot.y);
  ctx.rotate(transform.rotation);ctx.scale(transform.scaleX,transform.scaleY);
  if(pivot)ctx.translate(-pivot.x,-pivot.y);
}
const revealing = (layer: DrawingLayer, frame: number) => layer.elements.some(e => e.kind === "raster-stroke" && e.reveal && frame < e.reveal.endFrame);
function paintCached(ctx:CanvasRenderingContext2D,cache:RenderCache,panel:Panel,layer:DrawingLayer,frame:number){
  const m=ctx.getTransform(),scale=Math.max(Math.hypot(m.a,m.b),Math.hypot(m.c,m.d));
  const art=cache.artwork(panel,layer,frame,scale);
  ctx.drawImage(art.canvas,art.x,art.y,art.canvas.width/art.scale,art.canvas.height/art.scale);
}
function renderLayer(panel: Panel, layer: Layer, frame: number, visited = new Set<string>(), force = false, cache?: RenderCache, parent?:Matrix,resolution=1,bounds:CompositionBounds={x:0,y:0,width:panel.width,height:panel.height},selection?:ReadonlySet<string>): Canvas {
  if (visited.has(layer.id)) throw new Error(`Circular layer mask involving ${layer.id}`);
  const nextVisited = new Set(visited).add(layer.id);
  const width=Math.ceil(bounds.width*resolution),height=Math.ceil(bounds.height*resolution);
  if(width*height>32*1024*1024)throw new Error(`Layer ${layer.id} exceeds 32 megapixel camera composition bounds`);
  const canvas = new Canvas(width,height);
  if (!layer.visible && !force) return canvas;
  if (layer.exposure && (frame < layer.exposure.startFrame || frame >= layer.exposure.endFrame)) return canvas;
  const ctx = canvas.getContext("2d");
  ctx.save();
  if(parent)ctx.setTransform(parent.a,parent.b,parent.c,parent.d,parent.e,parent.f);
  else {ctx.scale(resolution,resolution);ctx.translate(-bounds.x,-bounds.y);}
  const state = evaluateLayer(layer, frame);
  placeLayer(ctx,state.transform,layer.pivot);
  if (layer.kind === "group") {
    const matrix=ctx.getTransform();ctx.resetTransform();
    const drawing=evaluateDrawing(layer.drawingSequence,frame);
    const children=drawing===undefined?layer.children:layer.children.filter(child=>child.id===drawing);
    compositeLayers(panel, children, ctx, frame, cache, undefined, nextVisited,matrix,resolution,bounds,selection?.has(layer.id)?undefined:selection);
  }
  else if (cache&&layer.kind==="raster") paintCached(ctx,cache,panel,layer,frame);
  else for (const element of layer.elements) drawElement(ctx, element, frame);
  ctx.restore();
  if (layer.maskLayerId) {
    const maskPath = findLayerPath(panel.layers, layer.maskLayerId);
    if (!maskPath) throw new Error(`Mask layer not found: ${layer.maskLayerId}`);
    const mask=maskPath.at(-1)!;
    const consumerAncestors=new Set(findLayerPath(panel.layers,layer.id)!.slice(0,-1).map(entry=>entry.id));
    let maskOpacity=evaluateLayer(mask,frame).opacity;
    ctx.save();ctx.resetTransform();
    ctx.scale(resolution,resolution);ctx.translate(-bounds.x,-bounds.y);
    for(const [index,ancestor] of maskPath.slice(0,-1).entries()){
      const state=evaluateLayer(ancestor,frame);
      placeLayer(ctx,state.transform,ancestor.pivot);
      if(!consumerAncestors.has(ancestor.id))maskOpacity*=state.opacity;
      if(ancestor.exposure&&(frame<ancestor.exposure.startFrame||frame>=ancestor.exposure.endFrame))maskOpacity=0;
      if(ancestor.kind==="group"){
        const drawing=evaluateDrawing(ancestor.drawingSequence,frame);
        if(drawing!==undefined&&drawing!==maskPath[index+1]!.id)maskOpacity=0;
      }
    }
    const maskParent=ctx.getTransform();ctx.restore();
    const maskCanvas = renderLayer(panel, mask, frame, nextVisited, true, cache,maskParent,resolution,bounds);
    ctx.save();
    ctx.globalCompositeOperation = "destination-in";
    ctx.globalAlpha = maskOpacity;
    ctx.drawImage(maskCanvas, 0, 0);
    ctx.restore();
  }
  return canvas;
}

export function compositeLayers(panel: Panel, layers: Layer[], target: CanvasRenderingContext2D, frame = panel.startFrame, cache?: RenderCache, camera?: EvaluatedCamera, visited = new Set<string>(),parent?:Matrix,resolution=1,bounds=compositionBounds(panel,layers,frame,camera),selection?:ReadonlySet<string>): void {
  const selected=(layer:Layer):boolean=>!selection||selection.has(layer.id)||(layer.kind==="group"&&layer.children.some(selected));
  let below: Canvas | undefined;
  for (const [index,layer] of layers.entries()) {
    const state=evaluateLayer(layer,frame);
    const placement=camera?cameraPlane(camera,state.depth,panel.width,panel.height):undefined;
    const paint=selected(layer);
    if(!paint&&!layers[index+1]?.clipToBelow){below=undefined;continue;}
    if (!layer.visible) {below=undefined;continue;}
    if(state.opacity===0){below=undefined;continue;}
    if(layer.exposure&&(frame<layer.exposure.startFrame||frame>=layer.exposure.endFrame)){below=undefined;continue;}
    if(layer.clipToBelow&&!below)continue;
    if(paint&&cache&&layer.kind!=="group"&&!layer.maskLayerId&&!layer.clipToBelow&&!layers[index+1]?.clipToBelow&&(layer.kind==="raster"||(state.opacity===1&&layer.blendMode==="source-over"))){
      target.save();
      if(camera&&placement){target.translate(panel.width/2,panel.height/2);target.rotate(-camera.rotation);target.scale(placement.zoom,placement.zoom);target.translate(-panel.width/2-placement.panX,-panel.height/2-placement.panY);}
      if(parent)target.transform(parent.a,parent.b,parent.c,parent.d,parent.e,parent.f);
      placeLayer(target,state.transform,layer.pivot);
      target.globalAlpha=state.opacity;target.globalCompositeOperation=layer.blendMode;
      if(layer.kind==="vector")for(const e of layer.elements)drawElement(target,e,frame);
      else paintCached(target,cache,panel,layer,frame);
      target.restore();below=undefined;continue;
    }
    const layerResolution=placement?Math.max(1,Math.ceil(placement.zoom*4)/4):resolution;
    const rendered = renderLayer(panel, layer, frame, visited, false, cache,parent,layerResolution,bounds,paint?selection:undefined);
    const alphaSource=selection&&layer.kind==="group"&&paint&&!selection.has(layer.id)&&layers[index+1]?.clipToBelow
      ?renderLayer(panel,layer,frame,visited,false,cache,parent,layerResolution,bounds):rendered;
    if (layer.clipToBelow && below) {
      for(const surface of new Set([rendered,alphaSource])){
        const clippingContext=surface.getContext("2d");clippingContext.globalCompositeOperation="destination-in";
        clippingContext.drawImage(below,0,0,surface.width,surface.height);
      }
    }
    if(paint){target.save();
    if (camera&&placement) {
      target.translate(panel.width/2, panel.height/2);
      target.rotate(-camera.rotation);
      target.scale(placement.zoom, placement.zoom);
      target.translate(-panel.width/2 - placement.panX, -panel.height/2 - placement.panY);
    }
    target.globalAlpha = state.opacity;
    target.globalCompositeOperation = layer.blendMode;
    if(camera)target.drawImage(rendered,bounds.x,bounds.y,rendered.width/layerResolution,rendered.height/layerResolution);
    else target.drawImage(rendered,0,0);
    target.restore();}
    below = alphaSource;
    if(state.opacity<1&&layers[index+1]?.clipToBelow){
      below=new Canvas(rendered.width,rendered.height);
      const alpha=below.getContext("2d");
      alpha.globalAlpha=state.opacity;alpha.drawImage(alphaSource,0,0);
    }
  }
}
