import { describe, expect, it } from "vitest";
import { createRenderSession } from "../../../src/index.js";
import { pixels, redBounds, scene, setup } from "./helpers.js";

describe("retained 3D rendering", () => {
  it.each(["box", "sphere", "cylinder", "cone", "plane", "torus"] as const)(
    "renders the %s primitive as actual colored geometry",
    (kind) => {
      const spec = scene();
      const node = spec.nodes[0]!;
      if (node.kind !== "mesh") throw new Error("Missing mesh");
      node.geometry = kind;
      node.keyframes = [];
      const result = redBounds(pixels(createRenderSession(setup(spec).project).frame(0)));
      expect(result.count).toBeGreaterThan(100);
      expect(result.center).toBeCloseTo(64, 0);
    },
  );

  it("lights retained Lambert material and inherits parent visibility", () => {
    const spec = scene();
    const node = spec.nodes[0]!;
    if (node.kind !== "mesh") throw new Error("Missing mesh");
    node.keyframes = [];
    node.material = { kind: "lambert", color: "#ffffff" };
    node.parentId = "group";
    spec.nodes.push({ kind: "group", id: "group" });
    spec.lights = [{ kind: "ambient", color: "#ffffff", intensity: 0.5 }];
    const data = pixels(createRenderSession(setup(spec).project).frame(0));
    expect(data[(64 * 128 + 64) * 4]).toBeGreaterThan(150);
    expect(data[(64 * 128 + 64) * 4]).toBeLessThan(220);
    spec.nodes[1]!.visible = false;
    expect(
      pixels(createRenderSession(setup(spec).project).frame(0)).every((value) => value === 255),
    ).toBe(true);
  });

  it("reports a camera-target collision introduced by interpolated keys", () => {
    const spec = scene();
    spec.camera.keyframes = [
      { frame: 0, position: [0, 0, 5], easing: "linear" },
      { frame: 10, position: [0, 0, -5], easing: "linear" },
    ];
    expect(() => createRenderSession(setup(spec).project).frame(5)).toThrow(
      /camera position equals its target/,
    );
  });

  it("samples independent frames and interpolates translation in the normal render session", () => {
    const { project } = setup();
    const render = createRenderSession(project);
    expect(redBounds(pixels(render.frame(10))).center).toBeCloseTo(96, 0);
    expect(redBounds(pixels(render.frame(0))).center).toBeCloseTo(32, 0);
    expect(redBounds(pixels(render.frame(5))).center).toBeCloseTo(64, 0);
    expect(redBounds(pixels(render.frame(0))).center).toBeCloseTo(32, 0);
  });

  it("inherits animated group rotation and scale without changing the source scene", () => {
    const spec = scene();
    spec.nodes[0]!.keyframes = [];
    spec.nodes[0]!.position = [1, 0, 0];
    spec.nodes[0]!.parentId = "pivot";
    spec.nodes.push({
      id: "pivot",
      kind: "group",
      keyframes: [
        { frame: 0, rotation: [0, 0, 0], scale: [1, 1, 1], easing: "linear" },
        { frame: 10, rotation: [0, 0, Math.PI], scale: [0.5, 0.5, 0.5], easing: "linear" },
      ],
    });
    const { project } = setup(spec);
    const before = project.toJSON();
    const render = createRenderSession(project);
    const start = redBounds(pixels(render.frame(0)));
    const end = redBounds(pixels(render.frame(10)));
    expect(start.center).toBeCloseTo(96, 0);
    expect(end.center).toBeCloseTo(48, 0);
    expect(end.count).toBeLessThan(start.count * 0.3);
    expect(project.toJSON()).toEqual(before);
  });

  it("animates a perspective camera and composites a 2D overlay above its transparent viewport", () => {
    const spec = scene();
    spec.nodes[0]!.keyframes = [];
    spec.camera = {
      kind: "perspective",
      fov: 45,
      position: [0, 0, 5],
      target: [0, 0, 0],
      keyframes: [
        { frame: 0, position: [0, 0, 5], easing: "linear" },
        { frame: 10, position: [0, 0, 10], easing: "linear" },
      ],
    };
    const { project, panel } = setup(spec);
    const render = createRenderSession(project);
    const near = pixels(render.frame(0));
    const far = pixels(render.frame(10));
    expect(redBounds(far).count).toBeLessThan(redBounds(near).count * 0.3);
    expect(Array.from(near.slice(0, 4))).toEqual([255, 255, 255, 255]);
    panel
      .addVectorLayer("Overlay")
      .path(
        [
          { op: "M", x: 58, y: 58 },
          { op: "L", x: 70, y: 58 },
          { op: "L", x: 70, y: 70 },
          { op: "L", x: 58, y: 70 },
          { op: "Z" },
        ],
        { fill: "#0000ff" },
      );
    const combined = pixels(createRenderSession(project).frame(0));
    expect(Array.from(combined.slice((64 * 128 + 64) * 4, (64 * 128 + 64) * 4 + 4))).toEqual([
      0, 0, 255, 255,
    ]);
  });

  it("honors hold easing until the next key", () => {
    const spec = scene();
    spec.nodes[0]!.keyframes![0]!.easing = "hold";
    const render = createRenderSession(setup(spec).project);
    expect(redBounds(pixels(render.frame(9))).center).toBeCloseTo(32, 0);
    expect(redBounds(pixels(render.frame(10))).center).toBeCloseTo(96, 0);
  });
});
