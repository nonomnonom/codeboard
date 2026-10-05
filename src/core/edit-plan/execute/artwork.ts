import type { StoryboardProject } from "../../project.js";
import type { EditCommand } from "../types.js";
import type { artworkCommands } from "../schema/artwork.js";
import { unsupportedCommand } from "./unsupported.js";
import { readPlanElement, decodePlanPixels } from "../artwork.js";
import { readPlanComponentSource } from "../component-source.js";

type Command = Extract<EditCommand, { op: keyof typeof artworkCommands }>;

export function executeArtwork(project: StoryboardProject, command: Command): void {
  switch (command.op) {
    case "palette.put":
      project.putPalette(command.palette);
      break;
    case "palette.remove":
      project.removePalette(command.id);
      break;
    case "palette.bind":
      project.setColorBinding(command.elementId, command.channel, command.binding);
      break;
    case "layer.set":
      project.panel(command.panelId).layer(command.id).set(command.changes);
      break;
    case "layer.depth":
      project.production.setPlaneDepth(command.id, command.depth);
      break;
    case "layer.add": {
      const panel = project.panel(command.panelId);
      if (command.kind === "group") panel.addGroup(command.name, command.options, command.parentId);
      else if (command.kind === "raster")
        panel.addRasterLayer(command.name, command.options, command.parentId);
      else panel.addVectorLayer(command.name, command.options, command.parentId);
      break;
    }
    case "layer.move":
      project.production.moveLayer(command.id, command.beforeId);
      break;
    case "layer.reparent":
      project.production.reparentLayer(
        command.id,
        command.parentId,
        command.beforeId === undefined ? {} : { beforeLayerId: command.beforeId },
      );
      break;
    case "layer.remove":
      project.production.removeLayer(command.id);
      break;
    case "element.add":
      project._addElement(command.panelId, command.layerId, readPlanElement(command.element));
      break;
    case "element.replace":
      project
        .panel(command.panelId)
        .layer(command.layerId)
        .edit(command.id, () => readPlanElement(command.element));
      break;
    case "element.remove":
      project
        .select({
          panelId: command.panelId,
          layerId: command.layerId,
          elementIds: command.ids,
        })
        .remove();
      break;
    case "element.outline":
      project.panel(command.panelId).layer(command.layerId).outlineStroke(command.id);
      break;
    case "element.boolean":
      project
        .panel(command.panelId)
        .layer(command.layerId)
        .booleanPath(command.id, command.tool, command.operation);
      break;
    case "pixels.patch": {
      const pixels = decodePlanPixels(
        command.region.width,
        command.region.height,
        command.pixelsBase64,
      );
      project
        .panel(command.panelId)
        .layer(command.layerId)
        .editPixels(command.id, command.region, (patch) => {
          patch.pixels.set(pixels.pixels);
        });
      break;
    }
    case "brush.create":
      project.production.createBrush(command.definition);
      break;
    case "brush.revise":
      project.production.reviseBrush(command.id, command.changes);
      break;
    case "brush.duplicate":
      project.production.duplicateBrush(command.id, command.name);
      break;
    case "component.capture":
      project.production.captureComponent(command.layerId, command.name, { id: command.id });
      break;
    case "component.element.replace":
      project.production.replaceComponentElement(
        command.componentId,
        command.layerId,
        readPlanElement(command.element),
        { expectedComponentVersion: command.expectedComponentVersion },
      );
      break;
    case "component.upgrade": {
      const { op: _op, id, ...options } = command;
      project.production.upgradeComponentInstance(id, options);
      break;
    }
    case "component.source.replace":
      project.production.replaceComponentSource(
        command.componentId,
        readPlanComponentSource(command.layers),
        {
          expectedComponentVersion: command.expectedComponentVersion,
        },
      );
      break;
    case "component.revise":
      project.production.reviseComponent(command.id, command.sourceLayerId);
      break;
    case "component.instantiate":
      project.production.instantiateComponent(
        command.componentId,
        command.panelId,
        command.transform ?? {},
        { id: command.id },
      );
      break;
    case "component.refresh":
      project.production.refreshComponentInstance(command.id, { comments: command.comments });
      break;
    default:
      unsupportedCommand(command);
  }
}
