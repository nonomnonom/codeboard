import {matrixFromTransform,multiplyMatrices} from "../drawing/math.js";
import type {
  BrushPreset, DrawingElement, Id, Layer, LayerChanges, LayerOptions, MotionAnnotation, NewDrawingElement, Panel, PanelOptions,
  PathCommand, Point, RasterStroke, StoryboardDocument, StrokeOptions, Transform, VectorStroke,
  VectorStrokeOptions, PixelBuffer, PixelRegion, RasterSurface, Pivot, VectorFill,
} from "../model/types.js";
import { readPixelRegion, writePixelRegion, validatePixels } from "../drawing/pixels.js";
import {outlinedStroke} from "../drawing/stroke-outline.js";
import {combinePaths,type PathBooleanOperation} from "../drawing/path-geometry.js";

export interface ProjectActions {
  _addScene(sequenceId:Id,name:string,id?:Id):SceneHandle;
  toJSON(): StoryboardDocument;
  _addShot(sceneId: Id, name: string, id?: Id): ShotHandle;
  _addPanel(shotId: Id, options: PanelOptions): PanelHandle;
  _addLayer(panelId: Id, kind: "raster" | "vector" | "group", name: string, options: LayerOptions, parentGroupId?: Id): LayerHandle;
  _addElement(panelId: Id, layerId: Id, element: NewDrawingElement): Id;
  _readPixels(panelId: Id, layerId: Id, elementId: Id, region?: PixelRegion): PixelBuffer;
  _addMotion(panelId: Id, annotation: Omit<MotionAnnotation, "id"> & { id?: Id }): Id;
  _updatePanel(panelId: Id, changes: Partial<Pick<Panel, "title" | "durationFrames" | "action" | "dialogue" | "camera" | "notes">>): void;
  _updateLayer(panelId: Id, layerId: Id, changes: LayerChanges): void;
  _updateElement(panelId: Id, layerId: Id, elementId: Id, updater: (element: DrawingElement) => DrawingElement): void;
  _updateElements(panelId: Id, layerId: Id, elementIds: Id[], updater: (element: DrawingElement) => DrawingElement): void;
  _remove(panelId: Id, layerId?: Id, elementIds?: Id[]): void;
}

export class SequenceHandle {
  constructor(private project:ProjectActions,readonly id:Id){}
  addScene(name:string,id?:Id){return this.project._addScene(this.id,name,id);}
}

export class SceneHandle {
  constructor(private project: ProjectActions, readonly id: Id) {}
  addShot(name: string, id?: Id): ShotHandle { return this.project._addShot(this.id, name, id); }
}

export class ShotHandle {
  constructor(private project: ProjectActions, readonly id: Id) {}
  addPanel(options: PanelOptions = {}): PanelHandle { return this.project._addPanel(this.id, options); }
}

export class PanelHandle {
  constructor(private project: ProjectActions, readonly id: Id) {}
  addRasterLayer(name: string, options: LayerOptions = {}, parentGroupId?: Id): LayerHandle { return this.project._addLayer(this.id, "raster", name, options, parentGroupId); }
  addVectorLayer(name: string, options: LayerOptions = {}, parentGroupId?: Id): LayerHandle { return this.project._addLayer(this.id, "vector", name, options, parentGroupId); }
  addGroup(name: string, options: LayerOptions = {}, parentGroupId?: Id): LayerHandle { return this.project._addLayer(this.id, "group", name, options, parentGroupId); }
  addMotion(label: string, from: Point, to: Point, color = "#d14a32", id?: Id): Id { return this.project._addMotion(this.id, { label, from, to, color, ...(id ? { id } : {}) }); }
  revise(changes: Partial<Pick<Panel, "title" | "durationFrames" | "action" | "dialogue" | "camera" | "notes">>): this { this.project._updatePanel(this.id, changes); return this; }
  layer(id: Id): LayerHandle { return new LayerHandle(this.project, this.id, id); }
}

export class LayerHandle {
  constructor(private project: ProjectActions, readonly panelId: Id, readonly id: Id) {}

  rasterSurface(image: PixelBuffer, options: Partial<Pick<RasterSurface,"id"|"name"|"matrix"|"opacity"|"visible">> = {}): Id {
    validatePixels(image);
    return this.project._addElement(this.panelId,this.id,{kind:"raster-surface",...structuredClone(image),matrix:[1,0,0,1,0,0],opacity:1,visible:true,...structuredClone(options)});
  }

  readPixels(elementId: Id, region?: PixelRegion): PixelBuffer {
    return this.project._readPixels(this.panelId,this.id,elementId,region);
  }

  editPixels(elementId: Id, region: PixelRegion, edit: (patch: PixelBuffer) => void): this {
    return this.edit(elementId,element=>{
      if(element.kind!=="raster-surface")throw new Error(`Element ${elementId} is not a pixel surface`);
      const patch=readPixelRegion(element,region),result:unknown=edit(patch);
      if(result&&typeof (result as {then?:unknown}).then==="function")throw new Error("Pixel edit callbacks must be synchronous");
      if(patch.width!==region.width||patch.height!==region.height)throw new Error("Pixel edits cannot resize the selected region");
      writePixelRegion(element,region.x,region.y,patch);return element;
    });
  }

  rasterStroke(points: Point[], brush: BrushPreset, options: StrokeOptions = {}): Id {
    const stroke: Omit<RasterStroke, "id"> & { id?: Id } = {
      kind: "raster-stroke", points: structuredClone(points), brush: structuredClone(brush), color: options.color ?? "#222222",
      opacity: options.opacity ?? 1, erase: options.erase ?? false, seed: options.seed ?? 1, visible: true,
      ...(options.reveal ? { reveal: structuredClone(options.reveal) } : {}),
      ...(options.id ? { id: options.id } : {}), ...(options.name ? { name: options.name } : {}),
    };
    return this.project._addElement(this.panelId, this.id, stroke);
  }

  erase(points: Point[], brush: BrushPreset, options: Omit<StrokeOptions, "erase"> = {}): Id {
    return this.rasterStroke(points, brush, { ...options, erase: true });
  }

  vectorStroke(points: Point[], options: VectorStrokeOptions = {}): Id {
    const stroke: Omit<VectorStroke, "id"> & { id?: Id } = {
      kind: "vector-stroke", points: structuredClone(points), color: options.color ?? "#181716", width: options.width ?? 6,
      opacity: options.opacity ?? 1, taperStart: options.taperStart ?? 0, taperEnd: options.taperEnd ?? 0,
      pressureSize: options.pressureSize ?? 0.8, closed: options.closed ?? false, visible: true,
      ...(options.id ? { id: options.id } : {}), ...(options.name ? { name: options.name } : {}),
      ...(options.fill !== undefined ? { fill: options.fill } : {}),
    };
    return this.project._addElement(this.panelId, this.id, stroke);
  }

  path(commands: PathCommand[], options: { id?: Id; name?: string; fill?: VectorFill; stroke?: string; strokeWidth?: number; opacity?: number } = {}): Id {
    return this.project._addElement(this.panelId, this.id, {
      kind: "vector-path", commands: structuredClone(commands), strokeWidth: options.strokeWidth ?? 0,
      opacity: options.opacity ?? 1, visible: true, ...(options.id ? { id: options.id } : {}),
      ...(options.name ? { name: options.name } : {}), ...(options.fill !== undefined ? { fill: structuredClone(options.fill) } : {}),
      ...(options.stroke !== undefined ? { stroke: options.stroke } : {}),
    });
  }

  text(text: string, x: number, y: number, options: { id?: Id; name?: string; color?: string; font?: string; align?: "left" | "center" | "right"; opacity?: number } = {}): Id {
    return this.project._addElement(this.panelId, this.id, {
      kind: "text", text, x, y, color: options.color ?? "#181716", font: options.font ?? "24px sans-serif",
      align: options.align ?? "left", opacity: options.opacity ?? 1, visible: true,
      ...(options.id ? { id: options.id } : {}), ...(options.name ? { name: options.name } : {}),
    });
  }

  set(changes: LayerChanges): this {
    this.project._updateLayer(this.panelId, this.id, changes);
    return this;
  }

  edit(elementId: Id, updater: (element: DrawingElement) => DrawingElement): this {
    this.project._updateElement(this.panelId, this.id, elementId, updater);
    return this;
  }

  outlineStroke(elementId:Id):this{
    return this.edit(elementId,element=>{
      if(element.kind!=="vector-stroke")throw new Error(`Element ${elementId} is not a vector stroke`);
      return outlinedStroke(element);
    });
  }

  booleanPath(elementId:Id,tool:readonly PathCommand[],operation:PathBooleanOperation):this{
    return this.edit(elementId,element=>{
      if(element.kind!=="vector-path")throw new Error(`Element ${elementId} is not a vector contour`);
      return {...element,commands:combinePaths(element.commands,tool,operation)};
    });
  }
}

export class Selection {
  constructor(private project: ProjectActions, private panelId: Id, private layerId: Id | undefined, private elementIds: Id[]) {
    this.elementIds=[...new Set(elementIds)];
  }

  transform(transform: Partial<Transform>,options:{pivot?:Pivot}={}): this {
    if (!this.layerId) throw new Error("Selection.transform() requires a layerId");
    if (this.elementIds.length === 0) {
      if(options.pivot)throw new Error("A temporary pivot requires selected elements; set the layer pivot for layer animation");
      const panel = this.project.toJSON().panels.find((entry) => entry.id === this.panelId);
      if (!panel) throw new Error(`Panel not found: ${this.panelId}`);
      const current = findLayer(panel.layers, this.layerId).transform;
      this.project._updateLayer(this.panelId, this.layerId, { transform: { ...current, ...transform } });
      return this;
    }
    this.project._updateElements(this.panelId, this.layerId, this.elementIds, (element) => transformElement(element, transform,options.pivot));
    return this;
  }

  opacity(value: number): this {
    if (!this.layerId) throw new Error("Selection.opacity() requires a layerId");
    if (this.elementIds.length === 0) this.project._updateLayer(this.panelId, this.layerId, { opacity: value });
    else this.project._updateElements(this.panelId, this.layerId, this.elementIds, (element) => ({ ...element, opacity: value }));
    return this;
  }

  remove(): void { this.project._remove(this.panelId, this.layerId, this.elementIds); }
}

function findLayer(layers: Layer[], id: Id): Layer {
  for (const layer of layers) {
    if (layer.id === id) return layer;
    if (layer.kind === "group") {
      try { return findLayer(layer.children, id); } catch { /* keep searching */ }
    }
  }
  throw new Error(`Layer not found: ${id}`);
}

function transformElement(element: DrawingElement, transform: Partial<Transform>,pivot?:Pivot): DrawingElement {
  return {...element,matrix:multiplyMatrices(matrixFromTransform(transform,pivot),element.matrix??[1,0,0,1,0,0])};
}
