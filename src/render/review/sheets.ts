import { validateDimensions } from "../../model/validation/pixels.js";
import { Canvas } from "skia-canvas";
import { documentOf } from "../source.js";
import { createRenderSession, renderFrameCanvas, type RenderSource } from "../panel-renderer.js";
import { assertRenderFrame } from "../../animation/frame.js";

export async function renderContactSheet(
  source: RenderSource,
  options: { columns?: number; thumbnailWidth?: number; panelIds?: readonly string[] } = {},
): Promise<Buffer> {
  const doc = documentOf(source);
  const columns = options.columns ?? 3,
    width = options.thumbnailWidth ?? 400;
  if (
    !Number.isInteger(columns) ||
    columns < 1 ||
    columns > 12 ||
    !Number.isInteger(width) ||
    width < 80 ||
    width > 1920
  )
    throw new Error("Contact sheet columns must be 1..12; thumbnail width 80..1920");
  const byId = new Map(doc.panels.map((panel) => [panel.id, panel]));
  if (
    options.panelIds !== undefined &&
    (!Array.isArray(options.panelIds) ||
      !options.panelIds.length ||
      new Set(options.panelIds).size !== options.panelIds.length)
  )
    throw new Error("Contact sheet panelIds must be a nonempty list of unique panel IDs");
  const ids =
    options.panelIds ??
    doc.scenes.flatMap((scene) =>
      scene.shotIds.flatMap((id) => doc.shots.find((shot) => shot.id === id)!.panelIds),
    );
  const panels = ids.map((id) => {
    const panel = byId.get(id);
    if (!panel) throw new Error(`Panel not found: ${id}`);
    return panel;
  });
  const height = Math.round((width * doc.canvas.height) / doc.canvas.width),
    rows = Math.ceil(panels.length / columns),
    gap = 16;
  const canvasWidth = columns * (width + gap) + gap,
    canvasHeight = Math.max(1, rows) * (height + 55) + gap;
  validateDimensions(canvasWidth, canvasHeight);
  const canvas = new Canvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext("2d");
  try {
    const session = createRenderSession(doc);
    ctx.fillStyle = "#e8e0cd";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    panels.forEach((p, i) => {
      const x = gap + (i % columns) * (width + gap),
        y = gap + Math.floor(i / columns) * (height + 55);
      const panel = session.panel(p.id, p.startFrame + Math.floor(p.durationFrames * 0.6));
      try {
        ctx.drawImage(panel, x, y, width, height);
      } finally {
        panel.getContext("2d").reset();
      }
      ctx.fillStyle = "#171c20";
      ctx.font = "14px sans-serif";
      ctx.fillText(`${p.number}  ${p.title}`, x, y + height + 20, width);
      ctx.font = "12px sans-serif";
      ctx.fillText(`${p.startFrame}f / ${p.durationFrames}f`, x, y + height + 37, width);
    });
    return await canvas.toBuffer("png");
  } finally {
    ctx.reset();
  }
}

/** Timeline samples in caller order, including drawing substitutions and shot transitions. */
export async function renderFrameSheet(
  source: RenderSource,
  frames: readonly number[],
  options: { columns?: number; thumbnailWidth?: number } = {},
): Promise<Buffer> {
  const columns = options.columns ?? 4,
    width = options.thumbnailWidth ?? 320,
    gap = 16,
    caption = 28;
  if (!Array.isArray(frames) || !frames.length)
    throw new Error("Frame sheet requires a nonempty frame list");
  for (const frame of frames) assertRenderFrame(frame);
  if (
    !Number.isInteger(columns) ||
    columns < 1 ||
    columns > 12 ||
    !Number.isInteger(width) ||
    width < 80 ||
    width > 1920
  )
    throw new Error("Frame sheet columns must be 1..12; thumbnail width 80..1920");
  const first = renderFrameCanvas(source, frames[0]!);
  try {
    const height = Math.round((width * first.height) / first.width),
      rows = Math.ceil(frames.length / columns);
    const canvasWidth = columns * (width + gap) + gap,
      canvasHeight = rows * (height + caption + gap) + gap;
    validateDimensions(canvasWidth, canvasHeight);
    const canvas = new Canvas(canvasWidth, canvasHeight),
      ctx = canvas.getContext("2d");
    try {
      ctx.fillStyle = "#e8e0cd";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (const [index, frame] of frames.entries()) {
        const art = index === 0 ? first : renderFrameCanvas(source, frame);
        try {
          const x = gap + (index % columns) * (width + gap),
            y = gap + Math.floor(index / columns) * (height + caption + gap);
          ctx.drawImage(art, x, y, width, height);
          ctx.fillStyle = "#171c20";
          ctx.font = "14px sans-serif";
          ctx.fillText(`${frame}f`, x, y + height + 20, width);
        } finally {
          art.getContext("2d").reset();
        }
      }
      return await canvas.toBuffer("png");
    } finally {
      ctx.reset();
    }
  } finally {
    first.getContext("2d").reset();
  }
}
