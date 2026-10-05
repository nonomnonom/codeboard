import { isDeepStrictEqual } from "node:util";
import type {
  ScriptInput,
  ScriptChangeReport,
  ProductionScript,
} from "../../model/types/script.js";
import { scriptInputSchema } from "../../model/schema/script.js";
import { validateScriptContent } from "../../model/validation/script.js";
import { CodeboardError } from "../../model/errors.js";
import { boundQueryResponse } from "../../model/query.js";

export function reviseScript(
  current: ProductionScript | undefined,
  input: ScriptInput,
  expectedRevision: number,
) {
  const parsed = scriptInputSchema.safeParse(input);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid production script", {
      details: { issues: parsed.error.issues },
    });
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Expected script revision must be a nonnegative safe integer",
    );
  const beforeRevision = current?.revision ?? 0;
  if (beforeRevision !== expectedRevision)
    throw new CodeboardError("REVISION_CONFLICT", "Script revision changed", {
      details: { expected: expectedRevision, actual: beforeRevision },
    });
  if (current && current.id !== parsed.data.id)
    throw new CodeboardError("INVALID_ARGUMENT", "Script replacement must preserve its stable ID");
  const next = parsed.data as ScriptInput;
  validateScriptContent(next);
  const previous = new Map(current?.entries.map((entry) => [entry.id, entry]));
  const ids = new Set(next.entries.map((entry) => entry.id));
  const report: ScriptChangeReport = {
    scriptId: next.id,
    beforeRevision,
    revision: beforeRevision,
    titleChanged: current?.title !== next.title,
    reordered: !isDeepStrictEqual(
      current?.entries.map((entry) => entry.id) ?? [],
      next.entries.map((entry) => entry.id),
    ),
    added: next.entries.filter((entry) => !previous.has(entry.id)).map((entry) => entry.id),
    removed: [...previous.keys()].filter((id) => !ids.has(id)),
    updated: [],
  };
  for (const entry of next.entries) {
    const old = previous.get(entry.id);
    if (!old) continue;
    const fields = (["kind", "text", "speaker", "panelIds"] as const).filter(
      (field) => !isDeepStrictEqual(old[field], entry[field]),
    );
    if (fields.length) report.updated.push({ id: entry.id, fields });
  }
  const changed = !current || report.titleChanged || report.reordered || report.updated.length > 0;
  if (changed) report.revision++;
  if (!Number.isSafeInteger(report.revision))
    throw new CodeboardError("RESOURCE_LIMIT", "Script revision exceeds the safe integer range");
  boundQueryResponse(report, "Script change report");
  return { script: { ...next, revision: report.revision }, report, changed };
}
