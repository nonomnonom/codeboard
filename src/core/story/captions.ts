import type { StoryboardProject } from "../project.js";
import type { EditCommand, EditPlan } from "../edit-plan/types.js";
import {
  captionFields,
  captionRowsSchema,
  type CaptionField,
  type CaptionImportRow,
} from "../../story/caption-csv.js";
import { boundQueryResponse } from "../../model/query.js";
import { CodeboardError } from "../../model/errors.js";

export interface CaptionImportReport {
  baseVersion: number;
  changes: { panelId: string; field: CaptionField; before: string; after: string }[];
  unchangedPanelIds: string[];
  plan: EditPlan | null;
}

/** Prepare an atomic caption-only plan; the caller persists it and commits with a request ID. */
export function planCaptionImport(
  project: StoryboardProject,
  input: readonly CaptionImportRow[],
): CaptionImportReport {
  const parsed = captionRowsSchema.safeParse(input);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid caption import rows", {
      details: { issues: parsed.error.issues },
    });
  const seen = new Set<string>(),
    commands: EditCommand[] = [];
  const changes: CaptionImportReport["changes"] = [],
    unchangedPanelIds: string[] = [];
  for (const row of parsed.data) {
    if (seen.has(row.panelId))
      throw new CodeboardError("INVALID_ARGUMENT", "Duplicate panel ID in caption import", {
        details: { panelId: row.panelId },
      });
    seen.add(row.panelId);
    const current = project.panelCaptions(row.panelId);
    const patch: Partial<Record<CaptionField, string>> = {};
    for (const field of captionFields) {
      const value = row[field];
      if (value !== undefined && current[field] !== value) {
        patch[field] = value;
        changes.push({ panelId: row.panelId, field, before: current[field], after: value });
      }
    }
    if (Object.keys(patch).length)
      commands.push({ op: "panel.revise", id: row.panelId, changes: patch });
    else unchangedPanelIds.push(row.panelId);
  }
  boundQueryResponse({ changes, unchangedPanelIds }, "Caption change report");
  return {
    baseVersion: project.version,
    changes,
    unchangedPanelIds,
    plan: commands.length ? project.plan("Import board captions", commands) : null,
  };
}
