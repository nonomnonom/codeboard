import type { Id, PanelOptions, LayerOptions, Point, Panel } from "../../model/types.js";
import type { ProjectActions } from "./host.js";
import { LayerHandle } from "./layer.js";

export class SequenceHandle {
  constructor(
    private project: ProjectActions,
    readonly id: Id,
  ) {}
  addScene(name: string, id?: Id) {
    return this.project._addScene(this.id, name, id);
  }
}

export class SceneHandle {
  constructor(
    private project: ProjectActions,
    readonly id: Id,
  ) {}
  addShot(name: string, id?: Id): ShotHandle {
    return this.project._addShot(this.id, name, id);
  }
}

export class ShotHandle {
  constructor(
    private project: ProjectActions,
    readonly id: Id,
  ) {}
  addPanel(options: PanelOptions = {}): PanelHandle {
    return this.project._addPanel(this.id, options);
  }
}

export class PanelHandle {
  constructor(
    private project: ProjectActions,
    readonly id: Id,
  ) {}
  addRasterLayer(name: string, options: LayerOptions = {}, parentGroupId?: Id): LayerHandle {
    return this.project._addLayer(this.id, "raster", name, options, parentGroupId);
  }
  addVectorLayer(name: string, options: LayerOptions = {}, parentGroupId?: Id): LayerHandle {
    return this.project._addLayer(this.id, "vector", name, options, parentGroupId);
  }
  addGroup(name: string, options: LayerOptions = {}, parentGroupId?: Id): LayerHandle {
    return this.project._addLayer(this.id, "group", name, options, parentGroupId);
  }
  addMotion(label: string, from: Point, to: Point, color = "#d14a32", id?: Id): Id {
    return this.project._addMotion(this.id, { label, from, to, color, ...(id ? { id } : {}) });
  }
  revise(
    changes: Partial<
      Pick<Panel, "title" | "durationFrames" | "action" | "dialogue" | "camera" | "notes">
    >,
  ): this {
    this.project._updatePanel(this.id, changes);
    return this;
  }
  layer(id: Id): LayerHandle {
    return new LayerHandle(this.project, this.id, id);
  }
}
