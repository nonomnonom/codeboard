import type { Easing } from "./animation.js";
import type { AffineMatrix } from "./primitives.js";

export interface SkinMeshInput {
  source: MeshAnimation["source"];
  triangles: MeshAnimation["triangles"];
  joints: readonly { id: string; bind: Readonly<AffineMatrix> }[];
  weights: readonly (readonly { jointId: string; weight: number }[])[];
}
export interface LayerSkinInput extends SkinMeshInput {
  jointLayers: readonly { jointId: string; layerId: string }[];
}
export interface SkinJointPose {
  jointId: string;
  matrix: Readonly<AffineMatrix>;
}

type Position = { readonly x: number; readonly y: number };
export type CurveMeshPose = {
  curve: readonly [Position, Position, Position, Position];
  width: number;
};
export interface CurveMeshInput {
  rest: CurveMeshPose;
  segments?: number;
  keyframes: readonly (CurveMeshPose & { frame: number; easing: Easing })[];
}
export type EnvelopeMeshPose = Record<"top" | "bottom" | "left" | "right", CurveMeshPose["curve"]>;
export interface EnvelopeMeshInput {
  rest: EnvelopeMeshPose;
  columns?: number;
  rows?: number;
  keyframes: readonly { frame: number; pose: EnvelopeMeshPose; easing: Easing }[];
}
export type ShotMeshBinding = { layerId: string } & (
  | { skin: LayerSkinInput; mesh?: never; curve?: never; envelope?: never }
  | { mesh: MeshAnimation; curve?: never; envelope?: never; skin?: never }
  | { curve: CurveMeshInput; mesh?: never; envelope?: never; skin?: never }
  | { envelope: EnvelopeMeshInput; mesh?: never; curve?: never; skin?: never }
);

export interface MeshAnimation {
  source: readonly { readonly x: number; readonly y: number }[];
  triangles: readonly (readonly [number, number, number])[];
  keyframes: readonly {
    frame: number;
    vertices: readonly { readonly x: number; readonly y: number }[];
    easing: Easing;
  }[];
}
