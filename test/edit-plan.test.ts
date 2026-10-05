import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { spawnSync, spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import {
  StoryboardProject,
  ProjectStore,
  renderFramePNG,
  brushes,
  createToneWav,
  planDrawingElement,
  pathCommands,
  type EditCommand,
} from "../src/index.js";
import { fingerprint } from "../src/core/edit-plan/fingerprint.js";

const folders: string[] = [];
afterEach(async () => {
  for (const folder of folders.splice(0)) await rm(folder, { recursive: true, force: true });
});
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "codeboard-plan-"));
  folders.push(dir);
  const path = join(dir, "project.cboard"),
    project = StoryboardProject.create({ title: "Plan", width: 48, height: 32 });
  const panel = project.addScene("Scene").addShot("Shot").addPanel({ durationFrames: 24 });
  const layer = panel.addRasterLayer("Ink");
  layer.rasterStroke(
    [
      { x: 4, y: 8, pressure: 1 },
      { x: 32, y: 8, pressure: 1 },
    ],
    brushes.cleanInk,
  );
  await project.save(path);
  return { dir, path, project, panel, layer };
}

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

it("replays after restart and later edits without reverting or discarding local work", async () => {
  const { project, path } = await fixture();
  const plan = project.plan("Title", [{ op: "project.configure", changes: { title: "First" } }]);
  const first = await project.commit(plan, { requestId: "request-1" });
  project.configure({ title: "Later" });
  await project.save(path);
  const reopened = await StoryboardProject.open(path);
  reopened.setMetadata("unsaved", "keep");
  const before = reopened.toJSON();
  expect(await reopened.commit(plan, { requestId: "request-1" })).toEqual({
    ...first,
    replayed: true,
  });
  expect(reopened.toJSON()).toEqual(before);
  const another = reopened.plan("Other", [
    { op: "project.configure", changes: { title: "Other" } },
  ]);
  await expect(reopened.commit(another, { requestId: "request-1" })).rejects.toMatchObject({
    code: "REQUEST_ID_REUSED",
  });
  expect((await StoryboardProject.open(path)).title).toBe("Later");
});

it("rejects stale writers, unsaved changes and equal-version divergent project copies", async () => {
  const { project, path, dir } = await fixture();
  const other = await StoryboardProject.open(path);
  const plan = project.plan("A", [{ op: "project.configure", changes: { title: "A" } }]);
  const stale = other.plan("B", [{ op: "project.configure", changes: { title: "B" } }]);
  const copy = project.toJSON();
  copy.title = "Diverged";
  const copyPath = join(dir, "copy.cboard"),
    diverged = StoryboardProject.fromJSON(copy);
  await diverged.save(copyPath);
  await expect(diverged.commit(plan, { requestId: "copy" })).rejects.toMatchObject({
    code: "REVISION_CONFLICT",
  });
  await project.commit(plan, { requestId: "A" });
  const before = other.toJSON();
  await expect(other.commit(stale, { requestId: "B" })).rejects.toMatchObject({
    code: "REVISION_CONFLICT",
  });
  expect(other.toJSON()).toEqual(before);
  other.setMetadata("unsaved", "value");
  const unsaved = other.plan("Unsaved", [
    { op: "project.configure", changes: { title: "Unsafe" } },
  ]);
  await expect(other.commit(unsaved, { requestId: "unsaved" })).rejects.toMatchObject({
    code: "REVISION_CONFLICT",
  });
  using store = ProjectStore.open(path);
  expect(store.readReceipt("B")).toBeNull();
});

it("uses authoring locks and rejects actor substitution", async () => {
  const { project, path, panel } = await fixture();
  const plan = project.plan("Caption", [
    { op: "panel.revise", id: panel.id, changes: { dialogue: "Edit" } },
  ]);
  const actor = await StoryboardProject.open(path, { actor: "agent:other" });
  await expect(actor.commit(plan, { requestId: "actor" })).rejects.toMatchObject({
    code: "INVALID_ARGUMENT",
  });
  project.production.lock("panel", panel.id, "Review");
  await project.save(path);
  const locked = await StoryboardProject.open(path, { actor: "agent:other" });
  expect(() =>
    locked.plan("Blocked", [{ op: "panel.revise", id: panel.id, changes: { dialogue: "Edit" } }]),
  ).toThrow(/Locked/);
});

it("rolls back artwork if receipt persistence fails, then permits the same request to succeed", async () => {
  const { project, path } = await fixture(),
    before = project.toJSON();
  const plan = project.plan("Atomic", [{ op: "project.configure", changes: { title: "Atomic" } }]);
  const db = new DatabaseSync(path);
  db.exec(
    "CREATE TRIGGER fail_receipt BEFORE INSERT ON roots WHEN NEW.key LIKE 'request:%' BEGIN SELECT RAISE(ABORT,'injected receipt failure'); END",
  );
  try {
    await expect(project.commit(plan, { requestId: "atomic" })).rejects.toThrow(
      /injected receipt failure/,
    );
  } finally {
    db.exec("DROP TRIGGER fail_receipt");
    db.close();
  }
  expect(project.toJSON()).toEqual(before);
  using store = ProjectStore.open(path);
  expect(store.readDocument()).toEqual(before);
  expect(store.readReceipt("atomic")).toBeNull();
  store.verify();
  expect((await project.commit(plan, { requestId: "atomic" })).replayed).toBe(false);
});

it("keeps receipts through named revision restore and compaction", async () => {
  const { project, path } = await fixture();
  using store = ProjectStore.open(path);
  store.saveRevision("before", { expectedVersion: project.version });
  const plan = project.plan("Persist", [
    { op: "project.configure", changes: { title: "Committed" } },
  ]);
  const first = await project.commit(plan, { requestId: "persist" });
  store.restoreRevision("before", { expectedVersion: project.version });
  store.compact();
  store.verify();
  expect(store.readReceipt("persist")).toEqual(first.receipt);
  const restored = await StoryboardProject.open(path);
  expect((await restored.commit(plan, { requestId: "persist" })).replayed).toBe(true);
  expect(restored.title).toBe("Plan");
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

function cli(args: string[]) {
  return spawnSync(process.execPath, [resolve("dist/src/cli.js"), ...args], {
    encoding: "utf8",
    windowsHide: true,
  });
}
it("plans brush versions, explicit component refresh, review retention and actor-owned locks", async () => {
  const { project, path, panel, layer } = await fixture(),
    originalLayer = project.production.layer(layer.id);
  const { version: _version, ...definition } = brushes.cleanInk;
  const setup = project.plan("Prepare reusable artwork", [
    { op: "brush.create", definition: { ...definition, id: "brush:studio", name: "Studio ink" } },
    { op: "brush.revise", id: "brush:studio", changes: { size: 9 } },
    { op: "brush.duplicate", id: "brush:studio", name: "Studio ink copy" },
    { op: "component.capture", layerId: layer.id, id: "component:ink", name: "Ink component" },
    {
      op: "component.instantiate",
      componentId: "component:ink",
      panelId: panel.id,
      id: "instance:ink",
      transform: { x: 3 },
    },
  ]);
  await project.commit(JSON.parse(JSON.stringify(setup)), { requestId: "library" });
  expect(project.production.brush("brush:studio")).toMatchObject({ size: 9, version: 2 });
  expect(project.production.layer(layer.id)).toEqual(originalLayer);
  const instance = project.production.layer("instance:ink");
  if (instance.kind !== "group" || instance.children[0]!.kind === "group")
    throw new Error("fixture");
  const child = instance.children[0]!,
    element = child.elements[0]!;
  const review = project.plan("Review instance", [
    {
      op: "review.comment",
      body: "Retain this note",
      anchor: { panelId: panel.id, elementId: element.id },
    },
    { op: "lock.acquire", targetType: "layer", targetId: child.id, reason: "Review in progress" },
  ]);
  await project.commit(review, { requestId: "review" });
  const doc = project.toJSON(),
    lock = doc.locks[0]!,
    comment = doc.comments[0]!;
  expect(comment.author).toBe(project.actor);
  expect(lock.owner).toBe(project.actor);
  expect(() =>
    project.plan("Locked refresh", [
      { op: "component.refresh", id: instance.id, comments: "anchor-to-instance" },
    ]),
  ).toThrow(/locked/);
  const other = await StoryboardProject.open(path, { actor: "agent:other" });
  expect(() => other.plan("Wrong owner", [{ op: "lock.release", id: lock.id }])).toThrow(/Only/);
  await project.commit(project.plan("Release review lock", [{ op: "lock.release", id: lock.id }]), {
    requestId: "unlock",
  });
  layer.set({ opacity: 0.5 });
  await project.save(path);
  await project.commit(
    project.plan("Publish new component source", [
      { op: "component.revise", id: "component:ink", sourceLayerId: layer.id },
    ]),
    { requestId: "revise-component" },
  );
  const before = project.toJSON();
  expect(() =>
    project.plan("Protected notes", [
      { op: "component.refresh", id: instance.id, comments: "reject" },
    ]),
  ).toThrow(/comments/);
  expect(project.toJSON()).toEqual(before);
  const refresh = project.plan("Refresh retaining notes", [
    { op: "component.refresh", id: instance.id, comments: "anchor-to-instance" },
    { op: "review.resolve", id: comment.id },
  ]);
  await project.commit(refresh, { requestId: "refresh" });
  const reopened = await StoryboardProject.open(path),
    updated = reopened.production.layer(instance.id);
  expect(updated).toMatchObject({
    transform: { x: 3 },
    componentSource: { id: "component:ink", version: 2 },
  });
  if (updated.kind !== "group") throw new Error("fixture");
  expect(updated.children[0]).toMatchObject({ opacity: 0.5 });
  expect(updated.children[0]!.id).not.toBe(child.id);
  expect(reopened.toJSON().comments[0]).toMatchObject({
    id: comment.id,
    status: "resolved",
    anchor: { panelId: panel.id, layerId: instance.id },
  });
  expect(reopened.toJSON().comments[0]!.anchor).not.toHaveProperty("elementId");
  expect((await reopened.commit(refresh, { requestId: "refresh" })).replayed).toBe(true);
  expect(await renderFramePNG(reopened, 0)).toEqual(await renderFramePNG(project, 0));
});
it("authors portable vector/text/brush elements, outlines and combines contours, and revises one object after restart", async () => {
  const { project, path, panel, layer } = await fixture();
  const vector = panel.addVectorLayer("Vector");
  await project.save(path);
  const source = project.production.layer(layer.id);
  if (source.kind === "group") throw new Error("fixture");
  const brush = source.elements[0]!;
  const text = planDrawingElement({
    kind: "text",
    id: "text:line",
    text: "A",
    x: 10,
    y: 20,
    color: "black",
    font: "12px sans-serif",
    align: "left",
    opacity: 1,
    visible: true,
  });
  const plan = project.plan("Author artwork", [
    {
      op: "element.add",
      panelId: panel.id,
      layerId: layer.id,
      element: planDrawingElement({ ...brush, id: "brush:copy" }),
    },
    { op: "element.add", panelId: panel.id, layerId: vector.id, element: text },
    {
      op: "element.add",
      panelId: panel.id,
      layerId: vector.id,
      element: planDrawingElement({
        kind: "vector-stroke",
        id: "stroke:outline",
        points: [
          { x: 5, y: 5 },
          { x: 20, y: 5 },
        ],
        color: "red",
        width: 4,
        opacity: 1,
        taperStart: 0,
        taperEnd: 0,
        pressureSize: 0,
        closed: false,
        visible: true,
      }),
    },
    { op: "element.outline", panelId: panel.id, layerId: vector.id, id: "stroke:outline" },
    {
      op: "element.boolean",
      panelId: panel.id,
      layerId: vector.id,
      id: "stroke:outline",
      tool: pathCommands("M 8 0 L 15 0 L 15 10 L 8 10 Z"),
      operation: "intersect",
    },
  ]);
  await project.commit(JSON.parse(JSON.stringify(plan)), { requestId: "art" });
  expect(project.production.element("stroke:outline").kind).toBe("vector-path");
  const reopened = await StoryboardProject.open(path),
    before = reopened.toJSON(),
    image = await renderFramePNG(reopened, 0);
  expect(image).toEqual(await renderFramePNG(project, 0));
  const revised = reopened.production.element("text:line");
  if (revised.kind !== "text") throw new Error("fixture");
  const edit = reopened.plan("Second-agent correction", [
    {
      op: "element.replace",
      panelId: panel.id,
      layerId: vector.id,
      id: revised.id,
      element: planDrawingElement({ ...revised, text: "B", color: "blue" }),
    },
  ]);
  await reopened.commit(edit, { requestId: "one-object" });
  const current = await StoryboardProject.open(path);
  expect(await renderFramePNG(current, 0)).not.toEqual(image);
  expect(current.production.layer(layer.id)).toEqual(before.panels[0]!.layers[0]);
  expect(current.production.element("stroke:outline")).toEqual(
    project.production.element("stroke:outline"),
  );
  expect((await current.commit(edit, { requestId: "one-object" })).replayed).toBe(true);
  expect(() =>
    current.plan("Change identity", [
      {
        op: "element.replace",
        panelId: panel.id,
        layerId: vector.id,
        id: revised.id,
        element: planDrawingElement({ ...revised, id: "different" }),
      },
    ]),
  ).toThrow(/stable id/);
  await current.commit(
    current.plan("Remove brush copy", [
      { op: "element.remove", panelId: panel.id, layerId: layer.id, ids: ["brush:copy"] },
    ]),
    { requestId: "remove-brush" },
  );
  expect(() => current.production.element("brush:copy")).toThrow();
});

it("preserves exact RGBA bytes in JSON plans and rejects malformed or out-of-bounds pixel patches", async () => {
  const { project, path, panel, layer } = await fixture();
  const pixels = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 64, 1, 2, 3, 0]);
  const element = planDrawingElement({
    kind: "raster-surface",
    id: "pixels:surface",
    width: 2,
    height: 2,
    pixels,
    matrix: [8, 0, 0, 8, 4, 4],
    opacity: 1,
    visible: true,
  });
  const add = project.plan("Pixel artwork", [
    { op: "element.add", panelId: panel.id, layerId: layer.id, element },
  ]);
  await project.commit(JSON.parse(JSON.stringify(add)), { requestId: "pixel-art" });
  const before = project.toJSON(),
    image = await renderFramePNG(project, 0),
    replacement = Buffer.from([40, 50, 60, 70]).toString("base64");
  const patch = {
    op: "pixels.patch" as const,
    panelId: panel.id,
    layerId: layer.id,
    id: "pixels:surface",
    region: { x: 1, y: 0, width: 1, height: 1 },
    pixelsBase64: replacement,
  };
  expect(() =>
    project.plan("Outside", [{ ...patch, region: { x: 2, y: 0, width: 1, height: 1 } }]),
  ).toThrow(/inside/);
  expect(() => project.plan("Wrong size", [{ ...patch, pixelsBase64: "AA==" }])).toThrow(/RGBA8/);
  expect(() =>
    project.plan("Noncanonical", [{ ...patch, pixelsBase64: replacement.replace(/=/g, "") }]),
  ).toThrow(/base64/);
  expect(project.toJSON()).toEqual(before);
  const plan = project.plan("Patch one pixel", [patch]);
  await project.commit(JSON.parse(JSON.stringify(plan)), { requestId: "pixel-patch" });
  const reopened = await StoryboardProject.open(path),
    result = reopened.production.element("pixels:surface");
  if (result.kind !== "raster-surface") throw new Error("fixture");
  expect([...result.pixels]).toEqual([255, 0, 0, 255, 40, 50, 60, 70, 0, 0, 255, 64, 1, 2, 3, 0]);
  expect(await renderFramePNG(reopened, 0)).not.toEqual(image);
  expect(await renderFramePNG(reopened, 0)).toEqual(await renderFramePNG(project, 0));
  expect((await reopened.commit(plan, { requestId: "pixel-patch" })).replayed).toBe(true);
  expect(() =>
    reopened.plan("Ambiguous bytes", [
      {
        op: "element.replace",
        panelId: panel.id,
        layerId: layer.id,
        id: result.id,
        element: { ...element, pixels: [1, 2, 3] } as never,
      },
    ]),
  ).toThrow();
});
it("builds and restructures a sequence with stable IDs while maintaining timeline and ownership", async () => {
  const { project, path } = await fixture(),
    before = project.toJSON();
  const plan = project.plan("Build production structure", [
    { op: "sequence.add", id: "seq:episode", name: "Episode" },
    { op: "scene.add", sequenceId: "seq:episode", id: "scene:intro", name: "Introduction" },
    { op: "shot.add", sceneId: "scene:intro", id: "shot:wide", name: "Wide" },
    { op: "shot.add", sceneId: "scene:intro", id: "shot:close", name: "Close" },
    { op: "panel.add", shotId: "shot:wide", options: { id: "panel:a", durationFrames: 12 } },
    { op: "panel.add", shotId: "shot:wide", options: { id: "panel:b", durationFrames: 12 } },
    { op: "panel.add", shotId: "shot:close", options: { id: "panel:c", durationFrames: 12 } },
    {
      op: "layer.add",
      panelId: "panel:a",
      kind: "group",
      name: "Character",
      options: { id: "layer:group", transform: { x: 5 } },
    },
    {
      op: "layer.add",
      panelId: "panel:a",
      kind: "vector",
      name: "Ink",
      options: { id: "layer:ink" },
      parentId: "layer:group",
    },
    {
      op: "layer.add",
      panelId: "panel:a",
      kind: "raster",
      name: "Paint",
      options: { id: "layer:paint" },
    },
    { op: "layer.reparent", id: "layer:ink", parentId: null, beforeId: "layer:group" },
    { op: "layer.move", id: "layer:paint", beforeId: "layer:ink" },
    { op: "layer.remove", id: "layer:group" },
    { op: "panel.duration", id: "panel:a", durationFrames: 24, mode: "ripple" },
    { op: "panel.move", id: "panel:b", beforeId: "panel:a" },
    { op: "panel.transition", id: "panel:a", transition: { type: "dissolve", durationFrames: 4 } },
    { op: "panel.number", id: "panel:a", number: "010A" },
  ]);
  expect(project.toJSON()).toEqual(before);
  await project.commit(JSON.parse(JSON.stringify(plan)), { requestId: "structure" });
  const reopened = await StoryboardProject.open(path),
    doc = reopened.toJSON();
  expect(
    doc.panels.map((panel) => [panel.id, panel.startFrame, panel.durationFrames]).slice(1),
  ).toEqual([
    ["panel:b", 24, 12],
    ["panel:a", 36, 24],
    ["panel:c", 60, 12],
  ]);
  expect(doc.panels.find((panel) => panel.id === "panel:a")).toMatchObject({
    number: "010A",
    transition: { type: "dissolve", durationFrames: 4 },
    layers: [{ id: "layer:paint" }, { id: "layer:ink" }],
  });
  expect(
    reopened.production.query({ parentId: "scene:intro" }).items.map((item) => item.id),
  ).toEqual(["shot:wide", "shot:close"]);
  expect((await reopened.commit(plan, { requestId: "structure" })).replayed).toBe(true);
  const state = reopened.toJSON();
  expect(() =>
    reopened.plan("Duplicate ID", [{ op: "sequence.add", id: "seq:episode", name: "Duplicate" }]),
  ).toThrow();
  expect(() =>
    reopened.plan("Invalid parent", [
      {
        op: "layer.add",
        panelId: "panel:a",
        kind: "vector",
        name: "Bad",
        options: { id: "layer:bad" },
        parentId: "layer:ink",
      },
    ]),
  ).toThrow(/group/);
  expect(() =>
    reopened.plan("Cross-shot move", [{ op: "panel.move", id: "panel:a", beforeId: "panel:c" }]),
  ).toThrow(/shot/);
  expect(reopened.toJSON()).toEqual(state);
  await reopened.commit(
    reopened.plan("Duplicate panel", [{ op: "panel.duplicate", id: "panel:a" }]),
    { requestId: "duplicate" },
  );
  const copied = reopened.toJSON().panels.find((panel) => panel.title.endsWith(" copy"))!;
  expect(copied).toBeDefined();
  expect(copied.layers[0]!.id).not.toBe("layer:paint");
  await reopened.commit(
    reopened.plan("Remove duplicate", [{ op: "panel.remove", id: copied.id }]),
    { requestId: "remove-copy" },
  );
  const content = (panels: typeof state.panels) => panels.map(({ revision, ...panel }) => panel);
  expect(content(reopened.toJSON().panels)).toEqual(content(state.panels));
  expect(reopened.toJSON().panels.find((panel) => panel.id === "panel:c")!.revision).toBe(
    state.panels.find((panel) => panel.id === "panel:c")!.revision + 2,
  );
  using store = ProjectStore.open(path);
  store.verify();
});
it("pins imported media bytes and rolls back both clip edits and receipts on missing or changed sources", async () => {
  const { project, path, dir } = await fixture(),
    before = project.toJSON();
  const bytes = createToneWav({ frequency: 220 }),
    changed = createToneWav({ frequency: 440 });
  const checksum = (value: Buffer) => createHash("sha256").update(value).digest("hex");
  const source = join(dir, "voice.wav"),
    asset = {
      id: "asset:voice",
      kind: "audio" as const,
      name: "Voice",
      path: "voice.wav",
      mimeType: "audio/wav",
      source: "managed" as const,
      checksum: checksum(bytes),
    };
  const plan = project.plan("Import voice and place clip", [
    { op: "asset.add", asset },
    { op: "audio.track.add", id: "track:voice", name: "Voice" },
    {
      op: "audio.clip.add",
      trackId: "track:voice",
      clip: {
        id: "clip:voice",
        assetId: asset.id,
        name: "Voice",
        startFrame: 0,
        sourceInFrame: 0,
        durationFrames: 24,
        volume: 1,
        fadeInFrames: 0,
        fadeOutFrames: 0,
      },
    },
  ]);
  await expect(project.commit(plan, { requestId: "import" })).rejects.toMatchObject({
    code: "ASSET_MISSING",
  });
  expect(project.toJSON()).toEqual(before);
  await writeFile(source, changed);
  await expect(project.commit(plan, { requestId: "import" })).rejects.toMatchObject({
    code: "ASSET_CHECKSUM_MISMATCH",
    details: { assetId: asset.id },
  });
  using store = ProjectStore.open(path);
  expect(store.readDocument()).toEqual(before);
  expect(store.readReceipt("import")).toBeNull();
  store.verify();
  await writeFile(source, bytes);
  await project.commit(JSON.parse(JSON.stringify(plan)), { requestId: "import" });
  expect(project.readAsset(asset.id)).toEqual(bytes);
  await writeFile(source, changed);
  expect((await project.commit(plan, { requestId: "import" })).replayed).toBe(true);
  expect(project.readAsset(asset.id)).toEqual(bytes);
  const replace = project.plan("Replace voice", [
    { op: "asset.update", id: asset.id, changes: { checksum: checksum(changed) } },
  ]);
  await project.commit(replace, { requestId: "replace-voice" });
  expect((await StoryboardProject.open(path)).readAsset(asset.id)).toEqual(changed);
  expect(project.production.audioClip("clip:voice").assetId).toBe(asset.id);
  expect(() =>
    project.plan("Unpinned", [
      { op: "asset.add", asset: { ...asset, checksum: undefined } as never },
    ]),
  ).toThrow();
  store.verify();
});
it("edits audio tracks and clips atomically while retaining source bytes, offsets and fades", async () => {
  const { project, path, dir } = await fixture();
  const wav = createToneWav();
  await writeFile(join(dir, "tone.wav"), wav);
  const assetId = project.production.addAsset({
    kind: "audio",
    name: "Tone",
    path: "tone.wav",
    mimeType: "audio/wav",
    source: "managed",
  });
  await project.save(path);
  const before = project.toJSON();
  const plan = project.plan("Audio edit", [
    { op: "audio.track.add", id: "track:dialogue", name: "Dialogue" },
    { op: "audio.track.add", id: "track:alt", name: "Alternate" },
    {
      op: "audio.clip.add",
      trackId: "track:dialogue",
      clip: {
        id: "clip:line",
        assetId,
        name: "Line",
        startFrame: 0,
        sourceInFrame: 3,
        durationFrames: 20,
        volume: 1,
        fadeInFrames: 2,
        fadeOutFrames: 2,
      },
    },
    {
      op: "audio.clip.update",
      trackId: "track:dialogue",
      id: "clip:line",
      changes: { volume: 0.7, name: "Edited line" },
    },
    { op: "audio.clip.move", id: "clip:line", trackId: "track:alt", startFrame: 2 },
    { op: "audio.clip.split", id: "clip:line", frame: 12 },
    {
      op: "audio.track.update",
      id: "track:alt",
      changes: { name: "Selected dialogue", muted: false },
    },
    { op: "audio.track.remove", id: "track:dialogue" },
  ]);
  expect(project.toJSON()).toEqual(before);
  await project.commit(JSON.parse(JSON.stringify(plan)), { requestId: "audio" });
  const reopened = await StoryboardProject.open(path),
    clips = reopened.production.audioClips("track:alt");
  expect(clips).toHaveLength(2);
  expect(clips[0]).toMatchObject({
    id: "clip:line",
    startFrame: 2,
    sourceInFrame: 3,
    durationFrames: 10,
    fadeInFrames: 2,
    fadeOutFrames: 0,
    volume: 0.7,
  });
  expect(clips[1]).toMatchObject({
    startFrame: 12,
    sourceInFrame: 13,
    durationFrames: 10,
    fadeInFrames: 0,
    fadeOutFrames: 2,
    volume: 0.7,
  });
  expect(reopened.readAsset(assetId)).toEqual(wav);
  expect((await reopened.commit(plan, { requestId: "audio" })).replayed).toBe(true);
  expect(reopened.production.audioClips("track:alt")).toEqual(clips);
  const current = reopened.toJSON();
  expect(() =>
    reopened.plan("Bad split", [
      { op: "audio.track.update", id: "track:alt", changes: { name: "discard" } },
      { op: "audio.clip.split", id: "clip:line", frame: 3 },
    ]),
  ).toThrow(/fade/);
  expect(() =>
    reopened.plan("Bad asset", [
      {
        op: "audio.clip.add",
        trackId: "track:alt",
        clip: { ...clips[0]!, id: "clip:bad", assetId: "missing" },
      },
    ]),
  ).toThrow(/asset/);
  expect(reopened.toJSON()).toEqual(current);
  await reopened.commit(
    reopened.plan("Lock track", [
      { op: "audio.track.update", id: "track:alt", changes: { locked: true } },
    ]),
    { requestId: "lock-audio" },
  );
  expect(() =>
    reopened.plan("Locked clip", [
      { op: "audio.clip.remove", trackId: "track:alt", id: clips[1]!.id },
    ]),
  ).toThrow(/locked/);
  await reopened.commit(
    reopened.plan("Remove alternate", [
      { op: "audio.track.update", id: "track:alt", changes: { locked: false } },
      { op: "audio.clip.remove", trackId: "track:alt", id: clips[1]!.id },
    ]),
    { requestId: "remove-audio" },
  );
  expect(reopened.production.audioClips("track:alt")).toEqual([clips[0]]);
});
it("plans sparse camera and layer channels, preserves key identity and rejects frame collisions atomically", async () => {
  const { project, path, panel, layer } = await fixture(),
    shotId = project.toJSON().panels[0]!.shotId;
  const plan = project.plan("Camera and acting", [
    { op: "camera.key", shotId, frame: 0, value: { x: 0, zoom: 1 } },
    { op: "camera.key", shotId, frame: 12, value: { x: 4, zoom: 1.2, easing: "ease-in-out" } },
    { op: "layer.key", layerId: layer.id, frame: 0, value: { transform: { x: 0 }, opacity: 1 } },
    { op: "layer.key", layerId: layer.id, frame: 12, value: { transform: { x: 8 }, opacity: 0.5 } },
  ]);
  await project.commit(plan, { requestId: "keys" });
  const camera = project.production.cameraKeyframes(shotId)[1]!,
    key = project.production.layerKeyframes(layer.id)[1]!;
  const before = project.toJSON();
  expect(() =>
    project.plan("Collision", [
      { op: "panel.revise", id: panel.id, changes: { dialogue: "discard" } },
      { op: "camera.key.update", shotId, id: camera.id, changes: { frame: 0 } },
    ]),
  ).toThrow();
  expect(() =>
    project.plan("Empty channel", [
      { op: "layer.key", layerId: layer.id, frame: 8, value: { easing: "hold" } },
    ]),
  ).toThrow();
  expect(() =>
    project.plan("Unknown channel", [
      { op: "camera.key", shotId, frame: 8, value: { typo: 1 } as never },
    ]),
  ).toThrow();
  expect(project.toJSON()).toEqual(before);
  const revise = project.plan("Refine channels", [
    { op: "camera.key", shotId, frame: 12, value: { y: 3, easing: "hold" } },
    { op: "camera.key.update", shotId, id: camera.id, changes: { zoom: 1.4 } },
    { op: "camera.key.removeChannels", shotId, id: camera.id, channels: ["x"] },
    { op: "layer.key", layerId: layer.id, frame: 12, value: { transform: { rotation: 0.2 } } },
    { op: "layer.key.update", layerId: layer.id, id: key.id, changes: { opacity: 0.7 } },
    { op: "layer.key.removeChannels", layerId: layer.id, id: key.id, channels: ["x"] },
  ]);
  await project.commit(JSON.parse(JSON.stringify(revise)), { requestId: "refine" });
  expect(project.production.cameraKeyframes(shotId)[1]).toMatchObject({
    id: camera.id,
    y: 3,
    zoom: 1.4,
    channelEasing: { y: "hold" },
  });
  expect(project.production.cameraKeyframes(shotId)[1]).not.toHaveProperty("x");
  expect(project.production.layerKeyframes(layer.id)[1]).toMatchObject({
    id: key.id,
    opacity: 0.7,
    transform: { rotation: 0.2 },
  });
  expect(project.production.layerKeyframes(layer.id)[1]!.transform).not.toHaveProperty("x");
  const reopened = await StoryboardProject.open(path);
  for (const frame of [12, 0, 6])
    expect(await renderFramePNG(reopened, frame)).toEqual(await renderFramePNG(project, frame));
  expect((await reopened.commit(revise, { requestId: "refine" })).replayed).toBe(true);
  const remove = reopened.plan("Remove terminal keys", [
    { op: "camera.key.remove", shotId, id: camera.id },
    { op: "layer.key.remove", layerId: layer.id, id: key.id },
  ]);
  await reopened.commit(remove, { requestId: "remove-keys" });
  expect(reopened.production.cameraKeyframes(shotId)).toHaveLength(1);
  expect(reopened.production.layerKeyframes(layer.id)).toHaveLength(1);
});
it("commits exposure and rig revisions as one recoverable transaction without changing unrelated drawings", async () => {
  const { project, path, panel } = await fixture();
  const drawings = panel.addGroup("Drawings"),
    a = panel.addVectorLayer("A", {}, drawings.id),
    b = panel.addVectorLayer("B", {}, drawings.id);
  a.vectorStroke(
    [
      { x: 5, y: 5 },
      { x: 15, y: 5 },
    ],
    { color: "red", width: 3 },
  );
  b.vectorStroke(
    [
      { x: 5, y: 15 },
      { x: 15, y: 15 },
    ],
    { color: "blue", width: 3 },
  );
  const root = panel.addGroup("Arm"),
    elbow = panel.addGroup("Elbow", { transform: { x: 10 } }, root.id);
  panel.addVectorLayer("Hand", {}, elbow.id).vectorStroke(
    [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ],
    { color: "green", width: 3 },
  );
  await project.save(path);
  const before = project.toJSON();
  const plan = project.plan("Animate drawings and arm", [
    { op: "drawing.sequence", id: drawings.id, keys: [{ frame: 0, drawingId: a.id }] },
    { op: "drawing.range", id: drawings.id, startFrame: 4, endFrame: 8, drawingId: b.id },
    { op: "layer.exposure", id: drawings.id, exposure: { startFrame: 0, endFrame: 12 } },
    { op: "layer.depth", id: drawings.id, depth: 2 },
    {
      op: "rig.define",
      id: root.id,
      definition: { elbowId: elbow.id, upperLength: 10, lowerLength: 10 },
    },
    { op: "rig.pose", id: root.id, frame: 4, target: { x: 10, y: 10 }, bend: -1 },
  ]);
  expect(project.toJSON()).toEqual(before);
  await project.commit(JSON.parse(JSON.stringify(plan)), { requestId: "animation" });
  expect(project.production.drawingSequence(drawings.id).keys).toEqual([
    { frame: 0, drawingId: a.id },
    { frame: 4, drawingId: b.id },
    { frame: 8, drawingId: a.id },
  ]);
  expect(project.production.layer(drawings.id)).toMatchObject({
    depth: 2,
    exposure: { startFrame: 0, endFrame: 12 },
  });
  expect(project.production.layerKeyframes(root.id)).toHaveLength(1);
  expect(project.production.layerKeyframes(elbow.id)).toHaveLength(1);
  const reopened = await StoryboardProject.open(path);
  for (const frame of [0, 4, 8, 12])
    expect(await renderFramePNG(reopened, frame)).toEqual(await renderFramePNG(project, frame));
  expect(reopened.toJSON().panels[0]!.layers[0]).toEqual(before.panels[0]!.layers[0]);
  const committed = reopened.toJSON();
  expect(() =>
    reopened.plan("Invalid drawing", [
      { op: "drawing.range", id: drawings.id, startFrame: 2, endFrame: 5, drawingId: elbow.id },
    ]),
  ).toThrow();
  expect(() =>
    reopened.plan("Invalid rig", [
      {
        op: "rig.define",
        id: root.id,
        definition: { elbowId: a.id, upperLength: 10, lowerLength: 10 },
      },
    ]),
  ).toThrow();
  expect(reopened.toJSON()).toEqual(committed);
  expect((await reopened.commit(plan, { requestId: "animation" })).replayed).toBe(true);
});
function concurrentCLI(
  args: string[],
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((accept, reject) => {
    const child = spawn(process.execPath, [resolve("dist/src/cli.js"), ...args], {
      windowsHide: true,
    });
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("exit", (code) => accept({ code, stdout, stderr }));
  });
}

it("CLI plans and concurrently retries a request once, then retrieves its durable receipt", async () => {
  const { project, path, dir } = await fixture();
  const commands = join(dir, "commands.json"),
    planPath = join(dir, "plan.json");
  await writeFile(
    commands,
    JSON.stringify([{ op: "project.configure", changes: { title: "CLI" } }]),
  );
  const planned = cli(["plan", path, commands, "--label", "CLI edit"]);
  assert.equal(planned.status, 0, planned.stderr);
  await writeFile(planPath, planned.stdout);
  const results = await Promise.all([
    concurrentCLI(["commit", path, planPath, "--request-id", "cli"]),
    concurrentCLI(["commit", path, planPath, "--request-id", "cli"]),
  ]);
  for (const result of results) assert.equal(result.code, 0, result.stderr);
  const values = results.map((result) => JSON.parse(result.stdout));
  expect(values.map((value) => value.replayed).sort()).toEqual([false, true]);
  expect(values[0].receipt).toEqual(values[1].receipt);
  expect((await StoryboardProject.open(path)).version).toBe(project.version + 1);
  const read = cli(["receipt", path, "cli"]);
  assert.equal(read.status, 0, read.stderr);
  expect(JSON.parse(read.stdout)).toEqual(values[0].receipt);
});

it("recovers after process death before commit and retries after a lost acknowledgement", async () => {
  const { project, path, dir } = await fixture(),
    before = project.toJSON();
  const plan = project.plan("Crash recovery", [
    { op: "project.configure", changes: { title: "Recovered" } },
  ]);
  const moduleURL = pathToFileURL(resolve("dist/src/index.js")).href;
  const script = join(dir, "crash.mjs");
  await writeFile(
    script,
    `
    import {StoryboardProject} from ${JSON.stringify(moduleURL)};
    import {DatabaseSync} from 'node:sqlite';
    const [path,mode]=process.argv.slice(2);
    const project=await StoryboardProject.open(path);
    if(mode==='before'){
      const original=DatabaseSync.prototype.exec;
      DatabaseSync.prototype.exec=function(sql){
        if(sql.trim().toUpperCase()==='COMMIT' &&
          this.prepare("SELECT hash FROM roots WHERE key='request:crash'").get())process.exit(23);
        return original.call(this,sql);
      };
    }
    await project.commit(${JSON.stringify(plan)},{requestId:'crash'});
    process.exit(24);
  `,
  );
  expect(spawnSync(process.execPath, [script, path, "before"], { windowsHide: true }).status).toBe(
    23,
  );
  using store = ProjectStore.open(path);
  expect(store.readDocument()).toEqual(before);
  expect(store.readReceipt("crash")).toBeNull();
  store.verify();
  expect(spawnSync(process.execPath, [script, path, "after"], { windowsHide: true }).status).toBe(
    24,
  );
  const recovered = await StoryboardProject.open(path),
    receipt = store.readReceipt("crash");
  expect(receipt).not.toBeNull();
  expect(recovered.title).toBe("Recovered");
  expect(await recovered.commit(plan, { requestId: "crash" })).toEqual({ receipt, replayed: true });
  expect(recovered.version).toBe(before.version + 1);
  store.verify();
});
