import type { Canvas } from "skia-canvas";
import type { Panel } from "../model/types.js";
import type { ShotAnimation, ShotRenderOptions } from "../model/types/shot.js";
import { shotRenderOptionsSchema } from "../model/schema/shot-render.js";
import { iterateLayers } from "../model/layers.js";
import { controlledShotLayers } from "../animation/controllers.js";
import { defineShotAnimation } from "../animation/shot.js";
import { CodeboardError } from "../model/errors.js";
import { renderPanelCanvas } from "./panel.js";
import { encodePNG } from "./png.js";
import { createBoundMeshEvaluator } from "../animation/mesh-binding.js";
import { createShotCompositor } from "./compositing.js";
import { validateCompositeSources } from "../model/validation/compositing.js";

function shotCanvas(
  animation: ShotAnimation,
  frame: number,
  meshes: ReadonlyMap<string, ReturnType<typeof createBoundMeshEvaluator>>,
  options: ShotRenderOptions,
): Canvas {
  if (!Number.isSafeInteger(frame) || frame < 0 || frame >= animation.durationFrames)
    throw new CodeboardError("INVALID_ARGUMENT", "Shot frame is outside its duration");
  const panel: Panel = {
    id: animation.id,
    shotId: animation.shotId,
    title: animation.name,
    number: "",
    width: animation.canvas.width,
    height: animation.canvas.height,
    startFrame: 0,
    durationFrames: animation.durationFrames,
    transition: { type: "cut", durationFrames: 0 },
    status: "working",
    action: "",
    dialogue: "",
    camera: "",
    notes: "",
    layers: controlledShotLayers(animation, frame),
    motion: [],
    revision: 0,
  };
  return renderPanelCanvas(
    {
      canvas: animation.canvas,
      panels: [panel],
      shots: [
        {
          id: animation.shotId,
          sceneId: "render:scene",
          name: animation.name,
          panelIds: [animation.id],
          cameraKeyframes: animation.cameraKeyframes,
        },
      ],
    },
    animation.id,
    {
      frame,
      annotations: false,
      ...(options.layerIds === undefined ? {} : { layerIds: options.layerIds }),
      meshPoses: new Map(
        [...meshes].map(([layerId, evaluate]) => {
          try {
            return [layerId, evaluate(frame)] as const;
          } catch (cause) {
            if (cause instanceof CodeboardError)
              throw new CodeboardError(cause.code, cause.message, {
                details: { ...cause.details, animationId: animation.id, layerId, frame },
                cause,
              });
            throw cause;
          }
        }),
      ),
    },
  );
}

export function createShotRenderSession(animation: ShotAnimation, options: ShotRenderOptions = {}) {
  const parsed = shotRenderOptionsSchema.safeParse(options);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid shot render options", {
      cause: parsed.error,
    });
  const settings = parsed.data;
  const source = defineShotAnimation(animation);
  const graph =
    settings.compositing === undefined
      ? settings.layerIds
        ? undefined
        : source.compositing
      : settings.compositing;
  if (graph || settings.layerIds) {
    const ids = new Set([...iterateLayers(source.layers)].map((layer) => layer.id));
    if (graph) validateCompositeSources(graph, ids, source.id);
    for (const layerId of settings.layerIds ?? [])
      if (!ids.has(layerId))
        throw new CodeboardError("INVALID_ARGUMENT", "Shot render layer does not exist", {
          details: { animationId: source.id, layerId },
        });
  }
  if (settings.background === "transparent") source.canvas.background = "transparent";
  const background = source.canvas.background;
  const compositor = graph
    ? createShotCompositor(graph, source.canvas.width, source.canvas.height)
    : undefined;
  if (compositor) source.canvas.background = "transparent";
  const meshes = new Map(
    (source.meshes ?? []).map(
      (binding) => [binding.layerId, createBoundMeshEvaluator(binding, source)] as const,
    ),
  );
  const frame = (position: number) =>
    compositor
      ? compositor(
          (layerIds) => shotCanvas(source, position, meshes, { layerIds }),
          background,
          position,
        )
      : shotCanvas(source, position, meshes, settings);
  return {
    durationFrames: source.durationFrames,
    frameRate: { ...source.frameRate },
    canvas: { ...source.canvas, background },
    frame,
    png: (position: number) => encodePNG(frame(position)),
  };
}

export async function renderShotFramePNG(
  animation: ShotAnimation,
  frame: number,
  options: ShotRenderOptions = {},
): Promise<Buffer> {
  return createShotRenderSession(animation, options).png(frame);
}
