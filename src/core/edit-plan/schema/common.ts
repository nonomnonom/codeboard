import { z } from "zod";

export const id = z.string().min(1).max(4096);

export const hash = z.string().regex(/^[a-f0-9]{64}$/);

export const frame = z.number().int().nonnegative();
export const pixelRegion = z
  .object({
    x: frame,
    y: frame,
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .strict();
