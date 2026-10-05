import { StoryboardProject, pathCommands } from "../../../../src/index.js";

export function fixture() {
  const project = StoryboardProject.create({ title: "Upgrade", width: 64, height: 48 });
  const panel = project.addScene("S").addShot("S").addPanel();
  const art = panel.addVectorLayer("Source");
  art.path(pathCommands("M 0 0 L 12 0 L 12 12 L 0 12 Z"), { fill: "#e07020" });
  const component = project.production.captureComponent(art.id, "Prop");
  art.set({ visible: false });
  const instance = project.production.instantiateComponent(component, panel.id, { x: 20, y: 12 });
  const source = project.toJSON().components[0]!.layers[0]!;
  const root = project.production.layer(instance);
  if (source.kind === "group" || root.kind !== "group" || root.children[0]!.kind === "group")
    throw new Error("Fixture");
  const child = root.children[0]!;
  return {
    project,
    panel,
    component,
    instance,
    source,
    element: source.elements[0]!,
    child,
    local: child.elements[0]!,
  };
}
