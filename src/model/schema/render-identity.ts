import { z } from "zod";

const value = z.string().min(1).max(4096);
const version = z.string().min(1).max(128);

export const renderIdentitySchema = z
  .object({
    package: value,
    version: value,
    node: value,
    platform: value,
    implementationHash: z.string().regex(/^[a-f0-9]{64}$/),
    backends: z
      .object({
        architecture: version,
        skiaCanvas: version,
        nativeFiles: z
          .record(version, z.string().regex(/^[a-f0-9]{64}$/))
          .refine((entries) => Object.keys(entries).length <= 32)
          .transform((entries) =>
            Object.fromEntries(
              Object.entries(entries).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
            ),
          )
          .optional(),
        sharp: z
          .record(version, version)
          .refine((entries) => Object.keys(entries).length <= 64)
          .transform((entries) =>
            Object.fromEntries(
              Object.entries(entries).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
            ),
          ),
      })
      .strict()
      .optional(),
  })
  .strict();

export type RenderIdentity = z.infer<typeof renderIdentitySchema>;
