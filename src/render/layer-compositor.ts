import { validateDimensions } from "../model/validation/pixels.js";
import { paintCached, type RenderCache } from "./cache.js";
import { resolveLayerMask } from "./mask-placement.js";
import { placeLayer, placeCameraPlane, placeSurface, type RenderMatrix } from "./placement.js";
import { compositionBounds, type CompositionBounds } from "./composition-bounds.js";
export { RenderCache } from "./cache.js";
import { Canvas, type CanvasRenderingContext2D } from "skia-canvas";
import type { Layer, Panel } from "../model/types.js";
import { drawElement } from "./vector-renderer.js";
import { evaluateLayer, evaluateDrawing, type EvaluatedCamera } from "../animation/evaluate.js";
import { cameraPlane } from "../animation/camera-plane.js";
import type { IndexedMeshWarp } from "../animation/mesh-warp.js";
import { renderMeshSurface } from "./mesh-surface.js";
import { rebaseSurface } from "./placement.js";
import { applyLayerEffects, prepareLayerEffects } from "./layer-effects.js";

function renderLayer(
  panel: Panel,
  layer: Layer,
  frame: number,
  visited = new Set<string>(),
  force = false,
  cache?: RenderCache,
  parent?: RenderMatrix,
  resolution = 1,
  bounds: CompositionBounds = { x: 0, y: 0, width: panel.width, height: panel.height },
  selection?: ReadonlySet<string>,
  panelToSurface?: RenderMatrix,
  meshPoses?: ReadonlyMap<string, IndexedMeshWarp>,
): Canvas {
  if (visited.has(layer.id)) throw new Error(`Circular layer mask involving ${layer.id}`);
  const nextVisited = new Set(visited).add(layer.id);
  const width = Math.ceil(bounds.width * resolution),
    height = Math.ceil(bounds.height * resolution);
  validateDimensions(width, height);
  if (!layer.visible && !force) return new Canvas(width, height);
  if (layer.exposure && (frame < layer.exposure.startFrame || frame >= layer.exposure.endFrame))
    return new Canvas(width, height);
  const state = evaluateLayer(layer, frame);
  if (state.transform.scaleX === 0 || state.transform.scaleY === 0)
    return new Canvas(width, height);
  const { filters, padding } = prepareLayerEffects(layer, frame, resolution);
  if (padding) {
    bounds = {
      x: bounds.x - padding / resolution,
      y: bounds.y - padding / resolution,
      width: (width + 2 * padding) / resolution,
      height: (height + 2 * padding) / resolution,
    };
    if (parent) parent = { ...parent, e: parent.e + padding, f: parent.f + padding };
    if (panelToSurface)
      panelToSurface = {
        ...panelToSurface,
        e: panelToSurface.e + padding,
        f: panelToSurface.f + padding,
      };
  }
  const surfaceWidth = Math.ceil(bounds.width * resolution),
    surfaceHeight = Math.ceil(bounds.height * resolution);
  validateDimensions(surfaceWidth, surfaceHeight);
  const canvas = new Canvas(surfaceWidth, surfaceHeight);
  const ctx = canvas.getContext("2d");
  ctx.save();
  try {
    if (parent) ctx.setTransform(parent.a, parent.b, parent.c, parent.d, parent.e, parent.f);
    else placeSurface(ctx, resolution, bounds, panelToSurface);
    placeLayer(ctx, state.transform, layer.pivot);
    const mesh = meshPoses?.get(layer.id);
    if (mesh) {
      const layerToSurface = ctx.getTransform();
      // Rasterize at the largest local-to-output stretch, including ancestor transforms.
      const { a, b, c, d } = layerToSurface;
      const stretch = (Math.hypot(a + d, b - c) + Math.hypot(a - d, b + c)) / 2;
      const meshResolution = Math.max(resolution, Math.ceil(stretch * 4) / 4);
      const base = panelToSurface ?? {
        a: resolution,
        b: 0,
        c: 0,
        d: resolution,
        e: -bounds.x * resolution,
        f: -bounds.y * resolution,
      };
      const warped = renderMeshSurface(
        mesh,
        meshResolution,
        (texture, bindBounds, localToTexture) => {
          if (layer.kind === "group") {
            const panelToTexture = rebaseSurface(layerToSurface, base, localToTexture);
            const drawing = evaluateDrawing(layer.drawingSequence, frame);
            const children =
              drawing === undefined
                ? layer.children
                : layer.children.filter((child) => child.id === drawing);
            texture.resetTransform();
            compositeLayers(
              panel,
              children,
              texture,
              frame,
              cache,
              undefined,
              nextVisited,
              localToTexture,
              meshResolution,
              bindBounds,
              selection?.has(layer.id) ? undefined : selection,
              panelToTexture,
              meshPoses,
            );
          } else if (cache && layer.kind === "raster")
            paintCached(texture, cache, panel, layer, frame);
          else for (const element of layer.elements) drawElement(texture, element, frame);
        },
      );
      ctx.drawImage(warped.canvas, warped.x, warped.y, warped.width, warped.height);
    } else if (layer.kind === "group") {
      const matrix = ctx.getTransform();
      ctx.resetTransform();
      const drawing = evaluateDrawing(layer.drawingSequence, frame);
      const children =
        drawing === undefined
          ? layer.children
          : layer.children.filter((child) => child.id === drawing);
      compositeLayers(
        panel,
        children,
        ctx,
        frame,
        cache,
        undefined,
        nextVisited,
        matrix,
        resolution,
        bounds,
        selection?.has(layer.id) ? undefined : selection,
        panelToSurface,
        meshPoses,
      );
    } else if (cache && layer.kind === "raster") paintCached(ctx, cache, panel, layer, frame);
    else for (const element of layer.elements) drawElement(ctx, element, frame);
  } finally {
    ctx.restore();
  }
  if (layer.maskLayerId) {
    const { mask, maskParent, maskOpacity } = resolveLayerMask(
      panel,
      layer,
      frame,
      ctx,
      resolution,
      bounds,
      panelToSurface,
      meshPoses,
    );
    const maskCanvas = renderLayer(
      panel,
      mask,
      frame,
      nextVisited,
      true,
      cache,
      maskParent,
      resolution,
      bounds,
      undefined,
      panelToSurface,
      meshPoses,
    );
    ctx.save();
    try {
      ctx.globalCompositeOperation = "destination-in";
      ctx.globalAlpha = maskOpacity;
      ctx.drawImage(maskCanvas, 0, 0);
    } finally {
      ctx.restore();
    }
  }
  const filtered = applyLayerEffects(canvas, filters);
  if (!padding) return filtered;
  const cropped = new Canvas(width, height);
  cropped
    .getContext("2d")
    .drawImage(filtered, padding, padding, width, height, 0, 0, width, height);
  return cropped;
}

export function compositeLayers(
  panel: Panel,
  layers: Layer[],
  target: CanvasRenderingContext2D,
  frame = panel.startFrame,
  cache?: RenderCache,
  camera?: EvaluatedCamera,
  visited = new Set<string>(),
  parent?: RenderMatrix,
  resolution = 1,
  bounds = compositionBounds(panel, layers, frame, camera),
  selection?: ReadonlySet<string>,
  panelToSurface?: RenderMatrix,
  meshPoses?: ReadonlyMap<string, IndexedMeshWarp>,
): void {
  const selected = (layer: Layer): boolean =>
    !selection ||
    selection.has(layer.id) ||
    (layer.kind === "group" && layer.children.some(selected));
  let below: Canvas | undefined;
  for (const [index, layer] of layers.entries()) {
    const state = evaluateLayer(layer, frame);
    const placement = camera
      ? cameraPlane(camera, state.depth, panel.width, panel.height)
      : undefined;
    const paint = selected(layer);
    if (!paint && !layers[index + 1]?.clipToBelow) {
      below = undefined;
      continue;
    }
    if (!layer.visible) {
      below = undefined;
      continue;
    }
    if (state.opacity === 0) {
      below = undefined;
      continue;
    }
    if (layer.exposure && (frame < layer.exposure.startFrame || frame >= layer.exposure.endFrame)) {
      below = undefined;
      continue;
    }
    if (layer.clipToBelow && !below) continue;
    if (
      paint &&
      cache &&
      (!panelToSurface || parent) &&
      !meshPoses?.has(layer.id) &&
      layer.kind !== "group" &&
      !layer.maskLayerId &&
      !layer.effects?.length &&
      !layer.clipToBelow &&
      !layers[index + 1]?.clipToBelow &&
      (layer.kind === "raster" || (state.opacity === 1 && layer.blendMode === "source-over"))
    ) {
      target.save();
      try {
        if (camera && placement) placeCameraPlane(target, panel, camera, placement);
        if (parent) target.transform(parent.a, parent.b, parent.c, parent.d, parent.e, parent.f);
        placeLayer(target, state.transform, layer.pivot);
        target.globalAlpha = state.opacity;
        target.globalCompositeOperation = layer.blendMode;
        if (layer.kind === "vector") for (const e of layer.elements) drawElement(target, e, frame);
        else paintCached(target, cache, panel, layer, frame);
      } finally {
        target.restore();
      }
      below = undefined;
      continue;
    }
    const layerResolution = placement ? Math.max(1, Math.ceil(placement.zoom * 4) / 4) : resolution;
    const rendered = renderLayer(
      panel,
      layer,
      frame,
      visited,
      false,
      cache,
      parent,
      layerResolution,
      bounds,
      paint ? selection : undefined,
      panelToSurface,
      meshPoses,
    );
    const alphaSource =
      selection &&
      layer.kind === "group" &&
      paint &&
      !selection.has(layer.id) &&
      layers[index + 1]?.clipToBelow
        ? renderLayer(
            panel,
            layer,
            frame,
            visited,
            false,
            cache,
            parent,
            layerResolution,
            bounds,
            undefined,
            panelToSurface,
            meshPoses,
          )
        : rendered;
    if (layer.clipToBelow && below) {
      for (const surface of new Set([rendered, alphaSource])) {
        const clippingContext = surface.getContext("2d");
        clippingContext.globalCompositeOperation = "destination-in";
        clippingContext.drawImage(below, 0, 0, surface.width, surface.height);
      }
    }
    if (paint) {
      target.save();
      try {
        if (camera && placement) placeCameraPlane(target, panel, camera, placement);
        target.globalAlpha = state.opacity;
        target.globalCompositeOperation = layer.blendMode;
        if (camera)
          target.drawImage(
            rendered,
            bounds.x,
            bounds.y,
            rendered.width / layerResolution,
            rendered.height / layerResolution,
          );
        else target.drawImage(rendered, 0, 0);
      } finally {
        target.restore();
      }
    }
    below = alphaSource;
    if (state.opacity < 1 && layers[index + 1]?.clipToBelow) {
      below = new Canvas(rendered.width, rendered.height);
      const alpha = below.getContext("2d");
      alpha.globalAlpha = state.opacity;
      alpha.drawImage(alphaSource, 0, 0);
    }
  }
}
