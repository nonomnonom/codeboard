import { expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StoryboardProject, renderPanelPNG } from "../../../../src/index.js";
import { fixture } from "./fixture.js";

it("upgrades saved artwork while preserving local opacity, IDs, review anchors and receipt replay", async () => {
  const { project, panel, component, instance, source, element, child, local } = fixture();
  panel.layer(child.id).edit(local.id, (value) => ({ ...value, opacity: 0.5 }));
  const comment = project.production.comment("Keep this local paint", {
    panelId: panel.id,
    layerId: child.id,
    elementId: local.id,
  });
  const before = await renderPanelPNG(project, panel.id);
  const oldOrigin = project.componentOriginData(instance).sha256;
  project.production.replaceComponentElement(
    component,
    source.id,
    { ...element, matrix: [1, 0, 0, 1, 8, 0] },
    { expectedComponentVersion: 1 },
  );
  expect(await renderPanelPNG(project, panel.id)).toEqual(before);
  const preview = project.previewComponentUpgrade(instance);
  expect(preview.conflicts).toEqual([]);
  expect(preview.retainedLocalChanges.some((path) => path.endsWith("/opacity"))).toBe(true);
  const directory = await mkdtemp(join(tmpdir(), "codeboard-upgrade-"));
  try {
    const file = join(directory, "upgrade.cboard");
    await project.save(file);
    const plan = project.plan("Upgrade prop", [
      { op: "component.upgrade", id: instance, expectedInputHash: preview.inputHash },
    ]);
    const result = await project.commit(plan, { requestId: "upgrade" });
    const reopened = await StoryboardProject.open(file);
    const replayed = await reopened.commit(plan, { requestId: "upgrade" });
    expect(replayed.replayed).toBe(true);
    expect(replayed.receipt).toEqual(result.receipt);
    expect(reopened.production.element(local.id)).toMatchObject({
      opacity: 0.5,
      matrix: [1, 0, 0, 1, 8, 0],
    });
    expect(reopened.toJSON().comments.find((entry) => entry.id === comment)!.anchor.elementId).toBe(
      local.id,
    );
    expect(reopened.componentOriginData(instance)).toMatchObject({
      baselineVersion: 2,
      instanceState: "matching",
    });
    expect(reopened.componentOriginData(instance).sha256).not.toBe(oldOrigin);
    expect(await renderPanelPNG(reopened, panel.id)).not.toEqual(before);
    const reference = fixture();
    reference.panel.layer(reference.child.id).edit(reference.local.id, (value) => ({
      ...value,
      opacity: 0.5,
      matrix: [1, 0, 0, 1, 8, 0],
    }));
    expect(await renderPanelPNG(reopened, panel.id)).toEqual(
      await renderPanelPNG(reference.project, reference.panel.id),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
