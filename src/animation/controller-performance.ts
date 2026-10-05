import { createHash } from "node:crypto";
import { z } from "zod";
import type { ShotAnimation } from "../model/types/shot.js";
import type { ShotController } from "../model/types/controllers.js";
import type { RationalRate } from "./rational-time.js";
import { rationalRateSchema } from "../model/schema/animation.js";
import { shotControllerSchema } from "../model/schema/controllers.js";
import { CodeboardError } from "../model/errors.js";
import { defineShotAnimation } from "./shot.js";
import { validateControllerDefinitions } from "./controllers.js";
import {
  compileControllerDefinitions,
  type ControllerTransferOptions,
} from "./controller-transfer.js";

export interface ControllerPerformance {
  format: "codeboard-controller-performance";
  version: 1;
  id: string;
  name: string;
  frameRate: RationalRate;
  controllers: ShotController[];
  sha256: string;
}
const id = z.string().min(1).max(4096);
const payloadSchema = z
  .object({
    format: z.literal("codeboard-controller-performance"),
    version: z.literal(1),
    id,
    name: id,
    frameRate: rationalRateSchema,
    controllers: z.array(shotControllerSchema).min(1).max(64),
  })
  .strict();
const packageSchema = payloadSchema.extend({ sha256: z.string().regex(/^[a-f0-9]{64}$/) });
const optionsSchema = z
  .object({ id, name: id, controllerIds: z.array(id).min(1).max(64) })
  .strict();
const checksum = (payload: unknown) =>
  createHash("sha256").update(JSON.stringify(payload)).digest("hex");

/** Validate the versioned JSON envelope, logical payload checksum and controller invariants. */
export function readControllerPerformance(input: unknown): ControllerPerformance {
  const parsed = packageSchema.safeParse(input);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid controller performance package", {
      details: { reason: "CONTROLLER_PERFORMANCE_INPUT", issues: parsed.error.issues },
    });
  const { sha256, ...payload } = parsed.data;
  if (checksum(payload) !== sha256)
    throw new CodeboardError("INVALID_ARGUMENT", "Controller performance checksum mismatch", {
      details: { reason: "CONTROLLER_PERFORMANCE_CHECKSUM" },
    });
  const controllers = payload.controllers as ShotController[];
  const layers = new Set(
    controllers.flatMap((controller) => controller.targets.map((target) => target.layerId)),
  );
  validateControllerDefinitions(controllers, layers);
  return { ...payload, controllers, sha256 };
}

/** Capture selected controllers in their source stack order; no artwork or base keys are included. */
export function createControllerPerformance(
  input: ShotAnimation,
  options: { id: string; name: string; controllerIds: readonly string[] },
): ControllerPerformance {
  const parsed = optionsSchema.safeParse(options);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid performance capture options");
  const animation = defineShotAnimation(input);
  const selected = new Set(parsed.data.controllerIds);
  const controllers = (animation.controllers ?? []).filter((controller) =>
    selected.has(controller.id),
  );
  if (selected.size !== parsed.data.controllerIds.length || controllers.length !== selected.size)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Performance capture requires distinct existing controllers",
    );
  const payload = payloadSchema.parse({
    format: "codeboard-controller-performance",
    version: 1,
    id: parsed.data.id,
    name: parsed.data.name,
    frameRate: animation.frameRate,
    controllers,
  });
  return readControllerPerformance({ ...payload, sha256: checksum(payload) });
}

export function compileControllerPerformance(
  input: unknown,
  target: ShotAnimation,
  options: ControllerTransferOptions,
) {
  const performance = readControllerPerformance(input);
  return compileControllerDefinitions(performance, target, options);
}
