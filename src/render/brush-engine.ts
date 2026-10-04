import { Canvas, type CanvasRenderingContext2D } from "skia-canvas";
import type { BrushPreset, Point, RasterStroke } from "../model/types.js";
import { createHash } from "node:crypto";
import {interpolateRotation} from "../drawing/pen-input.js";

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => ((state = (state * 1664525 + 1013904223) >>> 0) / 0x100000000);
}

function pointSpeed(a: Point, b: Point): number {
  const distance = Math.hypot(b.x - a.x, b.y - a.y);
  const elapsed = Math.max(1, (b.time ?? 8) - (a.time ?? 0));
  return clamp(distance / elapsed / 2);
}

interface Dab extends Point { progress: number; speed: number; direction: number }

const bitmapTipCache = new Map<string, Canvas>();

function cacheBitmapTip(key:string,stamp:Canvas):void{
  bitmapTipCache.delete(key);
  if(bitmapTipCache.size>=128)bitmapTipCache.delete(bitmapTipCache.keys().next().value!);
  bitmapTipCache.set(key,stamp);
}

/** Conservative support for rotated tip corners, speed growth, grains and positional jitter. */
export function brushPadding(brush:BrushPreset):number {
  const aspect=brush.tip.kind==="bitmap"?brush.tip.height/brush.tip.width:brush.tip.aspect;
  const radius=brush.size*.5*(1+Math.max(0,brush.dynamics.speedSize));
  const extent=Math.max(Math.hypot(1,aspect),1.04*Math.max(1,aspect));
  return Math.max(brush.size*2,radius*(extent+.12)+2);
}

export function sampleDabs(stroke: RasterStroke): Dab[] {
  if (stroke.points.length === 1) return [{ ...stroke.points[0]!, progress: 0.5, speed: 0, direction: 0 }];
  const lengths: number[] = [0];
  let total = 0;
  for (let i = 1; i < stroke.points.length; i += 1) {
    total += Math.hypot(stroke.points[i]!.x - stroke.points[i - 1]!.x, stroke.points[i]!.y - stroke.points[i - 1]!.y);
    lengths.push(total);
  }
  if(total===0)return [{...stroke.points.at(-1)!,progress:.5,speed:0,direction:0}];
  const dabs: Dab[] = [];
  let segment = 1;
  let target = 0;
  while (target <= total + 0.001) {
    const progress = total === 0 ? 0 : target / total;
    while (segment < lengths.length - 1 && lengths[segment]! < target) segment += 1;
    const a = stroke.points[segment - 1]!;
    const b = stroke.points[segment]!;
    const span = Math.max(0.0001, lengths[segment]! - lengths[segment - 1]!);
    const t = clamp((target - lengths[segment - 1]!) / span);
    const rotation=interpolateRotation(a.rotation,b.rotation,t);
    const mix = (av: number | undefined, bv: number | undefined, fallback: number) => (av ?? fallback) + ((bv ?? fallback) - (av ?? fallback)) * t;
    dabs.push({
      x: mix(a.x, b.x, 0), y: mix(a.y, b.y, 0), pressure: mix(a.pressure, b.pressure, 1),
      time: mix(a.time, b.time, 0), tiltX: mix(a.tiltX, b.tiltX, 0), tiltY: mix(a.tiltY, b.tiltY, 0),
      ...(rotation===undefined?{}:{rotation}), progress, speed: pointSpeed(a, b), direction: Math.atan2(b.y - a.y, b.x - a.x),
    });
    const pressure = clamp(dabs.at(-1)!.pressure ?? 1);
    const pressureSpacing = 1 + (1 - pressure) * stroke.brush.dynamics.pressureSpacing * 2;
    target += Math.max(0.35, stroke.brush.size * stroke.brush.spacing * Math.max(0.15, pressureSpacing));
  }
  if (dabs.at(-1)!.progress < 0.999) {
    const last = stroke.points.at(-1)!;
    const previous = stroke.points.at(-2)!;
    dabs.push({ ...last, progress: 1, speed: pointSpeed(previous, last), direction: Math.atan2(last.y - previous.y, last.x - previous.x) });
  }
  return dabs;
}

export function taper(progress: number, start: number, end: number): number {
  const fromStart = start > 0 ? clamp(progress / start) : 1;
  const fromEnd = end > 0 ? clamp((1 - progress) / end) : 1;
  return Math.min(fromStart, fromEnd);
}

function drawDab(ctx: CanvasRenderingContext2D, stroke: RasterStroke, dab: Dab, random: () => number,tipHash:string): void {
  const brush = stroke.brush;
  const pressure = clamp(dab.pressure ?? 1);
  const speed = clamp(dab.speed);
  const pressureSize = 1 - brush.dynamics.pressureSize + pressure * brush.dynamics.pressureSize;
  const speedSize = 1 + brush.dynamics.speedSize * speed;
  const radius = Math.max(0.15, brush.size * 0.5 * pressureSize * speedSize * taper(dab.progress, brush.taperStart, brush.taperEnd));
  const pressureOpacity = 1 - brush.dynamics.pressureOpacity + pressure * brush.dynamics.pressureOpacity;
  const speedOpacity = 1 + brush.dynamics.speedOpacity * speed;
  const textureSample = random();
  const textureNoise = brush.texture === "none" ? 1 : 1 - brush.textureStrength * textureSample * 0.72;
  const alpha = clamp(stroke.opacity * brush.opacity * brush.flow * pressureOpacity * speedOpacity * textureNoise);
  if (radius <= 0.15 || alpha <= 0.001) return;
  const tilt = Math.hypot(dab.tiltX ?? 0, dab.tiltY ?? 0) / 90;
  const ratio = clamp(1 - tilt * brush.dynamics.tiltShape * 0.78, 0.18, 1);
  const tip = brush.tip;
  const baseAngle = tip.rotationMode === "stroke" ? dab.direction : tip.rotationMode === "stylus" ? (dab.rotation ?? Math.atan2(dab.tiltY ?? 0, dab.tiltX ?? 1)) : 0;
  const angle = baseAngle + tip.angle + (random() - 0.5) * brush.dynamics.rotationJitter * Math.PI;
  const jitterScale = brush.texture === "none" ? 0 : brush.textureStrength * radius * 0.16;
  const x = dab.x + (random() - 0.5) * jitterScale;
  const y = dab.y + (random() - 0.5) * jitterScale;

  ctx.save();
  ctx.globalCompositeOperation = stroke.erase ? "destination-out" : "source-over";
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(angle);
  const tipAspect = tip.kind === "bitmap" ? tip.height / tip.width : tip.aspect;
  ctx.scale(1, ratio * tipAspect);
  const dynamicHardness = clamp(brush.hardness * (1 - brush.dynamics.pressureHardness + pressure * brush.dynamics.pressureHardness), 0.01, 1);
  if (tip.kind === "bitmap") {
    const key = `${tipHash}:${stroke.color}:${dynamicHardness}`;
    let stamp = bitmapTipCache.get(key);
    if (!stamp) {
      const baseKey=`${tipHash}:${stroke.color}:1`;
      let base=bitmapTipCache.get(baseKey);
      if(!base){
        base=new Canvas(tip.width,tip.height);
        const context=base.getContext("2d"),image=context.createImageData(tip.width,tip.height);
        for(let index=0;index<tip.alpha.length;index++){
          image.data[index*4]=255;image.data[index*4+1]=255;image.data[index*4+2]=255;
          image.data[index*4+3]=Math.round(tip.alpha[index]!*255);
        }
        context.putImageData(image,0,0);
        context.globalCompositeOperation="source-in";
        context.fillStyle=stroke.color;context.fillRect(0,0,tip.width,tip.height);
      }
      cacheBitmapTip(baseKey,base);
      stamp=base;
      if(dynamicHardness<1){
        stamp=new Canvas(tip.width,tip.height);
        const stampContext=stamp.getContext("2d");
        stampContext.drawImage(base,0,0);
        stampContext.globalCompositeOperation = "destination-in";
        const falloff = stampContext.createRadialGradient(tip.width/2, tip.height/2, 0, tip.width/2, tip.height/2, Math.max(tip.width, tip.height)/2);
        falloff.addColorStop(0, "white"); falloff.addColorStop(dynamicHardness * 0.99, "white"); falloff.addColorStop(1, "transparent");
        stampContext.fillStyle = falloff; stampContext.fillRect(0, 0, tip.width, tip.height);
      }
      cacheBitmapTip(key,stamp);
    }
    ctx.drawImage(stamp, -radius, -radius, radius * 2, radius * 2);
  } else if (tip.kind === "chisel") {
    const edge=ctx.createLinearGradient(0,-radius,0,radius);
    edge.addColorStop(0,"transparent");edge.addColorStop((1-dynamicHardness)/2,stroke.color);edge.addColorStop(1-(1-dynamicHardness)/2,stroke.color);edge.addColorStop(1,"transparent");
    ctx.fillStyle = edge;
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
  } else {
    const gradient=ctx.createRadialGradient(0,0,0,0,0,radius);
    gradient.addColorStop(0,stroke.color);
    gradient.addColorStop(clamp(dynamicHardness*.92,.01,.98),stroke.color);
    gradient.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    if(tip.kind==="rake")for(const offset of [-.62,0,.62]){
      ctx.beginPath();ctx.arc(offset*radius,0,radius*.28,0,Math.PI*2);ctx.fill();
    }else{
      ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.fill();
    }
  }
  if (!stroke.erase && brush.texture !== "none") {
    const grains = brush.texture === "charcoal" ? 7 : brush.texture === "dry-brush" ? 5 : 3;
    ctx.globalAlpha = alpha * brush.textureStrength * 0.38;
    ctx.fillStyle = stroke.color;
    for (let i = 0; i < grains; i += 1) {
      const theta = random() * Math.PI * 2;
      const distance = Math.sqrt(random()) * radius * 0.92;
      const grain = radius * (0.03 + random() * 0.09);
      ctx.beginPath();
      ctx.arc(Math.cos(theta) * distance, Math.sin(theta) * distance, grain, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function drawRasterStroke(ctx: CanvasRenderingContext2D, stroke: RasterStroke, frame = Infinity): void {
  const progress = stroke.reveal ? clamp((frame-stroke.reveal.startFrame)/(stroke.reveal.endFrame-stroke.reveal.startFrame)) : 1;
  if (progress <= 0) return;
  // Sample the complete stroke so spacing, taper and seeded texture never shift during reveal.
  const dabs = sampleDabs(stroke).filter(dab => dab.progress <= progress);
  const random = seeded(stroke.seed);
  const tipHash=stroke.brush.tip.kind==="bitmap"?createHash("sha256").update(JSON.stringify(stroke.brush.tip)).digest("hex"):"";
  const texture=stroke.brush.paperTexture;
  if(!texture){for (const dab of dabs) drawDab(ctx, stroke, dab, random,tipHash);return;}
  const surface=new Canvas(ctx.canvas.width,ctx.canvas.height),paint=surface.getContext("2d");
  const transform=ctx.getTransform();paint.setTransform(transform.a,transform.b,transform.c,transform.d,transform.e,transform.f);
  for(const dab of dabs)drawDab(paint,{...stroke,erase:false},dab,random,tipHash);
  const tile=new Canvas(texture.width,texture.height),tc=tile.getContext("2d"),pixels=tc.createImageData(texture.width,texture.height);
  for(let i=0;i<texture.alpha.length;i++){
    pixels.data[i*4]=255;pixels.data[i*4+1]=255;pixels.data[i*4+2]=255;
    pixels.data[i*4+3]=Math.round(255*(1-texture.strength+texture.strength*texture.alpha[i]!));
  }
  tc.putImageData(pixels,0,0);
  paint.globalCompositeOperation="destination-in";
  // The paper belongs to layer space, not the origin of a temporary cropped cache canvas.
  const determinant=transform.a*transform.d-transform.b*transform.c;
  if(determinant===0)return;
  const corners=[[0,0],[surface.width,0],[0,surface.height],[surface.width,surface.height]].map(([x,y])=>{
    const dx=x!-transform.e,dy=y!-transform.f;
    return {x:(transform.d*dx-transform.c*dy)/determinant/texture.scale,y:(transform.a*dy-transform.b*dx)/determinant/texture.scale};
  });
  paint.scale(texture.scale,texture.scale);
  paint.fillStyle=paint.createPattern(tile,"repeat")!;
  const left=Math.floor(Math.min(...corners.map(p=>p.x)))-1,top=Math.floor(Math.min(...corners.map(p=>p.y)))-1;
  const right=Math.ceil(Math.max(...corners.map(p=>p.x)))+1,bottom=Math.ceil(Math.max(...corners.map(p=>p.y)))+1;
  paint.fillRect(left,top,right-left,bottom-top);
  ctx.save();ctx.resetTransform();ctx.globalCompositeOperation=stroke.erase?"destination-out":"source-over";ctx.drawImage(surface,0,0);ctx.restore();
}
