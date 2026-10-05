import { parseCSVRows } from "./csv.js";
import { CodeboardError } from "../model/errors.js";
import { z } from "zod";

export const captionFields = ["title", "action", "dialogue", "camera", "notes"] as const;
export type CaptionField = (typeof captionFields)[number];
export type CaptionImportRow = { panelId: string } & Partial<
  Record<CaptionField, string | undefined>
>;
export const captionRowsSchema = z
  .array(
    z
      .object({
        panelId: z.string().min(1).max(4096),
        title: z.string().max(65536).optional(),
        action: z.string().max(65536).optional(),
        dialogue: z.string().max(65536).optional(),
        camera: z.string().max(65536).optional(),
        notes: z.string().max(65536).optional(),
      })
      .strict(),
  )
  .min(1)
  .max(1000);

/** Strict CSV: commas, escaped quotes and multiline quoted fields; no inferred panel matching. */
export function parseCaptionCSV(input: string): CaptionImportRow[] {
  if (typeof input !== "string")
    throw new CodeboardError("INVALID_ARGUMENT", "Caption CSV must be text");
  if (Buffer.byteLength(input) > 1048576)
    throw new CodeboardError("RESOURCE_LIMIT", "Caption CSV exceeds 1 MiB");
  const rows = parseCSVRows(input, 1001, 6);
  const fail = (message: string): never => {
    throw new CodeboardError("INVALID_ARGUMENT", message, { details: { row: 1 } });
  };
  const header = rows.shift() ?? fail("CSV header is required");
  if (
    header[0] !== "panelId" ||
    header.length < 2 ||
    new Set(header).size !== header.length ||
    header.slice(1).some((name) => !captionFields.includes(name as CaptionField))
  )
    fail("CSV header must start with panelId and contain unique supported caption fields");
  const records = rows.map((values, index) => {
    if (values.length !== header.length)
      throw new CodeboardError("INVALID_ARGUMENT", "CSV row width differs from header", {
        details: { row: index + 2 },
      });
    return Object.fromEntries(header.map((name, column) => [name, values[column]]));
  });
  const result = captionRowsSchema.safeParse(records);
  if (!result.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid caption CSV rows", {
      details: { issues: result.error.issues },
    });
  return result.data;
}
