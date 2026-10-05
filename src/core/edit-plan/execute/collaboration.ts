import type { StoryboardProject } from "../../project.js";
import type { EditCommand } from "../types.js";
import type { collaborationCommands } from "../schema/collaboration.js";
import { unsupportedCommand } from "./unsupported.js";

type Command = Extract<EditCommand, { op: keyof typeof collaborationCommands }>;

export function executeCollaboration(project: StoryboardProject, command: Command): void {
  switch (command.op) {
    case "review.comment":
      project.production.comment(command.body, command.anchor);
      break;
    case "review.resolve":
      project.production.resolveComment(command.id);
      break;
    case "lock.acquire":
      project.production.lock(command.targetType, command.targetId, command.reason);
      break;
    case "lock.release":
      project.production.unlock(command.id);
      break;
    default:
      unsupportedCommand(command);
  }
}
