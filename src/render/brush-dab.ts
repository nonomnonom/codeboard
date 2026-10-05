import { Canvas, type CanvasRenderingContext2D } from "skia-canvas";
import type { RasterStroke } from "../model/types.js";
import { clamp, taper, type Dab } from "./brush-dynamics.js";

const bitmapTipCache = new Map<string, Canvas>();

function cacheBitmapTip(key: string, stamp: Canvas): void {
  bitmapTipCache.delete(key);
  if (bitmapTipCache.size >= 128) bitmapTipCache.delete(bitmapTipCache.keys().next().value!);
  bitmapTipCache.set(key, stamp);
}

export function drawDab(
  ctx: CanvasRenderingContext2D,
  stroke: RasterStroke,
  dab: Dab,
  random: () => number,
  tipHash: string,
): void {
  const brush = stroke.brush;
  const pressure = clamp(dab.pressure ?? 1);
  const speed = clamp(dab.speed);
  const pressureSize = 1 - brush.dynamics.pressureSize + pressure * brush.dynamics.pressureSize;
  const speedSize = 1 + brush.dynamics.speedSize * speed;
  const radius = Math.max(
    0.15,
    brush.size *
      0.5 *
      pressureSize *
      speedSize *
      taper(dab.progress, brush.taperStart, brush.taperEnd),
  );
  const pressureOpacity =
    1 - brush.dynamics.pressureOpacity + pressure * brush.dynamics.pressureOpacity;
  const speedOpacity = 1 + brush.dynamics.speedOpacity * speed;
  const textureSample = random();
  const textureNoise =
    brush.texture === "none" ? 1 : 1 - brush.textureStrength * textureSample * 0.72;
  const alpha = clamp(
    stroke.opacity * brush.opacity * brush.flow * pressureOpacity * speedOpacity * textureNoise,
  );
  if (radius <= 0.15 || alpha <= 0.001) return;
  const tilt = Math.hypot(dab.tiltX ?? 0, dab.tiltY ?? 0) / 90;
  const ratio = clamp(1 - tilt * brush.dynamics.tiltShape * 0.78, 0.18, 1);
  const tip = brush.tip;
  const baseAngle =
    tip.rotationMode === "stroke"
      ? dab.direction
      : tip.rotationMode === "stylus"
        ? (dab.rotation ?? Math.atan2(dab.tiltY ?? 0, dab.tiltX ?? 1))
        : 0;
  const angle = baseAngle + tip.angle + (random() - 0.5) * brush.dynamics.rotationJitter * Math.PI;
  const jitterScale = brush.texture === "none" ? 0 : brush.textureStrength * radius * 0.16;
  const x = dab.x + (random() - 0.5) * jitterScale;
  const y = dab.y + (random() - 0.5) * jitterScale;

  ctx.save();
  try {
    ctx.globalCompositeOperation = stroke.erase ? "destination-out" : "source-over";
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(angle);
    const tipAspect = tip.kind === "bitmap" ? tip.height / tip.width : tip.aspect;
    ctx.scale(1, ratio * tipAspect);
    const dynamicHardness = clamp(
      brush.hardness *
        (1 - brush.dynamics.pressureHardness + pressure * brush.dynamics.pressureHardness),
      0.01,
      1,
    );
    if (tip.kind === "bitmap") {
      const key = `${tipHash}:${stroke.color}:${dynamicHardness}`;
      let stamp = bitmapTipCache.get(key);
      if (!stamp) {
        const baseKey = `${tipHash}:${stroke.color}:1`;
        let base = bitmapTipCache.get(baseKey);
        if (!base) {
          base = new Canvas(tip.width, tip.height);
          const context = base.getContext("2d"),
            image = context.createImageData(tip.width, tip.height);
          for (let index = 0; index < tip.alpha.length; index++) {
            image.data[index * 4] = 255;
            image.data[index * 4 + 1] = 255;
            image.data[index * 4 + 2] = 255;
            image.data[index * 4 + 3] = Math.round(tip.alpha[index]! * 255);
          }
          context.putImageData(image, 0, 0);
          context.globalCompositeOperation = "source-in";
          context.fillStyle = stroke.color;
          context.fillRect(0, 0, tip.width, tip.height);
        }
        cacheBitmapTip(baseKey, base);
        stamp = base;
        if (dynamicHardness < 1) {
          stamp = new Canvas(tip.width, tip.height);
          const stampContext = stamp.getContext("2d");
          stampContext.drawImage(base, 0, 0);
          stampContext.globalCompositeOperation = "destination-in";
          const falloff = stampContext.createRadialGradient(
            tip.width / 2,
            tip.height / 2,
            0,
            tip.width / 2,
            tip.height / 2,
            Math.max(tip.width, tip.height) / 2,
          );
          falloff.addColorStop(0, "white");
          falloff.addColorStop(dynamicHardness * 0.99, "white");
          falloff.addColorStop(1, "transparent");
          stampContext.fillStyle = falloff;
          stampContext.fillRect(0, 0, tip.width, tip.height);
        }
        cacheBitmapTip(key, stamp);
      }
      ctx.drawImage(stamp, -radius, -radius, radius * 2, radius * 2);
    } else if (tip.kind === "chisel") {
      const edge = ctx.createLinearGradient(0, -radius, 0, radius);
      edge.addColorStop(0, "transparent");
      edge.addColorStop((1 - dynamicHardness) / 2, stroke.color);
      edge.addColorStop(1 - (1 - dynamicHardness) / 2, stroke.color);
      edge.addColorStop(1, "transparent");
      ctx.fillStyle = edge;
      ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    } else {
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      gradient.addColorStop(0, stroke.color);
      gradient.addColorStop(clamp(dynamicHardness * 0.92, 0.01, 0.98), stroke.color);
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;
      if (tip.kind === "rake")
        for (const offset of [-0.62, 0, 0.62]) {
          ctx.beginPath();
          ctx.arc(offset * radius, 0, radius * 0.28, 0, Math.PI * 2);
          ctx.fill();
        }
      else {
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
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
  } finally {
    ctx.restore();
  }
}
