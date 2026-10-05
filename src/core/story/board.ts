import { z } from "zod";
import type { StoryboardProject } from "../project.js";
import type { EditCommand, EditPlan } from "../edit-plan/types.js";
import type { ScriptInput } from "../../model/types/script.js";
import { CodeboardError } from "../../model/errors.js";

export interface ScriptBoardPanel {
  panelId: string;
  shotId: string;
  entryIds: string[];
  durationFrames: number;
  title?: string;
}

export interface ScriptBoardReport {
  scriptId: string;
  scriptRevision: number;
  panels: { panelId: string; shotId: string; entryIds: string[]; durationFrames: number }[];
  plan: EditPlan;
}

const id = z.string().min(1).max(4096);
const requestsSchema = z
  .array(
    z
      .object({
        panelId: id,
        shotId: id,
        entryIds: z
          .array(id)
          .min(1)
          .max(1000)
          .refine((ids) => new Set(ids).size === ids.length, "Duplicate script entry IDs"),
        durationFrames: z.number().int().positive().safe(),
        title: z.string().max(65536).optional(),
      })
      .strict(),
  )
  .min(1)
  .max(200);

/** Create explicitly staged panels and append their script links in the same recoverable commit. */
export function planScriptBoard(
  project: StoryboardProject,
  input: readonly ScriptBoardPanel[],
): ScriptBoardReport {
  const parsed = requestsSchema.safeParse(input);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid script board staging", {
      details: { issues: parsed.error.issues },
    });
  const summary = project.scriptSummary();
  if (!summary)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Create a production script before staging its board",
    );
  const script: ScriptInput = { id: summary.id, title: summary.title, entries: [] };
  // One entry per read also handles long paragraphs within the bounded detail-read contract.
  for (let offset = 0; offset < summary.entryCount; offset++)
    script.entries.push(...project.scriptEntries({ offset, limit: 1 }));
  const entries = new Map(script.entries.map((entry) => [entry.id, entry]));
  const panelIds = new Set<string>(),
    commands: EditCommand[] = [];
  for (const request of parsed.data) {
    if (
      panelIds.has(request.panelId) ||
      project.production.query({ id: request.panelId, limit: 1 }).items.length
    )
      throw new CodeboardError("INVALID_ARGUMENT", "Board staging requires unique new panel IDs", {
        details: { panelId: request.panelId },
      });
    panelIds.add(request.panelId);
    if (project.production.query({ id: request.shotId, kind: "shot", limit: 1 }).items.length !== 1)
      throw new CodeboardError("INVALID_ARGUMENT", "Board staging requires an existing shot", {
        details: { shotId: request.shotId },
      });
    const selected = request.entryIds.map((entryId) => {
      const entry = entries.get(entryId);
      if (!entry)
        throw new CodeboardError("INVALID_ARGUMENT", "Script entry not found", {
          details: { entryId },
        });
      entry.panelIds.push(request.panelId);
      return entry;
    });
    commands.push({
      op: "panel.add",
      shotId: request.shotId,
      options: {
        id: request.panelId,
        durationFrames: request.durationFrames,
        title:
          request.title ??
          selected
            .filter((entry) => entry.kind === "scene")
            .map((entry) => entry.text)
            .join("\n"),
        action: selected
          .filter((entry) => entry.kind === "action")
          .map((entry) => entry.text)
          .join("\n\n"),
        dialogue: selected
          .filter((entry) => entry.kind === "dialogue")
          .map((entry) => (entry.speaker ? `${entry.speaker}: ${entry.text}` : entry.text))
          .join("\n\n"),
      },
    });
  }
  commands.push({ op: "script.replace", script, expectedRevision: summary.revision });
  return {
    scriptId: summary.id,
    scriptRevision: summary.revision,
    panels: parsed.data.map(({ panelId, shotId, entryIds, durationFrames }) => ({
      panelId,
      shotId,
      entryIds,
      durationFrames,
    })),
    plan: project.plan("Stage board from script", commands),
  };
}
