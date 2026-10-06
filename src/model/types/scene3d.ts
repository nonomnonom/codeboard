import type { AffineMatrix } from "./primitives.js";
import type { Easing } from "./animation.js";

export type Vector3D = [number, number, number];

export interface Pose3D {
  position?: Vector3D;
  /** Euler XYZ angles in radians. Values are interpolated directly, allowing multiple turns. */
  rotation?: Vector3D;
  scale?: Vector3D;
}

export interface Scene3DKeyframe extends Pose3D {
  /** Board-global or shot-local frame, matching the containing artwork. */
  frame: number;
  easing: Easing;
}

interface Scene3DNodeBase extends Pose3D {
  /** Unique within this scene, independent of project object IDs. */
  id: string;
  parentId?: string;
  visible?: boolean;
  keyframes?: Scene3DKeyframe[];
}

export type Scene3DNode =
  | (Scene3DNodeBase & { kind: "group" })
  | (Scene3DNodeBase & {
      kind: "mesh";
      geometry: "box" | "sphere" | "cylinder" | "cone" | "plane" | "torus";
      material: {
        kind: "basic" | "lambert" | "normal";
        /** Used by basic and Lambert materials; normal materials derive their color from geometry. */
        color?: string;
        opacity?: number;
        doubleSided?: boolean;
      };
    });

export interface Scene3DCameraKeyframe {
  frame: number;
  easing: Easing;
  position?: Vector3D;
  target?: Vector3D;
}

export type Scene3DCamera = {
  position: Vector3D;
  target: Vector3D;
  near?: number;
  far?: number;
  keyframes?: Scene3DCameraKeyframe[];
} & ({ kind: "perspective"; fov: number } | { kind: "orthographic"; height: number });

export type Scene3DLight =
  | { kind: "ambient"; color: string; intensity: number }
  | {
      kind: "directional";
      color: string;
      intensity: number;
      position: Vector3D;
      target: Vector3D;
    };

export interface Scene3D {
  width: number;
  height: number;
  /** Omit for transparency; scene colors use #RRGGBB. */
  background?: string;
  camera: Scene3DCamera;
  nodes: Scene3DNode[];
  lights?: Scene3DLight[];
}

/** A persistent scene rendered into its own viewport inside a vector layer. */
export interface Scene3DElement {
  kind: "scene-3d";
  id: string;
  name?: string;
  scene: Scene3D;
  matrix?: AffineMatrix;
  opacity: number;
  visible: boolean;
  colorBindings?: never;
}
