import { Canvas } from "skia-canvas";
import { isDrawingColor } from "../../drawing/color.js";
import { isProjectSource } from "../source.js";
import { renderPanelCanvas, type RenderSource } from "../panel.js";
import { assertRenderFrame } from "../../animation/frame.js";

export interface OnionSkinSample {
  panelId: string;
  frame?: number;
  layerIds?: readonly string[];
  tint?: string;
  opacity?: number;
}

export async function renderOnionSkin(
  source: RenderSource,
  samples: readonly OnionSkinSample[],
  options: { opacity?: number; camera?: boolean } = {},
): Promise<Buffer> {
  const opacity = options.opacity ?? 0.3;
  if (
    !samples.length ||
    samples.length > 8 ||
    !Number.isFinite(opacity) ||
    opacity < 0 ||
    opacity > 1
  )
    throw new Error("Onion skin requires 1..8 samples and opacity 0..1");
  for (const sample of samples) {
    if (sample.frame !== undefined) assertRenderFrame(sample.frame);
    if (sample.tint !== undefined && !isDrawingColor(sample.tint))
      throw new Error("Invalid onion skin tint");
    if (
      sample.opacity !== undefined &&
      (!Number.isFinite(sample.opacity) || sample.opacity < 0 || sample.opacity > 1)
    )
      throw new Error("Onion skin sample opacity must be between 0 and 1");
  }
  const doc = isProjectSource(source)
    ? source._readRenderPanels(samples.map((sample) => sample.panelId))
    : source;
  const panels = samples.map((sample) => {
    const panel = doc.panels.find((panel) => panel.id === sample.panelId);
    if (!panel) throw new Error(`Panel not found: ${sample.panelId}`);
    return panel;
  });
  const first = panels[0]!;
  if (panels.some((panel) => panel.width !== first.width || panel.height !== first.height))
    throw new Error("Onion skin panels must have matching dimensions");
  const canvas = new Canvas(first.width, first.height),
    ctx = canvas.getContext("2d");
  const transparent = { ...doc, canvas: { ...doc.canvas, background: "transparent" } };
  try {
    for (const [i, sample] of samples.entries()) {
      ctx.globalAlpha = sample.opacity ?? (i === 0 ? 1 : opacity);
      const isolated = sample.tint !== undefined || sample.layerIds !== undefined;
      const art = renderPanelCanvas(i === 0 && !isolated ? doc : transparent, sample.panelId, {
        annotations: false,
        camera: options.camera ?? false,
        ...(sample.frame === undefined ? {} : { frame: sample.frame }),
        ...(sample.layerIds ? { layerIds: sample.layerIds } : {}),
      });
      try {
        if (sample.tint !== undefined) {
          const tint = art.getContext("2d");
          tint.globalCompositeOperation = "source-in";
          tint.fillStyle = sample.tint;
          tint.fillRect(0, 0, art.width, art.height);
        }
        ctx.drawImage(art, 0, 0);
      } finally {
        art.getContext("2d").reset();
      }
    }
    return await canvas.toBuffer("png");
  } finally {
    ctx.reset();
  }
}
