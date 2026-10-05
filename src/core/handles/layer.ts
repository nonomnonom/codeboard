import type {
  Id,
  PixelBuffer,
  RasterSurface,
  PixelRegion,
  Point,
  BrushPreset,
  StrokeOptions,
  RasterStroke,
  VectorStrokeOptions,
  VectorStroke,
  PathCommand,
  VectorFill,
  LayerChanges,
  DrawingElement,
} from "../../model/types.js";
import type { ProjectActions } from "./host.js";
import { readPixelRegion, writePixelRegion } from "../../drawing/pixel-buffer.js";
import { validatePixels } from "../../model/validation/pixels.js";
import { outlinedStroke } from "../../drawing/stroke-outline.js";
import { combinePaths, type PathBooleanOperation } from "../../drawing/path-geometry.js";

export class LayerHandle {
  constructor(
    private project: ProjectActions,
    readonly panelId: Id,
    readonly id: Id,
  ) {}

  rasterSurface(
    image: PixelBuffer,
    options: Partial<Pick<RasterSurface, "id" | "name" | "matrix" | "opacity" | "visible">> = {},
  ): Id {
    validatePixels(image);
    return this.project._addElement(this.panelId, this.id, {
      kind: "raster-surface",
      ...structuredClone(image),
      matrix: [1, 0, 0, 1, 0, 0],
      opacity: 1,
      visible: true,
      ...structuredClone(options),
    });
  }

  readPixels(elementId: Id, region?: PixelRegion): PixelBuffer {
    return this.project._readPixels(this.panelId, this.id, elementId, region);
  }

  editPixels(elementId: Id, region: PixelRegion, edit: (patch: PixelBuffer) => void): this {
    return this.edit(elementId, (element) => {
      if (element.kind !== "raster-surface")
        throw new Error(`Element ${elementId} is not a pixel surface`);
      const patch = readPixelRegion(element, region),
        result: unknown = edit(patch);
      if (result && typeof (result as { then?: unknown }).then === "function")
        throw new Error("Pixel edit callbacks must be synchronous");
      if (patch.width !== region.width || patch.height !== region.height)
        throw new Error("Pixel edits cannot resize the selected region");
      writePixelRegion(element, region.x, region.y, patch);
      return element;
    });
  }

  rasterStroke(points: Point[], brush: BrushPreset, options: StrokeOptions = {}): Id {
    const stroke: Omit<RasterStroke, "id"> & { id?: Id } = {
      kind: "raster-stroke",
      points: structuredClone(points),
      brush: structuredClone(brush),
      color: options.color ?? "#222222",
      opacity: options.opacity ?? 1,
      erase: options.erase ?? false,
      seed: options.seed ?? 1,
      visible: true,
      ...(options.reveal ? { reveal: structuredClone(options.reveal) } : {}),
      ...(options.id ? { id: options.id } : {}),
      ...(options.name ? { name: options.name } : {}),
    };
    return this.project._addElement(this.panelId, this.id, stroke);
  }

  erase(points: Point[], brush: BrushPreset, options: Omit<StrokeOptions, "erase"> = {}): Id {
    return this.rasterStroke(points, brush, { ...options, erase: true });
  }

  vectorStroke(points: Point[], options: VectorStrokeOptions = {}): Id {
    const stroke: Omit<VectorStroke, "id"> & { id?: Id } = {
      kind: "vector-stroke",
      points: structuredClone(points),
      color: options.color ?? "#181716",
      width: options.width ?? 6,
      opacity: options.opacity ?? 1,
      taperStart: options.taperStart ?? 0,
      taperEnd: options.taperEnd ?? 0,
      pressureSize: options.pressureSize ?? 0.8,
      closed: options.closed ?? false,
      visible: true,
      ...(options.id ? { id: options.id } : {}),
      ...(options.name ? { name: options.name } : {}),
      ...(options.fill !== undefined ? { fill: options.fill } : {}),
    };
    return this.project._addElement(this.panelId, this.id, stroke);
  }

  path(
    commands: PathCommand[],
    options: {
      id?: Id;
      name?: string;
      fill?: VectorFill;
      stroke?: string;
      strokeWidth?: number;
      opacity?: number;
    } = {},
  ): Id {
    return this.project._addElement(this.panelId, this.id, {
      kind: "vector-path",
      commands: structuredClone(commands),
      strokeWidth: options.strokeWidth ?? 0,
      opacity: options.opacity ?? 1,
      visible: true,
      ...(options.id ? { id: options.id } : {}),
      ...(options.name ? { name: options.name } : {}),
      ...(options.fill !== undefined ? { fill: structuredClone(options.fill) } : {}),
      ...(options.stroke !== undefined ? { stroke: options.stroke } : {}),
    });
  }

  text(
    text: string,
    x: number,
    y: number,
    options: {
      id?: Id;
      name?: string;
      color?: string;
      font?: string;
      align?: "left" | "center" | "right";
      opacity?: number;
    } = {},
  ): Id {
    return this.project._addElement(this.panelId, this.id, {
      kind: "text",
      text,
      x,
      y,
      color: options.color ?? "#181716",
      font: options.font ?? "24px sans-serif",
      align: options.align ?? "left",
      opacity: options.opacity ?? 1,
      visible: true,
      ...(options.id ? { id: options.id } : {}),
      ...(options.name ? { name: options.name } : {}),
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

  outlineStroke(elementId: Id): this {
    return this.edit(elementId, (element) => {
      if (element.kind !== "vector-stroke")
        throw new Error(`Element ${elementId} is not a vector stroke`);
      return outlinedStroke(element);
    });
  }

  booleanPath(elementId: Id, tool: readonly PathCommand[], operation: PathBooleanOperation): this {
    return this.edit(elementId, (element) => {
      if (element.kind !== "vector-path")
        throw new Error(`Element ${elementId} is not a vector contour`);
      return { ...element, commands: combinePaths(element.commands, tool, operation) };
    });
  }
}
