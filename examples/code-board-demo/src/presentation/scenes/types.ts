import type { PanelHandle, StoryboardProject } from "codeboard-studio";
export interface SceneContext {
  project: StoryboardProject;
  panel: PanelHandle;
  start: number;
  end: number;
  ordinal: number;
  poseSource: string;
}
