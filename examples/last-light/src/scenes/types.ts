import type { PanelHandle, StoryboardProject } from "codeboard-studio";
export interface SceneContext {
  project: StoryboardProject;
  panel: PanelHandle;
  frame: number;
  duration: number;
  index: number;
  state: {
    fireflyComponent?: string;
  };
}
