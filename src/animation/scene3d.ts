import type { Scene3D, Vector3D } from "../model/types/scene3d.js";
import type { Easing } from "../model/types/animation.js";
import { evaluateKeyedNumber } from "./evaluate.js";

/** Collections share the containing artwork's time domain; node IDs stay scene-local. */
export function scene3DKeyCollections(scene: Scene3D): { frame: number }[][] {
  return [scene.camera, ...scene.nodes].flatMap((owner) =>
    owner.keyframes ? [owner.keyframes] : [],
  );
}

export function evaluateVector3D<K extends { frame: number; easing: Easing }>(
  keys: readonly K[],
  frame: number,
  value: (key: K) => Vector3D | undefined,
  fallback: Vector3D,
): Vector3D {
  const component = (index: number) =>
    evaluateKeyedNumber(
      keys,
      frame,
      (key) => value(key)?.[index],
      (key) => key.easing,
      fallback[index]!,
    );
  return [component(0), component(1), component(2)];
}
