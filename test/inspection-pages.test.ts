afterEach(() => jest.restoreAllMocks());

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StoryboardProject, ProjectStore } from "../src/index.js";

it("pages long audit histories without cloning the document or sharing returned entries", () => {
  const p = StoryboardProject.create({ title: "Audit pages" }),
    baseline = p.version;
  for (let i = 0; i < 235; i++) p.setMetadata("iteration", String(i));
  const expected = p.toJSON().changes.filter((c) => c.version > baseline),
    snapshot = jest.spyOn(p, "toJSON").mockImplementation(() => {
      throw new Error("Unexpected document clone");
    });
  try {
    expect(p.production.changesSince(baseline)).toEqual(expected.slice(0, 50));
    expect(p.production.changesSince(baseline, { limit: 999 })).toEqual(expected.slice(0, 200));
    expect(p.production.changesSince(baseline, { limit: 200, offset: 200 })).toEqual(
      expected.slice(200),
    );
    expect(p.production.changesSince(baseline, { offset: 235 })).toEqual([]);
    const first = p.production.changesSince(baseline, { limit: 1 });
    first[0]!.targetIds.push("foreign");
    expect(p.production.changesSince(baseline, { limit: 1 })).toEqual(expected.slice(0, 1));
    for (const version of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
      expect(() => p.production.changesSince(version)).toThrow(/Audit version/);
    for (const query of [
      { limit: 0 },
      { limit: 1.5 },
      { limit: NaN },
      { offset: -1 },
      { offset: Infinity },
    ])
      expect(() => p.production.changesSince(baseline, query)).toThrow(/safe integer/);
  } finally {
    snapshot.mockRestore();
  }
});

it("applies the same pagination contract to live objects, stored objects and named revisions", async () => {
  const dir = await mkdtemp(join(tmpdir(), "inspection-pages-"));
  try {
    const p = StoryboardProject.create({ title: "Object pages" }),
      panel = p.addScene("s").addShot("s").addPanel(),
      layer = panel.addVectorLayer("Ink");
    p.transaction("Add searchable marks", () => {
      for (let i = 0; i < 235; i++) layer.vectorStroke([{ x: i, y: 1 }], { name: `mark ${i}` });
    });
    const path = join(dir, "pages.cboard");
    await p.save(path);
    const store = ProjectStore.open(path);
    try {
      for (const query of [
        { limit: 0 },
        { limit: -1 },
        { limit: 0.5 },
        { limit: NaN },
        { limit: Infinity },
        { offset: -1 },
        { offset: 0.5 },
        { offset: NaN },
        { offset: Infinity },
      ]) {
        expect(() => p.production.find(query)).toThrow(/safe integer/);
        expect(() => store.findObjects(query)).toThrow(/safe integer/);
        expect(() => store.listRevisions(query)).toThrow(/safe integer/);
      }
      expect(store.findObjects({ name: "mark" })).toHaveLength(50);
      expect(store.findObjects({ name: "mark", limit: 999 })).toHaveLength(200);
      expect(store.findObjects({ name: "mark", limit: 200, offset: 200 })).toHaveLength(35);
      expect(store.findObjects({ name: "mark", offset: 235 })).toEqual([]);
    } finally {
      store.close();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
