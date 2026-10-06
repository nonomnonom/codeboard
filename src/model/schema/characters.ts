import { z } from "zod";
import { transform } from "./primitives.js";

const id = z.string().min(1).max(4096);
export const characterInstanceOptionsSchema = z
  .object({
    id,
    targetAnimationId: id,
    rootLayerId: id,
    name: z.string().optional(),
    parentLayerId: id.optional(),
    compositeSourceId: id.optional(),
    frameOffset: z.number().int().nonnegative().safe().optional(),
    transform: transform.partial().strict().optional(),
  })
  .strict();
