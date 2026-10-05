import type { StoryboardProject } from "../../project.js";
import type { EditCommand } from "../types.js";
import type { mediaCommands } from "../schema/media.js";
import { unsupportedCommand } from "./unsupported.js";

type Command = Extract<EditCommand, { op: keyof typeof mediaCommands }>;

export function executeMedia(project: StoryboardProject, command: Command): void {
  switch (command.op) {
    case "audio.track.add":
      project.production.addAudioTrack(command.name, { id: command.id });
      break;
    case "audio.track.update":
      project.production.updateAudioTrack(command.id, command.changes);
      break;
    case "audio.track.remove":
      project.production.removeAudioTrack(command.id);
      break;
    case "audio.clip.add":
      project.production.addAudioClip(command.trackId, command.clip);
      break;
    case "audio.clip.update":
      project.production.updateAudioClip(command.trackId, command.id, command.changes);
      break;
    case "audio.clip.remove":
      project.production.removeAudioClip(command.trackId, command.id);
      break;
    case "audio.clip.move":
      project.production.moveAudioClip(
        command.id,
        command.trackId,
        command.startFrame === undefined ? {} : { startFrame: command.startFrame },
      );
      break;
    case "audio.clip.split":
      project.production.splitAudioClip(command.id, command.frame);
      break;
    case "asset.add":
      project.production.addAsset(command.asset);
      break;
    case "asset.update":
      project.production.updateAsset(command.id, command.changes);
      break;
    default:
      unsupportedCommand(command);
  }
}
