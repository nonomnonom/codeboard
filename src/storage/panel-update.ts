import type { Panel, Layer, StoryboardDocument } from "../model/types.js";
import type { Header, PanelInfo } from "./types.js";
import { panelSchema } from "../model/schema/storyboard.js";
import { validateRelationships } from "../model/validation/document.js";
import { assertEditableTargets } from "../model/locks.js";

export function panelIdentities(panel: Panel) {
  const rows: { id: string; name: string; kind: string }[] = [
    { id: panel.id, name: panel.title, kind: "panel" },
  ];
  const visit = (layers: Layer[]) => {
    for (const l of layers) {
      rows.push({ id: l.id, name: l.name, kind: l.kind });
      for (const k of l.keyframes) rows.push({ id: k.id, name: "", kind: "layer-key" });
      if (l.kind === "group") visit(l.children);
      else for (const e of l.elements) rows.push({ id: e.id, name: e.name ?? "", kind: e.kind });
    }
  };
  visit(panel.layers);
  for (const m of panel.motion) rows.push({ id: m.id, name: m.label, kind: "motion" });
  return rows;
}

/** Validate a targeted artwork draft without reading or writing the container. */
export function preparePanelUpdate(
  header: Header,
  old: Panel,
  panel: Panel,
  actor: string,
  panels: readonly PanelInfo[],
  components: readonly Omit<StoryboardDocument["components"][number], "layers">[],
  palettes: StoryboardDocument["studio"]["palettes"],
): Panel {
  for (const key of ["id", "shotId", "startFrame", "durationFrames"] as const)
    if (panel[key] !== old[key])
      throw new Error(`Targeted panel revision cannot change ${key}; use project timeline API`);
  const ids = panelIdentities(old)
    .map((i) => i.id)
    .sort();
  if (
    JSON.stringify(ids) !==
    JSON.stringify(
      panelIdentities(panel)
        .map((i) => i.id)
        .sort(),
    )
  )
    throw new Error(
      "Targeted panel revision must preserve stable identity topology; use a full authoring session for additions/removals",
    );
  assertEditableTargets(header.locks, actor, ids);
  const parsed = panelSchema.parse(panel) as Panel;
  const skeleton: StoryboardDocument = {
    ...header,
    studio: { animations: [], editorial: [], ...(palettes ? { palettes } : {}) },
    panels: panels.map((p) => (p.id === panel.id ? parsed : { ...p, layers: [], motion: [] })),
    components: components.map((component) => ({ ...component, layers: [] })),
    changes: [],
    comments: header.comments.filter(
      (c) =>
        (!c.anchor.layerId || ids.includes(c.anchor.layerId)) &&
        (!c.anchor.elementId || ids.includes(c.anchor.elementId)),
    ),
    locks: header.locks.filter((l) => l.targetType !== "layer" || ids.includes(l.targetId)),
  };
  validateRelationships(skeleton);
  parsed.revision = old.revision + 1;

  if (!Number.isSafeInteger(parsed.revision) || !Number.isSafeInteger(header.version + 1))
    throw new Error("Project or panel revision exceeds the safe integer range");
  return parsed;
}
