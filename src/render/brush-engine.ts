import { Canvas, type CanvasRenderingContext2D } from "skia-canvas";
import type { RasterStroke } from "../model/types.js";
import { createHash } from "node:crypto";
import { clamp, seeded, sampleDabs } from "./brush-dynamics.js";
import { drawDab } from "./brush-dab.js";
export { brushPadding, sampleDabs, taper } from "./brush-dynamics.js";

export function drawRasterStroke(
  ctx: CanvasRenderingContext2D,
  stroke: RasterStroke,
  frame = Infinity,
): void {
  const progress = stroke.reveal
    ? clamp(
        (frame - stroke.reveal.startFrame) / (stroke.reveal.endFrame - stroke.reveal.startFrame),
      )
    : 1;
  if (progress <= 0) return;
  // Sample the complete stroke so spacing, taper and seeded texture never shift during reveal.
  const dabs = sampleDabs(stroke).filter((dab) => dab.progress <= progress);
  const random = seeded(stroke.seed);
  const tipHash =
    stroke.brush.tip.kind === "bitmap"
      ? createHash("sha256").update(JSON.stringify(stroke.brush.tip)).digest("hex")
      : "";
  const texture = stroke.brush.paperTexture;
  if (!texture) {
    for (const dab of dabs) drawDab(ctx, stroke, dab, random, tipHash);
    return;
  }
  const surface = new Canvas(ctx.canvas.width, ctx.canvas.height),
    paint = surface.getContext("2d");
  const transform = ctx.getTransform();
  paint.setTransform(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f);
  for (const dab of dabs) drawDab(paint, { ...stroke, erase: false }, dab, random, tipHash);
  const tile = new Canvas(texture.width, texture.height),
    tc = tile.getContext("2d"),
    pixels = tc.createImageData(texture.width, texture.height);
  for (let i = 0; i < texture.alpha.length; i++) {
    pixels.data[i * 4] = 255;
    pixels.data[i * 4 + 1] = 255;
    pixels.data[i * 4 + 2] = 255;
    pixels.data[i * 4 + 3] = Math.round(
      255 * (1 - texture.strength + texture.strength * texture.alpha[i]!),
    );
  }
  tc.putImageData(pixels, 0, 0);
  paint.globalCompositeOperation = "destination-in";
  // The paper belongs to layer space, not the origin of a temporary cropped cache canvas.
  const determinant = transform.a * transform.d - transform.b * transform.c;
  if (determinant === 0) return;
  const corners = [
    [0, 0],
    [surface.width, 0],
    [0, surface.height],
    [surface.width, surface.height],
  ].map(([x, y]) => {
    const dx = x! - transform.e,
      dy = y! - transform.f;
    return {
      x: (transform.d * dx - transform.c * dy) / determinant / texture.scale,
      y: (transform.a * dy - transform.b * dx) / determinant / texture.scale,
    };
  });
  paint.scale(texture.scale, texture.scale);
  paint.fillStyle = paint.createPattern(tile, "repeat")!;
  const left = Math.floor(Math.min(...corners.map((p) => p.x))) - 1,
    top = Math.floor(Math.min(...corners.map((p) => p.y))) - 1;
  const right = Math.ceil(Math.max(...corners.map((p) => p.x))) + 1,
    bottom = Math.ceil(Math.max(...corners.map((p) => p.y))) + 1;
  paint.fillRect(left, top, right - left, bottom - top);
  ctx.save();
  try {
    ctx.resetTransform();
    ctx.globalCompositeOperation = stroke.erase ? "destination-out" : "source-over";
    ctx.drawImage(surface, 0, 0);
  } finally {
    ctx.restore();
  }
}
