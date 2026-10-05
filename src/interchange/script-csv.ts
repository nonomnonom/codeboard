import { parseCSVRows } from "../story/csv.js";
import { z } from "zod";
import { scriptInputSchema, scriptSchema } from "../model/schema/script.js";
import { validateScriptContent } from "../model/validation/script.js";
import type { ScriptInput, ProductionScript } from "../model/types/script.js";
import { CodeboardError } from "../model/errors.js";

const header = ["id", "kind", "text", "speaker", "panelIds"];
const MAX_BYTES = 2 * 1024 * 1024;
export interface ScriptCSVOptions {
  id: string;
  title: string;
}

function invalid(message: string, row?: number): never {
  throw new CodeboardError("INVALID_ARGUMENT", message, {
    details: row === undefined ? {} : { row },
  });
}

function script(input: unknown): ScriptInput {
  const parsed = z.union([scriptInputSchema, scriptSchema]).safeParse(input);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid CSV script fields", {
      details: {
        issues: parsed.error.issues.slice(0, 20),
        issuesTruncated: parsed.error.issues.length > 20,
      },
    });
  const result: ScriptInput = {
    id: parsed.data.id,
    title: parsed.data.title,
    entries: parsed.data.entries as ScriptInput["entries"],
  };
  try {
    validateScriptContent(result);
  } catch (cause) {
    if (cause instanceof CodeboardError && typeof cause.details.entryIndex === "number")
      throw new CodeboardError(cause.code, cause.message, {
        details: { ...cause.details, row: cause.details.entryIndex + 2 },
        cause,
      });
    throw cause;
  }
  return result;
}

/** Import explicit stable entry IDs and panel links; does not mutate a project. */
export function importScriptCSV(csv: string, options: ScriptCSVOptions): ScriptInput {
  const parsed = z
    .object({ id: z.string().min(1).max(4096), title: z.string().max(4096) })
    .strict()
    .safeParse(options);
  if (!parsed.success) invalid("Invalid script CSV options");
  if (typeof csv !== "string") invalid("Script CSV must be a string");
  if (Buffer.byteLength(csv) > MAX_BYTES)
    throw new CodeboardError("RESOURCE_LIMIT", "Script CSV exceeds 2 MiB");
  const records = parseCSVRows(csv, 1001, 5);
  if (JSON.stringify(records.shift()) !== JSON.stringify(header))
    invalid("CSV header must be id,kind,text,speaker,panelIds", 1);
  const entries = records.map((record, index) => {
    if (record.length !== header.length)
      invalid("CSV rows require exactly five columns", index + 2);
    const [id, kind, text, speaker, links] = record;
    let panelIds: unknown;
    try {
      panelIds = links === "" ? [] : JSON.parse(links!);
    } catch {
      invalid("panelIds must be a JSON array of panel IDs", index + 2);
    }
    return { id, kind, text, ...(speaker === "" ? {} : { speaker }), panelIds };
  });
  return script({ ...parsed.data, entries });
}

/** Export editable script fields; callers retain project/script revision separately. */
export function exportScriptCSV(input: ScriptInput | ProductionScript): string {
  const source = script(input);
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const records = source.entries.map((entry) =>
    [entry.id, entry.kind, entry.text, entry.speaker ?? "", JSON.stringify(entry.panelIds)]
      .map(quote)
      .join(","),
  );
  const csv = `${[header.join(","), ...records].join("\r\n")}\r\n`;
  if (Buffer.byteLength(csv) > MAX_BYTES)
    throw new CodeboardError("RESOURCE_LIMIT", "Script CSV exceeds 2 MiB");
  return csv;
}
