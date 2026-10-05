import type { Id } from "./primitives.js";
import type { BrushPreset } from "./brushes.js";
import type { DrawingComponent } from "./layers.js";
import type { Scene, Sequence, Shot, Panel } from "./storyboard.js";
import type { Asset, AudioTrack } from "./media.js";
import type { ReviewComment, ProjectLock, ChangeEntry } from "./review.js";
import type { StudioContent } from "./studio.js";

export interface StoryboardDocument {
  components: DrawingComponent[];
  schemaVersion: 5;
  studio: StudioContent;
  version: number;
  id: Id;
  title: string;
  author?: string;
  createdAt: string;
  updatedAt: string;
  canvas: { width: number; height: number; background: string };
  seed: number;
  frameRate: number;
  idCounter: number;
  scenes: Scene[];
  sequences: Sequence[];
  shots: Shot[];
  panels: Panel[];
  brushes: BrushPreset[];
  assets: Asset[];
  audioTracks: AudioTrack[];
  comments: ReviewComment[];
  locks: ProjectLock[];
  changes: ChangeEntry[];
  metadata: Record<string, string>;
}

export interface ProjectOptions {
  id?: Id;
  title: string;
  author?: string;
  width?: number;
  height?: number;
  background?: string;
  seed?: number;
  frameRate?: number;
}

export interface ProjectChanges {
  title?: string;
  author?: string | null;
  seed?: number;
  frameRate?: { value: number; timing: "preserve-frames" | "preserve-seconds" };
  canvas?: {
    width?: number;
    height?: number;
    background?: string;
    /** Existing artwork coordinates stay unchanged in either mode. */
    applyTo?: "new-panels" | "all-panels";
  };
}
