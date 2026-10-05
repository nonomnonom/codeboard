import { afterEach, expect, it, vi } from "vitest";
afterEach(() => vi.restoreAllMocks());

import {
  StoryboardProject,
  renderFramePNG,
  renderPanelPNG,
  createRenderSession,
  decodePixels,
} from "../../../src/index.js";

function fixture() {
  const project = StoryboardProject.create({ title: "Transitions", width: 32, height: 16 });
  const scene = project.addScene("S"),
    a = scene.addShot("A").addPanel({ durationFrames: 4 }),
    b = scene.addShot("B").addPanel({ durationFrames: 4 });
  for (const [panel, color] of [
    [a, "#ff0000"],
    [b, "#0000ff"],
  ] as const)
    panel
      .addVectorLayer("Color")
      .path(
        [
          { op: "M", x: 0, y: 0 },
          { op: "L", x: 32, y: 0 },
          { op: "L", x: 32, y: 16 },
          { op: "L", x: 0, y: 16 },
          { op: "Z" },
        ],
        { fill: color },
      );
  return { project, a, b };
}

it.each(["cut", "dissolve", "wipe-left", "wipe-right"] as const)(
  "copies only the active and necessary incoming panel for %s frame review",
  async (type) => {
    const { project, a, b } = fixture();
    project
      .addScene("Unrelated")
      .addShot("Later")
      .addPanel({ durationFrames: 20 })
      .addVectorLayer("Unrelated drawing");
    if (type !== "cut") project.production.setTransition(a.id, { type, durationFrames: 2 });
    const full = project.toJSON(),
      reference = [];
    for (let frame = 0; frame < 8; frame++) reference.push(await renderFramePNG(full, frame));
    const snapshot = vi.spyOn(project, "_readRenderFrame"),
      whole = vi.spyOn(project, "toJSON").mockImplementation(() => {
        throw new Error("Whole-project snapshot");
      });
    try {
      for (let frame = 0; frame < 8; frame++) {
        snapshot.mockClear();
        expect(await renderFramePNG(project, frame)).toEqual(reference[frame]);
        expect(snapshot).toHaveBeenCalledTimes(1);
        expect(snapshot).toHaveBeenCalledWith(frame);
        expect(
          snapshot.mock.results[0]!.value.panels.map((panel: { id: string }) => panel.id),
        ).toEqual(frame >= 4 ? [b.id] : frame >= 2 && type !== "cut" ? [a.id, b.id] : [a.id]);
      }
      const clone = vi.spyOn(globalThis, "structuredClone");
      try {
        expect(() => project._readRenderFrame(28)).toThrow(/No panel/);
        expect(() => project._readRenderFrame(-1)).toThrow(/nonnegative/);
        expect(clone).not.toHaveBeenCalled();
      } finally {
        clone.mockRestore();
      }
    } finally {
      snapshot.mockRestore();
      whole.mockRestore();
    }
    expect(project.toJSON()).toEqual(full);
  },
);

it.each(["dissolve", "wipe-left", "wipe-right"] as const)(
  "renders %s direction, blend and exact transition boundaries",
  async (type) => {
    const { project, a, b } = fixture();
    project.production.setTransition(a.id, { type, durationFrames: 2 });
    const session = createRenderSession(project),
      render = async (frame: number) => {
        const png = await renderFramePNG(project, frame);
        expect((await session.frame(frame).toBuffer("png")).equals(png)).toBe(true);
        return decodePixels(png);
      };
    const pixel = (image: Awaited<ReturnType<typeof decodePixels>>, x: number) => [
      ...image.pixels.slice((8 * 32 + x) * 4, (8 * 32 + x) * 4 + 3),
    ];
    expect(pixel(await render(1), 4)).toEqual([255, 0, 0]);
    const half = await render(2);
    if (type === "dissolve") {
      for (const x of [4, 28]) {
        const rgb = pixel(half, x);
        expect(Math.abs(rgb[0]! - 128)).toBeLessThanOrEqual(1);
        expect(rgb[1]).toBe(0);
        expect(Math.abs(rgb[2]! - 128)).toBeLessThanOrEqual(1);
      }
    } else {
      expect(pixel(half, 4)).toEqual(type === "wipe-left" ? [255, 0, 0] : [0, 0, 255]);
      expect(pixel(half, 28)).toEqual(type === "wipe-left" ? [0, 0, 255] : [255, 0, 0]);
    }
    expect(pixel(await render(3), 4)).toEqual([0, 0, 255]);
    expect(
      (await renderFramePNG(project, 4)).equals(
        await renderPanelPNG(project, b.id, { frame: 4, annotations: false }),
      ),
    ).toBe(true);
  },
);

it("rejects invalid transition updates inside a transaction without partial changes", () => {
  const { project, a } = fixture();
  project.transaction("Correct transition", () => {
    const before = project.toJSON();
    for (const transition of [
      { type: "unknown", durationFrames: 2 },
      { type: "dissolve", durationFrames: NaN },
      { type: "wipe-left", durationFrames: 1.5 },
      { type: "dissolve", durationFrames: 4 },
    ]) {
      expect(() => project.production.setTransition(a.id, transition as never)).toThrow();
      expect(project.toJSON()).toEqual(before);
    }
    project.production.setTransition(a.id, { type: "dissolve", durationFrames: 2 });
  });
  project.undo();
  expect(project.toJSON().panels[0]!.transition.type).toBe("cut");
  project.redo();
  expect(project.toJSON().panels[0]!.transition.type).toBe("dissolve");
});

it.each(["dissolve", "wipe-left", "wipe-right"] as const)(
  "preserves incoming transparency and first-frame timing during %s",
  async (type) => {
    const { project, a, b } = fixture(),
      layer = b.addVectorLayer("Incoming motion", { exposure: { startFrame: 4, endFrame: 8 } });
    layer.path(
      [
        { op: "M", x: 4, y: 3 },
        { op: "L", x: 9, y: 3 },
        { op: "L", x: 9, y: 10 },
        { op: "L", x: 4, y: 10 },
        { op: "Z" },
      ],
      { fill: "#00ff00" },
    );
    project.production.addLayerKeyframe(layer.id, 4, { transform: { x: 0 } });
    project.production.addLayerKeyframe(layer.id, 7, { transform: { x: 12 } });
    const shotId = project.toJSON().panels.find((p) => p.id === b.id)!.shotId;
    project.production.addCameraKeyframe(shotId, 4, {
      x: 1,
      y: 0,
      zoom: 1,
      rotation: 0,
      easing: "linear",
    });
    project.production.addCameraKeyframe(shotId, 7, {
      x: 4,
      y: 0,
      zoom: 1,
      rotation: 0,
      easing: "linear",
    });
    project.production.setTransition(a.id, { type, durationFrames: 2 });
    const initial = await renderPanelPNG(project, b.id, { frame: 4, annotations: false });
    const actual = await decodePixels(await renderFramePNG(project, 3)),
      expected = await decodePixels(initial);
    expect(Buffer.from(actual.pixels).equals(Buffer.from(expected.pixels))).toBe(true);
    if (type === "dissolve") {
      const half = await decodePixels(await renderFramePNG(project, 2));
      expect(Math.abs(half.pixels[(8 * 32 + 31) * 4 + 3]! - 128)).toBeLessThanOrEqual(1);
      expect(half.pixels[(8 * 32 + 31) * 4]).toBe(255);
    }
    expect((await renderFramePNG(project, 4)).equals(initial)).toBe(true);
    expect((await renderFramePNG(project, 5)).equals(initial)).toBe(false);
    expect(createRenderSession(project).durationFrames).toBe(8);
  },
);
