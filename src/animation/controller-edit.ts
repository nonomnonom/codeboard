import type { ShotAnimation } from "../model/types/shot.js";
import type { ShotControllerEdit } from "../model/types/controllers.js";
import { CodeboardError } from "../model/errors.js";

/** Mutate an isolated draft; shot validation owns final references and resource limits. */
export function applyShotControllerEdit(shot: ShotAnimation, edit: ShotControllerEdit): void {
  const controllers = shot.controllers ?? [];
  const id = edit.op === "controller.put" ? edit.controller.id : edit.id;
  const index = controllers.findIndex((entry) => entry.id === id);
  if (edit.op === "controller.put") {
    if (index < 0) controllers.push(structuredClone(edit.controller));
    else controllers[index] = structuredClone(edit.controller);
    shot.controllers = controllers;
    return;
  }
  if (index < 0)
    throw new CodeboardError("INVALID_ARGUMENT", "Controller not found", {
      details: { reason: "CONTROLLER_MISSING", controllerId: id },
    });
  const controller = controllers[index]!;
  switch (edit.op) {
    case "controller.remove":
      controllers.splice(index, 1);
      if (!controllers.length) delete shot.controllers;
      break;
    case "controller.range":
      if (edit.range === null) delete controller.activeRange;
      else controller.activeRange = structuredClone(edit.range);
      break;
    case "controller.weight":
      controller.weight = edit.weight;
      break;
    case "controller.key.put":
      controller.keyframes = [
        ...controller.keyframes.filter((key) => key.frame !== edit.key.frame),
        structuredClone(edit.key),
      ].sort((a, b) => a.frame - b.frame);
      break;
    case "controller.key.remove": {
      const keys = controller.keyframes.filter((key) => key.frame !== edit.frame);
      if (keys.length === controller.keyframes.length)
        throw new CodeboardError("INVALID_ARGUMENT", "Controller key not found", {
          details: { reason: "CONTROLLER_KEY_MISSING", controllerId: id, frame: edit.frame },
        });
      controller.keyframes = keys;
      break;
    }
    case "controller.move": {
      if (edit.beforeId === id) return;
      const before =
        edit.beforeId === null
          ? controllers.length
          : controllers.findIndex((entry) => entry.id === edit.beforeId);
      if (before < 0)
        throw new CodeboardError("INVALID_ARGUMENT", "Controller insertion target not found", {
          details: { reason: "CONTROLLER_MOVE_TARGET", controllerId: id, beforeId: edit.beforeId },
        });
      controllers.splice(index, 1);
      controllers.splice(before > index ? before - 1 : before, 0, controller);
      break;
    }
  }
}
