import { expect, it } from "vitest";
import { StoryboardProject, renderFramePNG, type EditCommand } from "../../../../src/index.js";
import { fingerprint } from "../../../../src/core/edit-plan/fingerprint.js";
import { fixture } from "./fixture.js";

it("normalizes command defaults before hashing and retains tamper detection and durable replay", async () => {
  const { project, path, panel } = await fixture();
  project.capturePanelAnimation(panel.id, { id: "animation:defaults" });
  await project.save(path);
  const before = project.toJSON();
  const commands: EditCommand[] = [
    {
      op: "animation.edit",
      id: "animation:defaults",
      edits: [
        {
          op: "timing.retime",
          durationFrames: 48,
          frameRate: { numerator: 48, denominator: 1 },
          audio: "preserve-seconds",
        },
      ],
    },
  ];
  const input = structuredClone(commands);
  const plan = project.plan("Change rate", commands);
  expect(commands).toEqual(input);
  expect(project.toJSON()).toEqual(before);
  const explicit = project.plan("Change rate", [
    {
      op: "animation.edit",
      id: "animation:defaults",
      edits: [
        {
          op: "timing.retime",
          durationFrames: 48,
          rounding: "exact",
          frameRate: { numerator: 48, denominator: 1 },
          audio: "preserve-seconds",
        },
      ],
    },
  ]);
  expect(plan).toEqual(explicit);
  const { digest, ...body } = plan;
  expect(digest).toBe(fingerprint(body));
  const serialized = JSON.stringify(plan);
  await expect(
    project.commit(JSON.parse(serialized.replace('"exact"', '"nearest"')), {
      requestId: "tampered-default",
    }),
  ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
  expect(project.toJSON()).toEqual(before);
  const first = await project.commit(JSON.parse(serialized), { requestId: "normalized-default" });
  const reopened = await StoryboardProject.open(path);
  expect(reopened.shotAnimation("animation:defaults")).toMatchObject({
    durationFrames: 48,
    frameRate: { numerator: 48, denominator: 1 },
  });
  expect(
    await reopened.commit(JSON.parse(serialized), { requestId: "normalized-default" }),
  ).toEqual({ ...first, replayed: true });
  expect(reopened.version).toBe(first.receipt.committedVersion);
});

it("dry-runs data commands without touching source, rejects invalid/tampered input, and preserves render on save/open", async () => {
  const { project, path, panel, layer } = await fixture(),
    before = project.toJSON();
  const plan = project.plan("Revise shot", [
    { op: "project.configure", changes: { frameRate: { value: 48, timing: "preserve-seconds" } } },
    { op: "panel.revise", id: panel.id, changes: { dialogue: "Hello" } },
    { op: "layer.set", panelId: panel.id, id: layer.id, changes: { opacity: 0.5 } },
    { op: "panel.status", id: panel.id, status: "review" },
    { op: "project.metadata", key: "review", value: "requested" },
  ]);
  expect(project.toJSON()).toEqual(before);
  expect(() =>
    project.plan("Invalid", [
      { op: "project.metadata", key: "temporary", value: "discard" },
      { op: "layer.set", panelId: panel.id, id: layer.id, changes: { opacity: 5 } },
    ]),
  ).toThrow();
  expect(() => project.plan("Unknown", [{ op: "save" } as never])).toThrow();
  expect(project.toJSON()).toEqual(before);
  await expect(
    project.commit({ ...plan, label: "Tampered" }, { requestId: "edit-1" }),
  ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
  const result = await project.commit(JSON.parse(JSON.stringify(plan)), { requestId: "edit-1" });
  expect(result).toMatchObject({
    replayed: false,
    receipt: { baseVersion: before.version, committedVersion: before.version + 1 },
  });
  const reopened = await StoryboardProject.open(path);
  expect(reopened.toJSON()).toEqual(project.toJSON());
  expect(await renderFramePNG(reopened, 12)).toEqual(await renderFramePNG(project, 12));
  expect(reopened.toJSON().panels[0]).toMatchObject({
    dialogue: "Hello",
    status: "review",
    durationFrames: 48,
  });
  expect(project.undo()).toBe(true);
  expect(project.toJSON().panels).toEqual(before.panels);
  expect(project.redo()).toBe(true);
  expect(project.toJSON().panels).toEqual(reopened.toJSON().panels);
});

it("fingerprints keys canonically and exact pixel bytes distinctly", () => {
  expect(fingerprint({ b: 2, a: 1 })).toBe(fingerprint({ a: 1, b: 2 }));
  expect(fingerprint(new Uint8Array([1, 2]))).not.toBe(fingerprint([1, 2]));
  expect(fingerprint(new Uint8Array([1, 2]))).not.toBe(fingerprint(new Uint8Array([2, 1])));
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  expect(() => fingerprint(cyclic)).toThrow(/Cyclic/);
  expect(() => fingerprint({ fn: () => 0 })).toThrow();
});
