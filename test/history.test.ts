import { applyRevision, difference } from "../src/core/history.js";

it("copies only edited history branches and leaves the supplied document intact", () => {
  const before = {
    panels: [
      { id: "a", items: [{ opacity: 1 }, { opacity: 0.5 }] },
      { id: "b", pixels: new Uint8Array(1024) },
    ],
    metadata: { title: "Before" },
  };
  const after = structuredClone(before);
  after.panels[0]!.items![0]!.opacity = 0.25;
  const edits = difference(before, after),
    result = applyRevision(before, edits, "after");
  expect(result).toEqual(after);
  expect(result.panels).not.toBe(before.panels);
  expect(result.panels[0]).not.toBe(before.panels[0]);
  expect(result.panels[0]!.items![1]).toBe(before.panels[0]!.items![1]);
  expect(result.panels[1]).toBe(before.panels[1]);
  expect(result.metadata).toBe(before.metadata);
  expect(before.panels[0]!.items![0]!.opacity).toBe(1);
  expect(applyRevision(result, edits, "before")).toEqual(before);
});

it("restores array length, deleted properties and several pixel patches without touching source bytes", () => {
  const before = {
    items: [{ name: "a" }, { name: "b" }, { name: "c" }],
    pixels: new Uint8Array(150000),
    metadata: { obsolete: "yes" } as Record<string, string>,
  };
  const after = structuredClone(before);
  after.items.splice(1, 2);
  delete after.metadata.obsolete;
  after.pixels[1] = 28;
  after.pixels[70000] = 81;
  after.pixels[140000] = 255;
  const edits = difference(before, after),
    forward = applyRevision(before, edits, "after");
  expect(forward).toEqual(after);
  expect(before.items).toHaveLength(3);
  expect(before.pixels.every((v) => v === 0)).toBe(true);
  const backward = applyRevision(forward, edits, "before");
  expect(backward).toEqual(before);
  expect(forward.pixels[140000]).toBe(255);
  expect(Object.hasOwn(forward.metadata, "obsolete")).toBe(false);
});

it("copies Buffer-backed pixels rather than taking an aliased slice", () => {
  const before = { pixels: Buffer.from([0, 0, 0, 0]) },
    after = { pixels: Buffer.from([0, 80, 0, 0]) };
  expect([...applyRevision(before, difference(before, after), "after").pixels]).toEqual([
    0, 80, 0, 0,
  ]);
  expect([...before.pixels]).toEqual([0, 0, 0, 0]);
  const retained = difference(before, after);
  after.pixels[1] = 99;
  expect([...applyRevision(before, retained, "after").pixels]).toEqual([0, 80, 0, 0]);
  const bytes = new Uint8Array([0, 0, 0]),
    changed = new Uint8Array([0, 42, 0]);
  expect(applyRevision(bytes, difference(bytes, changed), "after")).toEqual(changed);
  expect(bytes).toEqual(new Uint8Array(3));
});
