import { z } from "zod";
import { layer } from "./layers.js";
const id = z.string().min(1).max(4096);
export const componentOriginSchema = z
  .object({
    instanceId: id,
    componentId: id,
    version: z.number().int().positive().safe(),
    source: z.array(layer),
    identities: z.array(z.object({ sourceId: id, copyId: id }).strict()),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
