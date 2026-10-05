import type { StoryboardDocument } from "../types.js";
import type { ScriptInput } from "../types/script.js";
import { CodeboardError } from "../errors.js";

/** Validate script-local invariants after schema parsing, before project link validation. */
export function validateScriptContent(script: ScriptInput): void {
  if (Buffer.byteLength(JSON.stringify(script)) > 1048576)
    throw new CodeboardError("RESOURCE_LIMIT", "Production script exceeds 1 MiB");
  const ids = new Set([script.id]);
  for (const [entryIndex, entry] of script.entries.entries()) {
    const details = { entryId: entry.id, entryIndex };
    if (ids.has(entry.id))
      throw new CodeboardError("INVALID_ARGUMENT", "Script and entry IDs must be unique", {
        details,
      });
    ids.add(entry.id);
    if (entry.kind !== "dialogue" && entry.speaker !== undefined)
      throw new CodeboardError("INVALID_ARGUMENT", "Only dialogue entries may name a speaker", {
        details,
      });
  }
}

export function validateScriptLinks(document: StoryboardDocument) {
  if (!document.studio.script) return;
  validateScriptContent(document.studio.script);
  const panels = new Set(document.panels.map((panel) => panel.id));
  for (const entry of document.studio.script.entries) {
    for (const id of entry.panelIds)
      if (!panels.has(id))
        throw new CodeboardError("INVALID_ARGUMENT", "Script references a missing panel", {
          details: { entryId: entry.id, panelId: id },
        });
  }
}
