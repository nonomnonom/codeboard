import { z } from "zod";
import { finite, elementMatrix } from "./primitives.js";
import { easingSchema } from "./animation.js";

const coordinate = finite.min(-1_000_000).max(1_000_000);
const vector = z.tuple([coordinate, coordinate, coordinate]);
const rgb = z.string().regex(/^#[\da-f]{6}$/i, "Scene colors must use #RRGGBB");
const pose = { position: vector.optional(), rotation: vector.optional(), scale: vector.optional() };
const frame = z.number().int().safe();
const key = z
  .object({ frame, easing: easingSchema, ...pose })
  .strict()
  .refine(
    (value) =>
      value.position !== undefined || value.rotation !== undefined || value.scale !== undefined,
    "A 3D keyframe needs a position, rotation, or scale",
  );
const cameraKey = z
  .object({
    frame,
    easing: easingSchema,
    position: vector.optional(),
    target: vector.optional(),
  })
  .strict()
  .refine(
    (value) => value.position !== undefined || value.target !== undefined,
    "A camera keyframe needs a position or target",
  );
const keys = <T extends z.ZodType<{ frame: number }>>(item: T) =>
  z
    .array(item)
    .max(1024)
    .refine(
      (values) => new Set(values.map((value) => value.frame)).size === values.length,
      "Duplicate 3D keyframe position",
    );
const node = {
  id: z.string().min(1).max(256),
  parentId: z.string().min(1).max(256).optional(),
  visible: z.boolean().optional(),
  keyframes: keys(key).optional(),
  ...pose,
};
const camera = {
  position: vector,
  target: vector,
  near: finite.positive().optional(),
  far: finite.positive().optional(),
  keyframes: keys(cameraKey).optional(),
};

export const scene3DSchema = z
  .object({
    width: z.number().int().min(1).max(4096),
    height: z.number().int().min(1).max(4096),
    background: rgb.optional(),
    camera: z.discriminatedUnion("kind", [
      z.object({ ...camera, kind: z.literal("perspective"), fov: finite.gt(0).lt(180) }).strict(),
      z.object({ ...camera, kind: z.literal("orthographic"), height: finite.positive() }).strict(),
    ]),
    nodes: z
      .array(
        z.discriminatedUnion("kind", [
          z.object({ ...node, kind: z.literal("group") }).strict(),
          z
            .object({
              ...node,
              kind: z.literal("mesh"),
              geometry: z.enum(["box", "sphere", "cylinder", "cone", "plane", "torus"]),
              material: z
                .object({
                  kind: z.enum(["basic", "lambert", "normal"]),
                  color: rgb.optional(),
                  opacity: finite.min(0).max(1).optional(),
                  doubleSided: z.boolean().optional(),
                })
                .strict(),
            })
            .strict(),
        ]),
      )
      .max(128),
    lights: z
      .array(
        z.discriminatedUnion("kind", [
          z
            .object({ kind: z.literal("ambient"), color: rgb, intensity: finite.min(0).max(100) })
            .strict(),
          z
            .object({
              kind: z.literal("directional"),
              color: rgb,
              intensity: finite.min(0).max(100),
              position: vector,
              target: vector,
            })
            .strict(),
        ]),
      )
      .max(8)
      .optional(),
  })
  .strict()
  .superRefine((scene, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });
    if ((scene.camera.near ?? 0.1) >= (scene.camera.far ?? 1000))
      issue("Camera far must exceed near");
    if (scene.camera.position.every((value, i) => value === scene.camera.target[i]))
      issue("Camera position and target must differ");
    const nodes = new Map(scene.nodes.map((entry) => [entry.id, entry]));
    if (nodes.size !== scene.nodes.length) issue("Scene node IDs must be unique");
    for (const entry of scene.nodes) {
      const ancestors = new Set([entry.id]);
      let parentId = entry.parentId;
      while (parentId !== undefined) {
        const parent = nodes.get(parentId);
        if (parent?.kind !== "group") {
          issue(`Scene parent must reference a group: ${parentId}`);
          break;
        }
        if (ancestors.has(parentId) || ancestors.size >= 16) {
          issue("Scene hierarchy must be acyclic and at most 16 levels deep");
          break;
        }
        ancestors.add(parentId);
        parentId = parent.parentId;
      }
    }
  });

export const scene3DElement = z
  .object({
    kind: z.literal("scene-3d"),
    id: z.string(),
    name: z.string().optional(),
    scene: scene3DSchema,
    matrix: elementMatrix.optional(),
    opacity: finite.min(0).max(1),
    visible: z.boolean(),
  })
  .strict();

export const globalScene3DElement = scene3DElement.refine(
  (element) =>
    [element.scene.camera, ...element.scene.nodes].every(
      (owner) => owner.keyframes?.every((key) => key.frame >= 0) ?? true,
    ),
  "Board 3D keyframes must be nonnegative",
);
