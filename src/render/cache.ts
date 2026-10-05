import { validateDimensions } from "../model/validation/pixels.js";
import { CodeboardError } from "../model/errors.js";
import { Canvas, type CanvasRenderingContext2D } from "skia-canvas";
import type { DrawingLayer, Panel } from "../model/types.js";
import { drawElement } from "./vector-renderer.js";
import { artworkBounds } from "./artwork-bounds.js";

const revealing = (layer: DrawingLayer, frame: number) =>
  layer.elements.some((e) => e.kind === "raster-stroke" && e.reveal && frame < e.reveal.endFrame);

export class RenderCache {
  private layers = new Map<DrawingLayer, { canvas: Canvas; x: number; y: number; scale: number }>();
  private bytes = 0;
  constructor(readonly maxBytes = 128 * 1024 * 1024) {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 0)
      throw new CodeboardError(
        "INVALID_ARGUMENT",
        "Render cache byte budget must be a nonnegative safe integer",
        {
          details: { reason: "INVALID_CACHE_BUDGET", maxBytes },
        },
      );
  }
  clear() {
    this.layers.clear();
    this.bytes = 0;
  }
  artwork(
    _panel: Panel,
    layer: DrawingLayer,
    frame = Infinity,
    scale = 1,
  ): { canvas: Canvas; x: number; y: number; scale: number } {
    scale = Math.max(1, Math.min(8, Math.ceil(scale * 4) / 4));
    const active = revealing(layer, frame);
    const found = active ? undefined : this.layers.get(layer);
    if (found?.scale === scale) return found;
    if (found) {
      this.bytes -= found.canvas.width * found.canvas.height * 4;
      this.layers.delete(layer);
    }
    const { x, y, width, height } = artworkBounds(layer);
    const pixelWidth = Math.ceil(width * scale),
      pixelHeight = Math.ceil(height * scale);
    validateDimensions(pixelWidth, pixelHeight);
    const canvas = new Canvas(pixelWidth, pixelHeight);
    const ctx = canvas.getContext("2d");
    try {
      ctx.scale(scale, scale);
      ctx.translate(-x, -y);
      for (const element of layer.elements) drawElement(ctx, element, frame);
      const size = pixelWidth * pixelHeight * 4;
      while (this.bytes + size > this.maxBytes && this.layers.size) {
        const first = this.layers.keys().next().value!;
        const old = this.layers.get(first)!;
        this.bytes -= old.canvas.width * old.canvas.height * 4;
        this.layers.delete(first);
      }
      // Keep pixels, not a retained display list of every dab, in the bounded cache.
      const flattened = new Canvas(pixelWidth, pixelHeight);
      flattened
        .getContext("2d")
        .putImageData(ctx.getImageData(0, 0, pixelWidth, pixelHeight), 0, 0);
      const result = { canvas: flattened, x, y, scale };
      if (!active && size <= this.maxBytes) {
        this.layers.set(layer, result);
        this.bytes += size;
      }
      return result;
    } finally {
      ctx.reset();
    }
  }
}

export function paintCached(
  ctx: CanvasRenderingContext2D,
  cache: RenderCache,
  panel: Panel,
  layer: DrawingLayer,
  frame: number,
) {
  const m = ctx.getTransform(),
    scale = Math.max(Math.hypot(m.a, m.b), Math.hypot(m.c, m.d));
  const art = cache.artwork(panel, layer, frame, scale);
  ctx.drawImage(
    art.canvas,
    art.x,
    art.y,
    art.canvas.width / art.scale,
    art.canvas.height / art.scale,
  );
}
