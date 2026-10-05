import type { Easing, LayerChannel } from "./animation.js";
export interface ShotController {
  id: string;
  name: string;
  mode: "replace" | "additive";
  weight: number;
  activeRange?: { startFrame: number; endFrame: number };
  targets: readonly { layerId: string; values: Partial<Record<LayerChannel, number>> }[];
  keyframes: readonly { frame: number; weight: number; easing: Easing }[];
}

export type ShotControllerEdit =
  | { op: "controller.put"; controller: ShotController }
  | { op: "controller.remove"; id: string }
  | { op: "controller.range"; id: string; range: NonNullable<ShotController["activeRange"]> | null }
  | { op: "controller.weight"; id: string; weight: number }
  | { op: "controller.key.put"; id: string; key: ShotController["keyframes"][number] }
  | { op: "controller.key.remove"; id: string; frame: number }
  | { op: "controller.move"; id: string; beforeId: string | null };
