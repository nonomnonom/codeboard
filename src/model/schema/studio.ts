import { componentOriginSchema } from "./component-origins.js";
import { z } from "zod";
import { shotAnimationSchema } from "./shot.js";
import { editorialSequenceSchema } from "./editorial.js";
import { scriptSchema } from "./script.js";
import { paletteSchema } from "./palettes.js";

export const studioSchema = z
  .object({
    componentOrigins: z.array(componentOriginSchema).max(4096).optional(),
    palettes: z.array(paletteSchema).max(1000).optional(),
    script: scriptSchema.optional(),
    animations: z.array(shotAnimationSchema),
    editorial: z.array(editorialSequenceSchema),
  })
  .strict();
