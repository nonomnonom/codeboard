import type { BrushPreset } from "../model/types.js";

const dynamics = {
  pressureSize: 0.75,
  pressureOpacity: 0.55,
  speedSize: 0,
  speedOpacity: 0,
  tiltShape: 0,
  pressureSpacing: 0,
  pressureHardness: 0,
  rotationJitter: 0,
};

export const brushes = {
  roughPencil: {
    id: "brush:rough-pencil", name: "Rough pencil", version: 1, tip: { kind: "ellipse", aspect: 0.72, angle: -0.3, rotationMode: "stylus" }, size: 8, opacity: 0.62, flow: 0.24,
    hardness: 0.58, spacing: 0.12, taperStart: 0.08, taperEnd: 0.16,
    texture: "graphite", textureStrength: 0.58,
    dynamics: { ...dynamics, pressureSize: 0.72, pressureOpacity: 0.78, speedOpacity: -0.18, tiltShape: 0.22 },
  },
  cleanInk: {
    id: "brush:clean-ink", name: "Clean ink", version: 1, tip: { kind: "round", aspect: 1, angle: 0, rotationMode: "stroke" }, size: 7, opacity: 1, flow: 0.92,
    hardness: 0.96, spacing: 0.08, taperStart: 0.12, taperEnd: 0.3,
    texture: "none", textureStrength: 0,
    dynamics: { ...dynamics, pressureSize: 0.88, pressureOpacity: 0.08, speedSize: -0.12 },
  },
  shadeBrush: {
    id: "brush:shade", name: "Dry shading", version: 1, tip: { kind: "rake", aspect: 0.62, angle: -0.5, rotationMode: "stylus" }, size: 24, opacity: 0.42, flow: 0.12,
    hardness: 0.35, spacing: 0.16, taperStart: 0.04, taperEnd: 0.08,
    texture: "dry-brush", textureStrength: 0.68,
    dynamics: { ...dynamics, pressureSize: 0.55, pressureOpacity: 0.72, tiltShape: 0.7 },
  },
  charcoal: {
    id: "brush:charcoal", name: "Charcoal", version: 1, tip: { kind: "chisel", aspect: 0.42, angle: -0.55, rotationMode: "stylus" }, size: 18, opacity: 0.66, flow: 0.18,
    hardness: 0.48, spacing: 0.2, taperStart: 0.05, taperEnd: 0.08,
    texture: "charcoal", textureStrength: 0.8,
    dynamics: { ...dynamics, pressureSize: 0.65, pressureOpacity: 0.68, tiltShape: 0.45 },
  },
  softEraser: {
    id: "brush:soft-eraser", name: "Soft eraser", version: 1, tip: { kind: "round", aspect: 1, angle: 0, rotationMode: "fixed" }, size: 32, opacity: 0.7, flow: 0.22,
    hardness: 0.28, spacing: 0.1, taperStart: 0, taperEnd: 0,
    texture: "none", textureStrength: 0,
    dynamics: { ...dynamics, pressureSize: 0.45, pressureOpacity: 0.5 },
  },
} satisfies Record<string, BrushPreset>;

export function customizeBrush(base: BrushPreset, changes: Partial<Omit<BrushPreset, "dynamics">> & { dynamics?: Partial<BrushPreset["dynamics"]> }): BrushPreset {
  return structuredClone({
    ...base,
    ...changes,
    dynamics: { ...base.dynamics, ...changes.dynamics },
  });
}
