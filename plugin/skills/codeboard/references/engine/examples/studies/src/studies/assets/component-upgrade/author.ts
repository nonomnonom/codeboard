import { pathCommands } from "codeboard-studio";
import { make, amber } from "../../../shared.ts";

export function author() {
  const project = make("Preserve a local asset correction", 280, 240);
  const panel = project.addScene("Study").addShot("Kite asset").addPanel({ durationFrames: 24 });
  const art = panel.addVectorLayer("Kite source");
  art.path(pathCommands("M 0 -70 L 48 0 L 0 85 L -48 0 Z"), { fill: amber });
  const componentId = project.production.captureComponent(art.id, "Kite");
  art.set({ visible: false });
  const instanceId = project.production.instantiateComponent(componentId, panel.id, {
    x: 130,
    y: 100,
  });
  const source = project.toJSON().components[0]!.layers[0]!;
  const instance = project.production.layer(instanceId);
  if (
    source.kind === "group" ||
    instance.kind !== "group" ||
    instance.children[0]!.kind === "group"
  )
    throw new Error("Kite study requires a drawing component");
  return { project, panel, componentId, instanceId, source, local: instance.children[0]! };
}
