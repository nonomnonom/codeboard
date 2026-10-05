import type { Id, Panel, Transition } from "../../model/types.js";
import { retimePanel } from "../../animation/retime.js";
import { transitionSchema } from "../../model/schema/animation.js";
import { panelSchema } from "../../model/schema/storyboard.js";
import { CodeboardError } from "../../model/errors.js";
import type { ProductionHost, MutationOptions } from "./host.js";
import { findPanel } from "../../model/layers.js";
import {
  movePanel as moveBoardPanel,
  duplicatePanel as duplicateBoardPanel,
  deletePanel as deleteBoardPanel,
} from "../project/structure.js";

type Host = Pick<ProductionHost, "_applyProduction">;

export function setPanelDuration(
  host: Host,
  panelId: Id,
  durationFrames: number,
  mode: "ripple" | "preserve" = "ripple",
  options: MutationOptions = {},
): void {
  if (!Number.isSafeInteger(durationFrames) || durationFrames < 1)
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Panel duration must be a positive safe integer frame count",
      {
        details: { panelId, field: "durationFrames" },
      },
    );
  if (mode !== "ripple" && mode !== "preserve")
    throw new CodeboardError("INVALID_ARGUMENT", `Unknown retiming mode: ${mode}`, {
      details: { panelId, field: "mode" },
    });
  host._applyProduction(
    `retime panel (${mode})`,
    [panelId],
    options.expectedVersion,
    (document) => {
      const panel = findPanel(document, panelId);
      if (mode === "preserve" && durationFrames !== panel.durationFrames)
        throw new CodeboardError(
          "INVALID_ARGUMENT",
          "Preserving subsequent timing would create a gap or overlap. Use ripple retiming.",
          {
            details: {
              panelId,
              reason: "preserve-duration-change",
              currentDurationFrames: panel.durationFrames,
              durationFrames,
            },
          },
        );
      retimePanel(document, panelId, durationFrames);
    },
  );
}

export function setTransition(
  host: Host,
  panelId: Id,
  transition: Transition,
  options: MutationOptions = {},
): void {
  host._applyProduction(
    "set transition",
    [panelId],
    options.expectedVersion,
    (document) => {
      const panel = findPanel(document, panelId);
      const parsed = transitionSchema.safeParse(transition);
      if (!parsed.success)
        throw new CodeboardError("INVALID_ARGUMENT", "Invalid panel transition", {
          details: { panelId, issues: parsed.error.issues },
          cause: parsed.error,
        });
      const proposed = parsed.data;
      if (proposed.durationFrames >= panel.durationFrames)
        throw new CodeboardError(
          "INVALID_ARGUMENT",
          "Transition duration must fit inside the panel",
          {
            details: {
              panelId,
              reason: "transition-duration",
              durationFrames: proposed.durationFrames,
              panelDurationFrames: panel.durationFrames,
            },
          },
        );
      panel.transition = proposed;
      panel.revision += 1;
    },
    { panelId },
  );
}

export function movePanel(
  host: Host,
  panelId: Id,
  beforePanelId?: Id,
  options: MutationOptions = {},
): void {
  host._applyProduction(
    "move panel",
    [panelId, ...(beforePanelId ? [beforePanelId] : [])],
    options.expectedVersion,
    (document) => moveBoardPanel(document, panelId, beforePanelId),
  );
}

export function duplicatePanel(host: Host, panelId: Id, options: MutationOptions = {}): Id {
  let created = "";
  host._applyProduction(
    "duplicate panel",
    [panelId],
    options.expectedVersion,
    (document, nextId) => {
      created = duplicateBoardPanel(document, nextId, panelId);
    },
  );
  return created;
}

export function deletePanel(host: Host, panelId: Id, options: MutationOptions = {}): void {
  host._applyProduction("delete panel", [panelId], options.expectedVersion, (document) =>
    deleteBoardPanel(document, panelId),
  );
}

export function setPanelStatus(
  host: Host,
  panelId: Id,
  status: Panel["status"],
  options: MutationOptions = {},
): void {
  const parsed = panelSchema.shape.status.safeParse(status);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid panel status", {
      details: { panelId, issues: parsed.error.issues },
      cause: parsed.error,
    });
  host._applyProduction(
    "set panel review status",
    [panelId],
    options.expectedVersion,
    (document) => {
      findPanel(document, panelId).status = parsed.data;
    },
  );
}

export function setPanelNumber(
  host: Host,
  panelId: Id,
  number: string,
  options: MutationOptions = {},
) {
  host._applyProduction("renumber panel", [panelId], options.expectedVersion, (d) => {
    findPanel(d, panelId).number = number;
  });
}
