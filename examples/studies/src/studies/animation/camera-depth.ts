import { renderFrameSheet } from "codeboard-studio";
import { amber, blue, ink, make, rect, save } from "../../shared.ts";
import { report } from "../../shared/artifacts.ts";

export async function render(output: string): Promise<void> {
  const project = make("Camera and depth planes");
  const shot = project.addScene("Study").addShot("Pan");
  const panel = shot.addPanel({ durationFrames: 24 });
  for (const [depth, color, y, height] of [
    [3, blue, 60, 100],
    [1, amber, 125, 80],
    [0.5, ink, 210, 35],
  ] as const) {
    const layer = panel.addVectorLayer(`Depth ${depth}`);
    for (const x of [-90, 30, 150, 270, 390]) rect(layer, x, y, 45, height, color);
    project.production.setPlaneDepth(layer.id, depth);
  }
  project.production.addCameraKeyframe(shot.id, 0, { x: 0, y: 0, zoom: 1, easing: "linear" });
  project.production.addCameraKeyframe(shot.id, 23, { x: 70, y: 0, zoom: 1 });
  const capture = project.capturePanelAnimation(panel.id, { id: "animation:camera" });
  const layerId = project.shotAnimation(capture.animationId).layers[0]!.id;
  await report(
    output,
    "coordinates",
    project.shotCoordinates(capture.animationId, layerId, { frame: 12 }),
  );
  await save(
    output,
    "camera-depth",
    project,
    await renderFrameSheet(project, [0, 12, 23], { columns: 3, thumbnailWidth: 360 }),
  );
}
