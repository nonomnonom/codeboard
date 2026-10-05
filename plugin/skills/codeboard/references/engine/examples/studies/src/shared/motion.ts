import { amber, blue, ink, make, rect } from "../shared.ts";

export function motion(title: string, durationFrames = 24) {
  const project = make(title);
  const shot = project.addScene("Study").addShot("Motion");
  const panel = shot.addPanel({ title, durationFrames });
  const ground = panel.addVectorLayer("Ground");
  rect(ground, 25, 220, 310, 2, ink);
  const moving = panel.addGroup("Moving prop");
  const art = panel.addVectorLayer("Prop", {}, moving.id);
  const elementId = rect(art, -24, -60, 48, 60, blue);
  rect(art, -12, -48, 24, 12, amber);
  project.production.addLayerKeyframe(moving.id, 0, {
    transform: { x: 60, y: 220 },
    easing: "linear",
  });
  project.production.addLayerKeyframe(moving.id, durationFrames - 1, {
    transform: { x: 300, y: 220 },
  });
  project.capturePanelAnimation(panel.id, { id: "animation:study" });
  return { project, shot, panel, moving, elementId, art };
}
