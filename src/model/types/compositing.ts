import type { LayerEffect } from "./layers.js";
import type { BlendMode } from "./primitives.js";
import type { Easing, LayerEffectValue } from "./animation.js";

export type ShotCompositeNode =
  | { id: string; kind: "source"; layerIds: string[] }
  | {
      id: string;
      kind: "effects";
      input: string;
      effects: LayerEffect[];
      keyframes?: { frame: number; easing: Easing; effectValues: LayerEffectValue[] }[];
    }
  | {
      id: string;
      kind: "blend";
      background: string;
      foreground: string;
      mode: BlendMode;
      opacity: number;
      keyframes?: { frame: number; easing: Easing; opacity: number }[];
    }
  | { id: string; kind: "mask"; input: string; mask: string; mode: "in" | "out" };

/** Frame-sized RGBA graph evaluated after source layer placement and camera. */
export interface ShotCompositeGraph {
  nodes: ShotCompositeNode[];
  output: string;
}
