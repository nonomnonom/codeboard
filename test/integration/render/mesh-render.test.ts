import { expect, it, vi } from "vitest";
import { Canvas } from "skia-canvas";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  StoryboardProject,
  createPixels,
  pathCommands,
  createShotRenderSession,
  renderShotFramePNG,
  shotPointCoordinates,
} from "../../../src/index.js";
import { renderIndexedMeshWarp, renderTriangleWarp } from "../../../src/render/triangle-warp.js";

const vertices = [
  { x: 0, y: 0 },
  { x: 32, y: 0 },
  { x: 32, y: 32 },
  { x: 0, y: 32 },
];
const faces: [number, number, number][] = [
  [0, 1, 2],
  [0, 2, 3],
];
const bounds = { x: 0, y: 0, width: 32, height: 32 };
const pixels = (canvas: Canvas) =>
  canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
function texture() {
  const canvas = new Canvas(32, 32),
    context = canvas.getContext("2d");
  context.fillStyle = "rgba(200,80,20,0.5)";
  context.fillRect(0, 0, 32, 32);
  return canvas;
}

it("preserves translucent alpha across shared mesh edges, either winding and face order", () => {
  const source = texture();
  for (const triangles of [
    faces,
    [...faces].reverse(),
    faces.map(([a, b, c]): [number, number, number] => [c, b, a]),
  ]) {
    const output = renderIndexedMeshWarp(
      source,
      { source: vertices, destination: vertices, triangles },
      bounds,
    );
    const data = pixels(output);
    for (let index = 3; index < data.length; index += 4) expect(data[index]).toBe(128);
  }
  const warped = renderIndexedMeshWarp(
    source,
    {
      source: vertices,
      destination: [
        { x: 2, y: 2 },
        { x: 30, y: 5 },
        { x: 27, y: 29 },
        { x: 5, y: 26 },
      ],
      triangles: faces,
    },
    bounds,
  );
  const data = pixels(warped);
  for (let y = 8; y < 23; y++)
    for (let x = 8; x < 23; x++) expect(data[(y * 32 + x) * 4 + 3]).toBe(128);
});

it("preserves identity texture samples and translated bounds without blurring the image", () => {
  const source = new Canvas(32, 32),
    context = source.getContext("2d");
  const image = context.createImageData(32, 32);
  for (let i = 0; i < 32 * 32; i++)
    image.data.set([i % 256, (i * 7) % 256, (i * 31) % 256, 255], i * 4);
  context.putImageData(image, 0, 0);
  const output = renderIndexedMeshWarp(
    source,
    {
      source: vertices,
      destination: vertices.map(({ x, y }) => ({ x: x + 15, y: y - 7 })),
      triangles: faces,
    },
    { ...bounds, x: 15, y: -7 },
  );
  expect(pixels(output)).toEqual(pixels(source));
});

it("retains source-over compositing for genuinely overlapping faces", () => {
  const source = new Canvas(64, 32),
    context = source.getContext("2d");
  context.fillStyle = "rgba(255,0,0,0.5)";
  context.fillRect(0, 0, 32, 32);
  context.fillStyle = "rgba(0,0,255,0.5)";
  context.fillRect(32, 0, 32, 32);
  const destination = [
    { x: 0, y: 0 },
    { x: 32, y: 0 },
    { x: 0, y: 32 },
  ] as const;
  const output = renderTriangleWarp(
    source,
    [
      { source: destination, destination },
      {
        source: [
          { x: 32, y: 0 },
          { x: 64, y: 0 },
          { x: 32, y: 32 },
        ],
        destination,
      },
    ],
    bounds,
  );
  const actual = pixels(output).slice((4 * 32 + 4) * 4, (4 * 32 + 4) * 4 + 4);
  expect([...actual]).toEqual([85, 0, 170, 192]);
});

it("rejects excessive coverage work before reading texture pixels", () => {
  const source = texture();
  const read = vi.spyOn(source.getContext("2d"), "getImageData");
  const triangle = {
    source: [
      { x: 0, y: 0 },
      { x: 32, y: 0 },
      { x: 0, y: 32 },
    ] as const,
    destination: [
      { x: 0, y: 0 },
      { x: 256, y: 0 },
      { x: 0, y: 256 },
    ] as const,
  };
  expect(() =>
    renderTriangleWarp(source, Array(4096).fill(triangle), { x: 0, y: 0, width: 256, height: 256 }),
  ).toThrow(
    expect.objectContaining({
      code: "RESOURCE_LIMIT",
      details: expect.objectContaining({ reason: "MESH_RASTER_WORK" }),
    }),
  );
  expect(read).not.toHaveBeenCalled();
  read.mockRestore();
});

it("keeps masked shot textures stable through a saved mesh edit, reopen and backward seeking", async () => {
  const directory = await mkdtemp(join(tmpdir(), "codeboard-mesh-render-"));
  try {
    const project = StoryboardProject.create({
      title: "Masked warp",
      width: 64,
      height: 64,
      background: "transparent",
    });
    const panel = project.addScene("S").addShot("S").addPanel({ durationFrames: 24 });
    const group = panel.addGroup("Warp", { transform: { x: 8, y: 8 } });
    const mask = panel.addVectorLayer("Half mask", { visible: false }, group.id);
    mask.path(pathCommands("M 0 0 L 16 0 L 16 32 L 0 32 Z"), { fill: "white" });
    const art = panel.addRasterLayer("Texture", { maskLayerId: mask.id }, group.id);
    const image = createPixels(32, 32);
    for (let i = 0; i < 32 * 32; i++) image.pixels.set([200, 80, 20, 128], i * 4);
    art.rasterSurface(image);
    const capture = project.capturePanelAnimation(panel.id, { id: "animation:mesh" });
    const mapped = (id: string) =>
      capture.identities.find((entry) => entry.sourceId === id)!.capturedId;
    const before = await renderShotFramePNG(project.shotAnimation(capture.animationId), 0);
    const file = join(directory, "mesh.cboard");
    await project.save(file);
    const plan = project.plan("Deform masked texture", [
      {
        op: "animation.edit",
        id: capture.animationId,
        edits: [
          {
            op: "layer.mesh",
            layerId: mapped(group.id),
            mesh: {
              source: vertices,
              triangles: faces,
              keyframes: [
                { frame: 0, vertices, easing: "linear" },
                {
                  frame: 23,
                  vertices: vertices.map(({ x, y }) => ({ x: x + y / 4, y })),
                  easing: "linear",
                },
              ],
            },
          },
        ],
      },
    ]);
    await project.commit(plan, { requestId: "mesh:bind" });
    const reopened = await StoryboardProject.open(file);
    expect((await reopened.commit(plan, { requestId: "mesh:bind" })).replayed).toBe(true);
    const animation = reopened.shotAnimation(capture.animationId);
    const session = createShotRenderSession(animation);
    expect(await session.png(0)).toEqual(before);
    for (const frame of [23, 3, 12, 0, 3])
      expect(await session.png(frame)).toEqual(await renderShotFramePNG(animation, frame));
    expect(await session.png(23)).not.toEqual(before);
    const forward = shotPointCoordinates(
      animation,
      mapped(art.id),
      { x: 8, y: 12 },
      { direction: "localToFrame", frame: 23, camera: false },
    );
    expect(forward.candidates).toHaveLength(1);
    expect(forward.candidates[0]!.point.x).toBeCloseTo(19);
    expect(forward.candidates[0]!.point.y).toBeCloseTo(20);
    const inverse = shotPointCoordinates(animation, mapped(art.id), forward.candidates[0]!.point, {
      direction: "frameToLocal",
      frame: 23,
      camera: false,
    });
    expect(inverse.candidates[0]!.point.x).toBeCloseTo(8);
    expect(inverse.candidates[0]!.point.y).toBeCloseTo(12);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
