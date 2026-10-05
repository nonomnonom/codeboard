import type { StoryboardProject } from "../../project.js";
import type { EditCommand } from "../types.js";
import type { timelineCommands } from "../schema/timeline.js";
import { unsupportedCommand } from "./unsupported.js";
import { SequenceHandle, ShotHandle } from "../../handles.js";

type Command = Extract<EditCommand, { op: keyof typeof timelineCommands }>;

export function executeTimeline(project: StoryboardProject, command: Command): void {
  switch (command.op) {
    case "script.replace":
      project.replaceScript(command.script, command.expectedRevision);
      break;
    case "project.configure":
      project.configure(command.changes);
      break;
    case "project.metadata":
      project.setMetadata(command.key, command.value);
      break;
    case "panel.revise":
      project.panel(command.id).revise(command.changes);
      break;
    case "panel.status":
      project.production.setPanelStatus(command.id, command.status);
      break;
    case "sequence.add":
      project.addSequence(command.name, command.id);
      break;
    case "scene.add":
      new SequenceHandle(project, command.sequenceId).addScene(command.name, command.id);
      break;
    case "shot.add":
      project.scene(command.sceneId).addShot(command.name, command.id);
      break;
    case "panel.add":
      new ShotHandle(project, command.shotId).addPanel(command.options);
      break;
    case "panel.duration":
      project.production.setPanelDuration(command.id, command.durationFrames, command.mode);
      break;
    case "panel.transition":
      project.production.setTransition(command.id, command.transition);
      break;
    case "panel.number":
      project.production.setPanelNumber(command.id, command.number);
      break;
    case "panel.move":
      project.production.movePanel(command.id, command.beforeId);
      break;
    case "panel.duplicate":
      project.production.duplicatePanel(command.id);
      break;
    case "panel.remove":
      project.production.deletePanel(command.id);
      break;
    default:
      unsupportedCommand(command);
  }
}
