import { Canvas } from "skia-canvas";
import { renderPanelCanvas, type RenderSource } from "../panel.js";
import { assertRenderFrame } from "../../animation/frame.js";

export interface CompositionGuides {
  frame?: number;
  thirds?: boolean;
  /** Fraction of frame width/height inset on each edge; not a broadcast standard. */
  safeInset?: number;
  /** Output-frame pixel coordinates, after camera placement. */
  horizonY?: number;
  vanishingPoints?: readonly { x: number; y: number }[];
}

export async function renderCompositionGuides(
  source: RenderSource,
  panelId: string,
  options: CompositionGuides = {},
): Promise<Buffer> {
  if (options.thirds !== undefined && typeof options.thirds !== "boolean")
    throw new Error("Guide thirds must be boolean");
  if (options.frame !== undefined) assertRenderFrame(options.frame);
  if (
    options.safeInset !== undefined &&
    (!Number.isFinite(options.safeInset) || options.safeInset < 0 || options.safeInset >= 0.5)
  )
    throw new Error("Guide safeInset must be within 0 inclusive and 0.5 exclusive");
  if (options.horizonY !== undefined && !Number.isFinite(options.horizonY))
    throw new Error("Guide horizonY must be finite");
  if (
    options.vanishingPoints?.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))
  )
    throw new Error("Guide vanishing points must have finite coordinates");
  const canvas = renderPanelCanvas(source, panelId, {
    annotations: false,
    ...(options.frame === undefined ? {} : { frame: options.frame }),
  });
  const ctx = canvas.getContext("2d"),
    w = canvas.width,
    h = canvas.height;
  try {
    ctx.beginPath();
    const line = (x0: number, y0: number, x1: number, y1: number) => {
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
    };
    if (options.thirds ?? true)
      for (const part of [1 / 3, 2 / 3]) {
        line(w * part, 0, w * part, h);
        line(0, h * part, w, h * part);
      }
    if (options.safeInset !== undefined) {
      const inset = options.safeInset;
      ctx.rect(w * inset, h * inset, w * (1 - 2 * inset), h * (1 - 2 * inset));
    }
    if (options.horizonY !== undefined) line(0, options.horizonY, w, options.horizonY);
    for (const point of options.vanishingPoints ?? []) {
      for (const [x, y] of [
        [0, 0],
        [w, 0],
        [w, h],
        [0, h],
      ])
        line(point.x, point.y, x!, y!);
      ctx.moveTo(point.x + 5, point.y);
      ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
    }
    ctx.strokeStyle = "#10191d";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = "#50e3ff";
    ctx.lineWidth = 1;
    ctx.stroke();
    return await canvas.toBuffer("png");
  } finally {
    ctx.reset();
  }
}

export async function renderDetail(
  source: RenderSource,
  panelId: string,
  crop: { x: number; y: number; width: number; height: number },
  frame?: number,
): Promise<Buffer> {
  if (
    Object.values(crop).some((v) => !Number.isFinite(v)) ||
    crop.width < 1 ||
    crop.height < 1 ||
    crop.width * crop.height > 16 * 1024 * 1024
  )
    throw new Error("Invalid detail crop");
  const art = renderPanelCanvas(source, panelId, {
    annotations: false,
    ...(frame === undefined ? {} : { frame }),
  });
  try {
    const canvas = new Canvas(crop.width, crop.height),
      ctx = canvas.getContext("2d");
    try {
      ctx.drawImage(art, -crop.x, -crop.y);
      art.getContext("2d").reset();
      return await canvas.toBuffer("png");
    } finally {
      ctx.reset();
    }
  } finally {
    art.getContext("2d").reset();
  }
}
