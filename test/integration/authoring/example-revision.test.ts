import { expect, it, onTestFinished } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StoryboardProject, createPixels } from "codeboard-studio";
import { revise } from "../../../examples/last-light/src/project/revise.ts";

it("refuses a changed thumb contour without modifying project bytes or revision history", async () => {
  const directory = await mkdtemp(join(tmpdir(), "codeboard-example-contour-"));
  onTestFinished(() => rm(directory, { recursive: true, force: true }));
  const project = StoryboardProject.create({ title: "Changed hand", width: 640, height: 480 });
  const scene = project.addScene("Existing artwork");
  for (const id of ["panel:02", "panel:04", "panel:06"])
    scene.addShot(id).addPanel({ id, durationFrames: 1 });
  project.panel("panel:04").addRasterLayer("Reflection").rasterSurface(createPixels(256, 64), {
    name: "amber-reflection-surface",
  });
  project
    .panel("panel:06")
    .addVectorLayer("Hand")
    .path(
      [
        { op: "M", x: 0, y: 0 },
        { op: "Q", x1: 100, y1: 100, x: 581, y: 100 },
      ],
      { name: "palm-contour", stroke: "#000000", strokeWidth: 1 },
    );
  const file = join(directory, "last-light.cboard");
  await project.save(file);
  const bytes = await readFile(file);
  await expect(revise(directory)).rejects.toThrow("Palm contour changed");
  expect(await readFile(file)).toEqual(bytes);
});
