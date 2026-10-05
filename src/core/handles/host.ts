import type {
  Id,
  StoryboardDocument,
  PanelOptions,
  LayerOptions,
  NewDrawingElement,
  PixelRegion,
  PixelBuffer,
  MotionAnnotation,
  Panel,
  LayerChanges,
  DrawingElement,
} from "../../model/types.js";
import type { SceneHandle, ShotHandle, PanelHandle } from "./structure.js";
import type { LayerHandle } from "./layer.js";

export interface ProjectActions {
  _addScene(sequenceId: Id, name: string, id?: Id): SceneHandle;
  toJSON(): StoryboardDocument;
  _addShot(sceneId: Id, name: string, id?: Id): ShotHandle;
  _addPanel(shotId: Id, options: PanelOptions): PanelHandle;
  _addLayer(
    panelId: Id,
    kind: "raster" | "vector" | "group",
    name: string,
    options: LayerOptions,
    parentGroupId?: Id,
  ): LayerHandle;
  _addElement(panelId: Id, layerId: Id, element: NewDrawingElement): Id;
  _readPixels(panelId: Id, layerId: Id, elementId: Id, region?: PixelRegion): PixelBuffer;
  _addMotion(panelId: Id, annotation: Omit<MotionAnnotation, "id"> & { id?: Id }): Id;
  _updatePanel(
    panelId: Id,
    changes: Partial<
      Pick<Panel, "title" | "durationFrames" | "action" | "dialogue" | "camera" | "notes">
    >,
  ): void;
  _updateLayer(panelId: Id, layerId: Id, changes: LayerChanges): void;
  _updateElement(
    panelId: Id,
    layerId: Id,
    elementId: Id,
    updater: (element: DrawingElement) => DrawingElement,
  ): void;
  _updateElements(
    panelId: Id,
    layerId: Id,
    elementIds: Id[],
    updater: (element: DrawingElement) => DrawingElement,
  ): void;
  _remove(panelId: Id, layerId?: Id, elementIds?: Id[]): void;
}
