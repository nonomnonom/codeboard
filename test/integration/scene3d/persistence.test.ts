import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, it } from "vitest";
import { StoryboardProject, createRenderSession } from "../../../src/index.js";
import { element, pixels, setup } from "./helpers.js";

it("saves scene data, reopens it, edits the mesh material, and persists the new rendering", async () => {
  const directory = await mkdtemp(join(tmpdir(), "codeboard-scene3d-"));
  try {
    const file = join(directory, "motion.cboard");
    const { project, panel, layer, id } = setup();
    const before = pixels(createRenderSession(project).frame(5));
    await project.save(file);
    const reopened = await StoryboardProject.open(file);
    expect(element(reopened)).toEqual(element(project));
    expect(pixels(createRenderSession(reopened).frame(5))).toEqual(before);
    reopened
      .panel(panel.id)
      .layer(layer.id)
      .edit(id, (art) => {
        if (art.kind !== "scene-3d" || art.scene.nodes[0]?.kind !== "mesh")
          throw new Error("Missing mesh");
        art.scene.nodes[0].material.color = "#00ff00";
        return art;
      });
    await reopened.save(file);
    const edited = await StoryboardProject.open(file);
    const after = pixels(createRenderSession(edited).frame(5));
    const center = (64 * 128 + 64) * 4;
    expect(Array.from(before.slice(center, center + 4))).toEqual([255, 0, 0, 255]);
    expect(Array.from(after.slice(center, center + 4))).toEqual([0, 255, 0, 255]);
    expect(element(edited).scene.nodes[0]!.keyframes).toHaveLength(2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
