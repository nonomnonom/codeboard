import { iterateLayers } from "./layers.js";
import { scene3DKeyCollections } from "../animation/scene3d.js";
import { drawingElementSchema } from "./schema/artwork.js";
import type { DrawingElement } from "./types.js";
import { recordComponentOrigin } from "./component-origins.js";
import { componentRevisionTarget } from "./component-source.js";
import type { Id, Layer, StoryboardDocument, ReviewComment, Transform } from "./types.js";
import { identityTransform } from "./types.js";
import {
  cloneLayers,
  cloneLayersWithIdentities,
  visitLayers,
  findLayer,
  findPanel,
} from "./layers.js";
import { CodeboardError } from "./errors.js";
import { transform as transformSchema } from "./schema/primitives.js";

export function assertStaticComponent(layers: Layer[]): void {
  visitLayers(layers, (layer) => {
    if (layer.kind === "group" && layer.drawingSequence !== undefined)
      throw new Error(
        "Components capture static artwork; capture an individual drawing instead of a drawing sequence",
      );
  });
}

/** Copy artwork into component-local space while removing shot timing and instance provenance. */
export function cloneStaticComponentLayers(
  source: Layer[],
  nextId: (prefix: string) => Id,
): Layer[] {
  assertStaticComponent(source);
  const layers = cloneLayers(source, nextId);
  visitLayers(layers, (l) => {
    l.keyframes = [];
    l.exposure = null;
    delete l.componentSource;
    if (l.kind !== "group")
      for (const e of l.elements) {
        if (e.kind === "raster-stroke") delete e.reveal;
        if (e.kind === "scene-3d") {
          delete e.scene.camera.keyframes;
          for (const node of e.scene.nodes) delete node.keyframes;
        }
      }
  });
  layers[0]!.transform = identityTransform();
  return layers;
}

/** Replace instance descendants on a transaction draft after checking external references. */
export function refreshComponentArtwork(
  d: StoryboardDocument,
  layerId: Id,
  next: (prefix: string) => Id,
  comments: "reject" | "anchor-to-instance" | undefined,
): void {
  const { panel, layer } = findLayer(d, layerId);
  if (layer.kind !== "group" || !layer.componentSource)
    throw new Error("Layer is not a component instance");
  const c = d.components.find((c) => c.id === layer.componentSource!.id);
  if (!c) throw new Error("Missing component source");
  const removedLayers = new Set<Id>(),
    removedElements = new Set<Id>();
  visitLayers(layer.children, (child) => {
    removedLayers.add(child.id);
    if (child.kind !== "group")
      for (const element of child.elements) removedElements.add(element.id);
  });
  const lock = d.locks.find((lock) => removedLayers.has(lock.targetId));
  if (lock)
    throw new Error(`Cannot refresh locked descendant: unlock ${lock.targetId} first (${lock.id})`);
  visitLayers(panel.layers, (entry) => {
    if (removedLayers.has(entry.id)) return;
    if (entry.kind === "group" && entry.twoBoneRig && removedLayers.has(entry.twoBoneRig.elbowId))
      throw new Error("Unbind the two-bone rig before refreshing its elbow artwork");
    if (entry.maskLayerId && removedLayers.has(entry.maskLayerId))
      throw new Error(
        `Cannot refresh ${layerId}: layer ${entry.id} uses descendant mask ${entry.maskLayerId}`,
      );
    if (
      entry.kind === "group" &&
      entry.drawingSequence?.some(
        (key) => key.drawingId !== null && removedLayers.has(key.drawingId),
      )
    )
      throw new Error(
        `Cannot refresh ${layerId}: drawing sequence ${entry.id} uses its descendants`,
      );
  });
  const affected = (comment: ReviewComment) =>
    removedLayers.has(comment.anchor.layerId ?? "") ||
    removedElements.has(comment.anchor.elementId ?? "");
  const anchored = d.comments.filter(affected);
  if (anchored.length && comments !== "anchor-to-instance")
    throw new Error(
      `Refresh would replace artwork referenced by comments: ${anchored.map((comment) => comment.id).join(", ")}. Use comments: "anchor-to-instance" to retain those notes on the instance`,
    );
  const copied = cloneLayersWithIdentities(c.layers, next);
  const children = copied.layers;
  if (anchored.length)
    d.comments = d.comments.map((comment) => {
      if (!affected(comment)) return comment;
      const { layerId: _layer, elementId: _element, panelId: _panel, ...position } = comment.anchor;
      return { ...comment, anchor: { ...position, panelId: panel.id, layerId: layer.id } };
    });
  layer.children = children;
  layer.componentSource.version = c.version;
  recordComponentOrigin(d, {
    instanceId: layer.id,
    componentId: c.id,
    version: c.version,
    source: c.layers,
    identities: copied.identities,
  });
}

export function captureComponentArtwork(
  d: StoryboardDocument,
  layerId: Id,
  name: string,
  next: (prefix: string) => Id,
  requestedId?: Id,
): Id {
  const source = [findLayer(d, layerId).layer];
  const layers = cloneStaticComponentLayers(source, next);
  const id = requestedId ?? next("component");
  d.components.push({ id, name, version: 1, layers });
  return id;
}

export function reviseComponentArtwork(
  d: StoryboardDocument,
  id: Id,
  sourceLayerId: Id,
  next: (prefix: string) => Id,
): void {
  const c = d.components.find((c) => c.id === id);
  if (!c) throw new Error(`Component not found: ${id}`);
  const version = c.version + 1;
  if (!Number.isSafeInteger(version))
    throw new CodeboardError("RESOURCE_LIMIT", "Component version exceeds the safe integer range", {
      details: { reason: "COMPONENT_VERSION_LIMIT", componentId: id, version: c.version },
    });
  const source = [findLayer(d, sourceLayerId).layer];
  const layers = cloneStaticComponentLayers(source, next);
  c.layers = layers;
  c.version = version;
}

export function instantiateComponentArtwork(
  d: StoryboardDocument,
  componentId: Id,
  panelId: Id,
  transform: Partial<Transform>,
  next: (prefix: string) => Id,
  requestedId?: Id,
): Id {
  const c = d.components.find((c) => c.id === componentId);
  if (!c) throw new Error(`Component not found: ${componentId}`);
  const panel = findPanel(d, panelId);
  const preparedTransform = transformSchema.parse({ ...identityTransform(), ...transform });
  const copied = cloneLayersWithIdentities(c.layers, next);
  const layers = copied.layers;
  const id = requestedId ?? next("layer");
  panel.layers.push({
    id,
    name: c.name,
    kind: "group",
    children: layers,
    visible: true,
    opacity: 1,
    blendMode: "source-over",
    transform: preparedTransform,
    clipToBelow: false,
    keyframes: [],
    depth: 1,
    exposure: null,
    componentSource: { id: c.id, version: c.version },
  });
  recordComponentOrigin(d, {
    instanceId: id,
    componentId: c.id,
    version: c.version,
    source: c.layers,
    identities: copied.identities,
  });
  return id;
}

/** Replace one source object with stable identity; existing instances retain their old baselines. */
export function replaceComponentElementArtwork(
  document: StoryboardDocument,
  componentId: Id,
  layerId: Id,
  input: DrawingElement,
  expectedComponentVersion: number,
): void {
  const { component, version } = componentRevisionTarget(
    document,
    componentId,
    expectedComponentVersion,
  );
  const parsed = drawingElementSchema.safeParse(input);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid component source element", {
      details: { issues: parsed.error.issues },
    });
  const element = parsed.data as DrawingElement;
  if (
    element.kind === "scene-3d" &&
    scene3DKeyCollections(element.scene).some((keys) => keys.length)
  )
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Static component source cannot contain 3D animation",
    );
  if (element.kind === "raster-stroke" && element.reveal !== undefined)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Static component source cannot contain timed stroke reveal",
    );
  const layer = [...iterateLayers(component.layers)].find((entry) => entry.id === layerId);
  if (!layer || layer.kind === "group")
    throw new CodeboardError("INVALID_ARGUMENT", "Component drawing layer not found");
  const index = layer.elements.findIndex((entry) => entry.id === element.id);
  if (index < 0)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Source replacement must retain an existing element ID",
    );
  layer.elements[index] = structuredClone(element);
  component.version = version;
}
