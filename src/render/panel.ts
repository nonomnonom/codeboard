import { Canvas } from "skia-canvas";
import type { Layer } from "../model/types.js";
import { isProjectSource } from "./source.js";
import type { RenderSource, PanelRenderSource } from "./source.js";
export type { RenderSource, PanelRenderSource } from "./source.js";
import { compositeLayers, RenderCache } from "./layer-compositor.js";
import { drawMotionAnnotations } from "./annotations.js";
import { evaluateCamera } from "../animation/evaluate.js";
import { assertRenderFrame } from "../animation/frame.js";
import { isDrawingColor } from "../drawing/color.js";
import { encodePNG } from "./png.js";
import type { IndexedMeshWarp } from "../animation/mesh-warp.js";

export function renderPanelCanvas(
  source: PanelRenderSource,
  panelId: string,
  options: {
    annotations?: boolean;
    frame?: number;
    camera?: boolean;
    layerIds?: readonly string[];
    cache?: RenderCache;
    meshPoses?: ReadonlyMap<string, IndexedMeshWarp>;
  } = {},
): Canvas {
  const document = isProjectSource(source) ? source._readRenderPanels([panelId]) : source;
  const panel = document.panels.find((entry) => entry.id === panelId);
  if (!panel) throw new Error(`Panel not found: ${panelId}`);
  const frame = options.frame ?? panel.startFrame;
  assertRenderFrame(frame);
  if (!isDrawingColor(document.canvas.background))
    throw new Error("Invalid canvas background color");
  const shot = document.shots.find((entry) => entry.id === panel.shotId);
  const camera = evaluateCamera(shot?.cameraKeyframes ?? [], frame);
  let selection: Set<string> | undefined;
  if (options.layerIds) {
    selection = new Set(options.layerIds);
    if (!selection.size || selection.size !== options.layerIds.length)
      throw new Error("Layer render selection requires nonempty unique layer IDs");
    const ids = new Set<string>();
    const visit = (layers: Layer[]) => {
      for (const layer of layers) {
        ids.add(layer.id);
        if (layer.kind === "group") visit(layer.children);
      }
    };
    visit(panel.layers);
    for (const id of selection)
      if (!ids.has(id)) throw new Error(`Render layer not found in panel ${panelId}: ${id}`);
  }
  const stage = new Canvas(panel.width, panel.height),
    stageContext = stage.getContext("2d");
  try {
    stageContext.fillStyle = document.canvas.background;
    stageContext.fillRect(0, 0, panel.width, panel.height);
    compositeLayers(
      panel,
      panel.layers,
      stageContext,
      frame,
      options.cache ?? new RenderCache(),
      options.camera === false ? undefined : camera,
      undefined,
      undefined,
      1,
      undefined,
      selection,
      undefined,
      options.meshPoses,
    );
    if (options.annotations ?? true) drawMotionAnnotations(stageContext, panel);
    return stage;
  } catch (error) {
    stageContext.reset();
    throw error;
  }
}

export async function renderPanelPNG(
  source: RenderSource,
  panelId: string,
  options: {
    annotations?: boolean;
    frame?: number;
    camera?: boolean;
    layerIds?: readonly string[];
  } = {},
): Promise<Buffer> {
  return encodePNG(renderPanelCanvas(source, panelId, options));
}
