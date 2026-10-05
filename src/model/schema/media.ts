import { z } from "zod";

export const assetSchema = z.object({
  id: z.string(),
  kind: z.enum(["image", "audio"]),
  name: z.string(),
  path: z.string(),
  mimeType: z.string(),
  source: z.enum(["linked", "managed"]),
  checksum: z.string().optional(),
});
