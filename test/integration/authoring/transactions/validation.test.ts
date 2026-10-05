import { expect, it } from "vitest";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StoryboardProject } from "../../../../src/index.js";
import { fixture } from "./fixture.js";

it("rejects invalid layer settings before changing any field inside a transaction", () => {
  const { project, ink } = fixture(),
    initial = project.toJSON();
  project.transaction("Correct layer settings", () => {
    const before = project.toJSON();
    for (const changes of [
      { name: "Partial edit", opacity: 2 },
      { opacity: NaN },
      { visible: "yes" },
      { blendMode: "unsupported" },
      { transform: { x: Infinity, y: 0, scaleX: 1, scaleY: 1, rotation: 0 } },
      { transform: { x: 2 } },
      { id: "replacement" },
      { kind: "group" },
      { maskLayerId: 42 },
    ]) {
      expect(() => ink.set(changes as never)).toThrow();
      expect(project.toJSON()).toEqual(before);
    }
    const transform = { x: 3, y: 4, scaleX: -1, scaleY: 1, rotation: 0.2 };
    ink.set({ name: "Corrected", opacity: 0.6, transform, maskLayerId: null });
    transform.x = 99;
    ink.set({ name: undefined, opacity: undefined, transform: undefined } as never);
    expect(project.production.layer(ink.id)).toMatchObject({
      name: "Corrected",
      opacity: 0.6,
      transform: { x: 3, scaleX: -1 },
    });
  });
  project.undo();
  expect(project.toJSON().panels).toEqual(initial.panels);
  project.redo();
  expect(project.production.layer(ink.id).name).toBe("Corrected");
});

it.each(["undo", "redo"] as const)(
  "rejects %s during authoring without consuming history",
  (operation) => {
    const { project, first } = fixture();
    first.revise({ notes: "Retained edit" });
    if (operation === "redo") project.undo();
    const before = project.toJSON(),
      canUndo = project.canUndo,
      canRedo = project.canRedo;
    expect(() =>
      project.transaction("Invalid history operation", () => {
        first.revise({ title: "Temporary" });
        project[operation]();
      }),
    ).toThrow(/transaction/);
    expect(project.toJSON()).toEqual(before);
    expect(project.canUndo).toBe(canUndo);
    expect(project.canRedo).toBe(canRedo);
    expect(project[operation]()).toBe(true);
    expect(project.toJSON().panels[0]!.notes).toBe(operation === "undo" ? "" : "Retained edit");
  },
);

it("rejects saving uncommitted artwork without touching an existing or new file", async () => {
  const directory = await mkdtemp(join(tmpdir(), "codeboard-transaction-"));
  try {
    const { project, first } = fixture(),
      file = join(directory, "project.cboard"),
      newFile = join(directory, "new.cboard");
    await project.save(file);
    const bytes = await readFile(file),
      original = project.toJSON();
    let existing!: Promise<void>, fresh!: Promise<void>;
    expect(() =>
      project.transaction("Failed edit", () => {
        first.revise({ notes: "Uncommitted" });
        existing = project.save(file);
        fresh = project.save(newFile);
        throw new Error("Cancel the edit");
      }),
    ).toThrow(/Cancel the edit/);
    await expect(existing).rejects.toThrow(/transaction/);
    await expect(fresh).rejects.toThrow(/transaction/);
    expect(await readFile(file)).toEqual(bytes);
    await expect(stat(newFile)).rejects.toMatchObject({ code: "ENOENT" });
    expect(project.toJSON()).toEqual(original);
    first.revise({ notes: "Committed" });
    await project.save(file);
    expect((await StoryboardProject.open(file)).toJSON().panels[0]!.notes).toBe("Committed");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
