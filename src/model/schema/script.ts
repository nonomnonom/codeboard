import { z } from "zod";

const id = z.string().min(1).max(4096);
export const scriptInputSchema = z
  .object({
    id,
    title: z.string().max(4096),
    entries: z
      .array(
        z
          .object({
            id,
            kind: z.enum(["scene", "action", "dialogue"]),
            text: z.string().max(65536),
            speaker: z.string().max(4096).optional(),
            panelIds: z
              .array(id)
              .max(1000)
              .refine((ids) => new Set(ids).size === ids.length, "Duplicate panel links"),
          })
          .strict(),
      )
      .max(1000),
  })
  .strict();

export const scriptSchema = scriptInputSchema.extend({
  revision: z.number().int().positive().safe(),
});
