import { z } from "zod";

export interface FontFileDependency {
  family: string;
  path: string;
  sha256: string;
}

export const fontFilesSchema = z
  .array(
    z
      .object({
        family: z.string().trim().min(1).max(128),
        path: z
          .string()
          .min(1)
          .max(4096)
          .refine(
            (path) =>
              !/[:\\]/.test(path) &&
              !path.includes("\0") &&
              path.split("/").every((part) => part !== "" && part !== "." && part !== ".."),
          ),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict(),
  )
  .max(64)
  .refine(
    (files) => new Set(files.map((file) => `${file.family}\0${file.path}`)).size === files.length,
  );
