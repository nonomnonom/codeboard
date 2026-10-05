import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  exportOTIO,
  importOTIO,
  renderEditorialFramePNG,
  resolveEditorialFrame,
} from "codeboard-studio";
import { amber, blue, make, rect, save, text } from "../../shared.ts";
import { report, comparison } from "../../shared/artifacts.ts";

export async function generate(output: string): Promise<void> {
  const project = make("OTIO source trim and media binding");
  const scene = project.addScene("Mapped animations");
  for (const [index, color] of [amber, blue].entries()) {
    const panel = scene.addShot(`Shot ${index ? "B" : "A"}`).addPanel({ durationFrames: 60 });
    const moving = panel.addVectorLayer("Moving source");
    rect(moving, 0, 80, 60, 100, color);
    text(moving, index ? "B" : "A", 18, 140, 30);
    const start = project.toJSON().panels.find((entry) => entry.id === panel.id)!.startFrame;
    project.production.addLayerKeyframe(moving.id, start, {
      transform: { x: 20 },
      easing: "linear",
    });
    project.production.addLayerKeyframe(moving.id, start + 59, { transform: { x: 280 } });
    const id = `animation:${index ? "b" : "a"}`;
    project.capturePanelAnimation(panel.id, { id });
    const source = project.shotAnimation(id);
    source.frameRate = { numerator: index ? 30 : 24, denominator: 1 };
    source.durationFrames = index ? 60 : 48;
    project.putShotAnimation(source);
  }
  const media = [
    { animationId: "animation:a", targetUrl: "media/shot-a.mov", sourceStartFrame: 1001 },
    { animationId: "animation:b", targetUrl: "media/shot-b.mov" },
  ];
  const input = await readFile(new URL("../../fixtures/cuts.otio", import.meta.url), "utf8");
  const animations = project.studio.animations;
  const imported = importOTIO(input, animations, {
    sequenceId: "edit:otio",
    frameRate: { numerator: 24, denominator: 1 },
    media,
    lossPolicy: "report",
  });
  project.putEditorialSequence(imported.sequence);
  const exported = exportOTIO(imported.sequence, animations, { media });
  const roundTrip = importOTIO(exported.json, animations, {
    sequenceId: "edit:otio",
    frameRate: imported.sequence.frameRate,
    media,
  });
  assert.deepEqual(roundTrip.sequence, imported.sequence);
  assert.deepEqual(project.studio.animations, animations);
  const samples = [];
  const mapping = [];
  for (const frame of [0, 23, 24, 41]) {
    const resolved = resolveEditorialFrame(imported.sequence, animations, frame);
    const png = await renderEditorialFramePNG(imported.sequence, animations, frame);
    assert.deepEqual(png, await renderEditorialFramePNG(roundTrip.sequence, animations, frame));
    mapping.push(resolved);
    samples.push({
      label: `Edit ${frame} · ${resolved.outgoing.animationId.slice(-1).toUpperCase()} source ${resolved.outgoing.sourceFrame}`,
      png,
    });
  }
  await save(
    output,
    "otio-conform",
    project,
    await comparison(output, "Rebuild the cut sequence", samples, 2),
  );
  await writeFile(join(output, "conformed.otio"), exported.json);
  await report(output, "conform", {
    media,
    importLosses: imported.losses,
    exportLosses: exported.losses,
    mapping,
  });
}
