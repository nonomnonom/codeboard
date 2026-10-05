import type { StoryboardProject } from "../core/project.js";
import type { StoryboardDocument } from "../model/types.js";

export type RenderSource = StoryboardProject | StoryboardDocument;
export type PanelRenderSource =
  | StoryboardProject
  | Pick<StoryboardDocument, "canvas" | "panels" | "shots">;

/** Use the read boundary without loading the authoring engine into the renderer. */
export function isProjectSource(source: PanelRenderSource): source is StoryboardProject {
  return (
    "toJSON" in source &&
    typeof source.toJSON === "function" &&
    "_readRenderPanels" in source &&
    typeof source._readRenderPanels === "function" &&
    "_readRenderFrame" in source &&
    typeof source._readRenderFrame === "function"
  );
}

export function documentOf(source: RenderSource): StoryboardDocument {
  return isProjectSource(source) ? source.toJSON() : source;
}

/** Exporters retain an isolated source while asynchronous encoding and file writes run. */
export function snapshotDocument(source: RenderSource): StoryboardDocument {
  return isProjectSource(source) ? source.toJSON() : structuredClone(source);
}
