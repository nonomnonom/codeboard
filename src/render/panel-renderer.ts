import { renderPanelCanvas } from "./panel.js";
export { renderPanelCanvas, renderPanelPNG } from "./panel.js";
import { compositeTransition } from "./transition.js";
import type { Canvas } from "skia-canvas";
import { isProjectSource, documentOf } from "./source.js";
import { RenderCache } from "./layer-compositor.js";
import { parseStoryboardDocument } from "../model/validation/document.js";
import { assertRenderFrame, selectFramePanels } from "../animation/frame.js";
import { encodePNG } from "./png.js";

import type { RenderSource } from "./source.js";
export type { RenderSource, PanelRenderSource } from "./source.js";

export function renderFrameCanvas(
  source: RenderSource,
  frame: number,
  options: { annotations?: boolean; cache?: RenderCache } = {},
): Canvas {
  assertRenderFrame(frame);
  const document = isProjectSource(source) ? source._readRenderFrame(frame) : source;
  const { panel, incoming: next, progress } = selectFramePanels(document.panels, frame);
  const current = renderPanelCanvas(document, panel.id, {
    ...options,
    frame,
    annotations: options.annotations ?? false,
  });
  const transition = panel.transition;
  if (!next) return current;
  let incoming: Canvas | undefined, output: Canvas | undefined;
  try {
    incoming = renderPanelCanvas(document, next.id, {
      ...options,
      frame: next.startFrame,
      annotations: options.annotations ?? false,
    });
    output = compositeTransition(current, incoming, transition.type, progress);
    return output;
  } catch (error) {
    output?.getContext("2d").reset();
    throw error;
  } finally {
    incoming?.getContext("2d").reset();
    current.getContext("2d").reset();
  }
}

export async function renderFramePNG(
  source: RenderSource,
  frame: number,
  options: { annotations?: boolean } = {},
): Promise<Buffer> {
  return encodePNG(renderFrameCanvas(source, frame, options));
}

/** A frozen document snapshot with bounded artwork cache; create another session after edits. */
export function createRenderSession(source: RenderSource, maxCacheBytes?: number) {
  const document = parseStoryboardDocument(documentOf(source));
  const cache = new RenderCache(maxCacheBytes);
  let lastPanel = "";
  const select = (id: string) => {
    if (lastPanel !== id) {
      cache.clear();
      lastPanel = id;
    }
  };
  return {
    durationFrames: document.panels.reduce(
      (n, p) => Math.max(n, p.startFrame + p.durationFrames),
      0,
    ),
    frame: (frame: number) => {
      select(
        document.panels.find(
          (p) => frame >= p.startFrame && frame < p.startFrame + p.durationFrames,
        )?.id ?? "",
      );
      return renderFrameCanvas(document, frame, { cache });
    },
    panel: (id: string, frame?: number) => {
      select(id);
      return renderPanelCanvas(document, id, {
        cache,
        annotations: false,
        ...(frame === undefined ? {} : { frame }),
      });
    },
  };
}
