import { Canvas, ImageData, Path2D, type CanvasRenderingContext2D } from "skia-canvas";
import type { DrawingElement, VectorPath, VectorStroke } from "../model/types.js";
import { drawRasterStroke } from "./brush-engine.js";
import { contourPath } from "../drawing/path-geometry.js";
import {traceVectorStroke} from "../drawing/stroke-outline.js";
import {assertDrawingColors} from "../drawing/color.js";

export function drawVectorStroke(ctx: CanvasRenderingContext2D, stroke: VectorStroke): void {
  if (stroke.points.length === 0) return;
  ctx.save();
  ctx.globalAlpha = stroke.opacity;
  ctx.strokeStyle = stroke.color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (stroke.fill && stroke.closed) {
    ctx.fillStyle = stroke.fill;
    ctx.beginPath();
    ctx.moveTo(stroke.points[0]!.x, stroke.points[0]!.y);
    for (const point of stroke.points.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle=stroke.color;ctx.beginPath();
  traceVectorStroke(ctx,stroke);ctx.fill();
  ctx.restore();
}

const pathCache=new WeakMap<VectorPath,{signature:string;path:Path2D}>();
function buildPath(element: VectorPath): Path2D {
  const signature=JSON.stringify(element.commands),cached=pathCache.get(element);if(cached?.signature===signature)return cached.path;
  const path = contourPath(element.commands);
  pathCache.set(element,{signature,path});return path;
}

export function drawElement(ctx: CanvasRenderingContext2D, element: DrawingElement, frame = Infinity): void {
  if (!element.visible) return;
  assertDrawingColors(element);
  ctx.save();
  if(element.matrix)ctx.transform(...element.matrix);
  try {
  if (element.kind === "raster-stroke") drawRasterStroke(ctx, element, frame);
  else if(element.kind === "raster-surface"){
    const surface=new Canvas(element.width,element.height),surfaceContext=surface.getContext("2d");
    try{
      surfaceContext.putImageData(new ImageData(new Uint8ClampedArray(element.pixels),element.width,element.height),0,0);
      ctx.globalAlpha=element.opacity;ctx.drawImage(surface,0,0);
    }finally{surfaceContext.reset();}
  }
  else if (element.kind === "vector-stroke") drawVectorStroke(ctx, element);
  else if (element.kind === "vector-path") {
    const path = buildPath(element);
    ctx.save();
    ctx.globalAlpha = element.opacity;
    if (element.fill) {
      const fill=element.fill;
      if(typeof fill==='string')ctx.fillStyle=fill;
      else{
        const gradient=fill.kind==='linear'?ctx.createLinearGradient(fill.from.x,fill.from.y,fill.to.x,fill.to.y):ctx.createRadialGradient(fill.from.x,fill.from.y,fill.from.radius,fill.to.x,fill.to.y,fill.to.radius);
        for(const stop of fill.stops)gradient.addColorStop(stop.offset,stop.color);
        ctx.fillStyle=gradient;
      }
      ctx.fill(path);
    }
    if (element.stroke && element.strokeWidth > 0) { ctx.strokeStyle = element.stroke; ctx.lineWidth = element.strokeWidth; ctx.stroke(path); }
    ctx.restore();
  } else {
    ctx.save();
    ctx.globalAlpha = element.opacity;
    ctx.fillStyle = element.color;
    ctx.font = element.font;
    ctx.textAlign = element.align;
    ctx.fillText(element.text, element.x, element.y);
    ctx.restore();
  }
  } finally {ctx.restore();}
}
