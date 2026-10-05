import { afterEach, expect, it, vi } from "vitest";
afterEach(() => vi.restoreAllMocks());

import assert from "node:assert/strict";
import { StoryboardProject, CodeboardError } from "../../../src/index.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function fixture() {
  const project = StoryboardProject.create({ title: "Discovery" });
  const scene = project.addScene("Room"),
    shot = scene.addShot("Reaction"),
    panel = shot.addPanel();
  const layer = panel.addVectorLayer("Face");
  project.transaction("Draw", () => {
    for (let i = 0; i < 215; i++)
      layer.vectorStroke([{ x: i, y: 1 }], { id: `mark:${i}`, name: `Mark ${i}` });
  });
  const key = project.production.addLayerKeyframe(layer.id, 0, { opacity: 1 });
  const camera = project.production.addCameraKeyframe(shot.id, 0, { zoom: 1 });
  const comment = project.production.comment("Correct eye", { layerId: layer.id });
  return { project, scene, shot, panel, layer, key, camera, comment };
}

it("discovers production hierarchy, animation keys and anchored comments without snapshotting artwork", () => {
  const { project, scene, shot, panel, layer, key, camera, comment } = fixture();
  const full = vi.spyOn(project, "toJSON").mockImplementation(() => {
    throw new Error("Full snapshot");
  });
  const clone = vi.spyOn(globalThis, "structuredClone");
  try {
    expect(project.production.query({ kind: "shot" }).items).toEqual([
      { id: shot.id, kind: "shot", name: "Reaction", parentId: scene.id },
    ]);
    expect(project.production.find({ kind: "scene" })[0]).toMatchObject({
      id: scene.id,
      parentId: "sequence:main",
    });
    expect(project.production.find({ kind: "sequence" })[0]).toMatchObject({
      parentId: project.id,
    });
    expect(project.production.query({ parentId: layer.id, kind: "layer-key" }).items[0]!.id).toBe(
      key,
    );
    expect(project.production.query({ parentId: shot.id, kind: "camera-key" }).items[0]!.id).toBe(
      camera,
    );
    expect(project.production.query({ panelId: panel.id, kind: "comment" }).items[0]).toMatchObject(
      { id: comment, parentId: layer.id, panelId: panel.id },
    );
    expect(project.production.query({ id: "mark:23" }).items[0]!.name).toBe("Mark 23");
    const summary = project.production.summary();
    expect(summary.counts).toMatchObject({ shots: 1, panels: 1, comments: 1 });
    summary.canvas.width = 1;
    expect(project.production.summary().canvas.width).toBe(1280);
    expect(clone).not.toHaveBeenCalled();
  } finally {
    full.mockRestore();
    clone.mockRestore();
  }
});

it("pages without duplicates, caps results and rejects changed filters or corrupt cursors", () => {
  const { project } = fixture();
  const first = project.production.query({ kind: "vector-stroke", limit: 999 });
  expect(first.items).toHaveLength(200);
  const second = project.production.query({ kind: "vector-stroke", cursor: first.nextCursor! });
  expect(second.items).toHaveLength(15);
  expect(second.nextCursor).toBeUndefined();
  expect(new Set([...first.items, ...second.items].map((row) => row.id)).size).toBe(215);
  expect(() => project.production.query({ kind: "group", cursor: first.nextCursor! })).toThrow(
    expect.objectContaining({ code: "INVALID_CURSOR" }),
  );
  for (const cursor of ["", "!invalid", Buffer.from("{}").toString("base64url"), "x".repeat(4097)])
    expect(() => project.production.query({ cursor })).toThrow(CodeboardError);
  for (const query of [{ offset: 1 }, { limit: 0 }, { limit: NaN }, { parentId: 7 }])
    expect(() => project.production.query(query as never)).toThrow(
      expect.objectContaining({ code: "INVALID_ARGUMENT" }),
    );
  first.items[0]!.name = "External change";
  expect(project.production.query({ id: "mark:0" }).items[0]!.name).toBe("Mark 0");
});

it("invalidates cursors on mutations, undo, different sessions and mutations within a transaction", () => {
  const { project } = fixture();
  const cursor = project.production.query({ limit: 1 }).nextCursor!;
  const other = StoryboardProject.fromJSON(project.toJSON());
  expect(() => other.production.query({ cursor })).toThrow(
    expect.objectContaining({ code: "STALE_CURSOR" }),
  );
  project.transaction("Edit while paging", () => {
    const inside = project.production.query({ limit: 1 }).nextCursor!;
    project.setMetadata("test", "yes");
    expect(() => project.production.query({ cursor: inside })).toThrow(
      expect.objectContaining({ code: "STALE_CURSOR" }),
    );
  });
  expect(() => project.production.query({ cursor })).toThrow(
    expect.objectContaining({ code: "STALE_CURSOR" }),
  );
  const changed = project.production.query({ limit: 1 }).nextCursor!;
  project.undo();
  expect(() => project.production.query({ cursor: changed })).toThrow(
    expect.objectContaining({ code: "STALE_CURSOR" }),
  );
});

it("serializes domain errors without leaking stack or mutable details", () => {
  const details = { field: "limit", expected: { min: 1 } };
  const error = new CodeboardError("INVALID_ARGUMENT", "Invalid limit", { details });
  details.expected.min = 0;
  const result = error.toJSON();
  expect(result).toEqual({
    code: "INVALID_ARGUMENT",
    message: "Invalid limit",
    retryable: false,
    details: { field: "limit", expected: { min: 1 } },
  });
  (result.details.expected as { min: number }).min = 10;
  expect(error.toJSON().details).toEqual({ field: "limit", expected: { min: 1 } });
});

it("bounds long labels while preserving stable IDs and filtering on the complete label", () => {
  const { project, layer } = fixture();
  const name = `${"x".repeat(10000)}needle`;
  layer.vectorStroke([{ x: 1, y: 1 }], { id: "long-label", name });
  expect(project.production.query({ name: "needle" }).items).toEqual([
    expect.objectContaining({ id: "long-label", name: "x".repeat(256), nameTruncated: true }),
  ]);
  expect(project.production.find({ id: "long-label" })[0]!.name).toBe(name);
  layer.vectorStroke([{ x: 1, y: 1 }], { id: "a".repeat(270000), name: "oversized ID" });
  expect(() => project.production.query({ name: "oversized ID" })).toThrow(
    expect.objectContaining({ code: "RESOURCE_LIMIT" }),
  );
});

it("queries saved hierarchy from the CLI and rejects stale multi-invocation pagination", async () => {
  const directory = await mkdtemp(join(tmpdir(), "board-query-"));
  try {
    const { project, shot } = fixture(),
      path = join(directory, "film.cboard");
    await project.save(path);
    const run = (args: string[]) =>
      spawnSync(process.execPath, ["--import", "tsx", "src/cli.ts", "query", path, ...args], {
        encoding: "utf8",
      });
    const first = run(["--kind", "shot", "--expected-version", String(project.version)]);
    assert.equal(first.status, 0, first.stderr);
    const result = JSON.parse(first.stdout);
    expect(result.items).toEqual([expect.objectContaining({ id: shot.id, kind: "shot" })]);
    expect(result.summary.counts.shots).toBe(1);
    const staleProject = await StoryboardProject.open(path);
    const old = project.version;
    project.setMetadata("review", "new");
    await project.save(path);
    const stale = run(["--kind", "shot", "--expected-version", String(old)]);
    expect(stale.status).toBe(1);
    expect(stale.stdout).toBe("");
    const errorLine = stale.stderr.split("\n").find((line) => line.startsWith('{"error"'))!;
    expect(JSON.parse(errorLine).error).toMatchObject({
      code: "REVISION_CONFLICT",
      details: { expected: old, actual: project.version },
    });
    staleProject.setMetadata("stale edit", "must not save");
    await expect(staleProject.save(path)).rejects.toMatchObject({
      code: "REVISION_CONFLICT",
      details: { expected: old, actual: project.version },
    });
    expect((await StoryboardProject.open(path)).toJSON().metadata).toEqual({ review: "new" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 15000);
