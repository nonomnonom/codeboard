import { readFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { deflateSync } from "node:zlib";
import {
  importPSD,
  StoryboardProject,
  decodePixels,
  renderPanelPNG,
  ProjectStore,
} from "../src/index.js";
import { decodePSDChannels } from "../src/interchange/psd/channels.js";

const options = { namespace: "fixture", sourceColorSpace: "srgb", lossPolicy: "report" } as const;
const input = (name: string) => readFile(`examples/studies/src/fixtures/psd/${name}.psd`);

it("imports independent RLE and ZIP PSD fixtures into editable isolated groups and persists pixel edits", async () => {
  const rleBytes = await input("layered-rle"),
    copy = Buffer.from(rleBytes);
  const rle = importPSD(rleBytes, options),
    zip = importPSD(await input("layered-zip"), options);
  expect(rle.layers).toEqual(zip.layers);
  expect(rleBytes).toEqual(copy);
  expect(rle.losses.map((loss) => loss.path)).toEqual(["/resources/1026", "/resources/1072"]);
  expect(() => importPSD(rleBytes, { ...options, lossPolicy: "reject" })).toThrow(
    expect.objectContaining({
      code: "INVALID_ARGUMENT",
      details: expect.objectContaining({ reason: "PSD_IMPORT_LOSS" }),
    }),
  );
  const project = StoryboardProject.create({ title: "PSD", width: rle.width, height: rle.height });
  const panel = project.addScene("Scene").addShot("Shot").addPanel({ durationFrames: 2 });
  const document = project.toJSON();
  document.panels[0]!.layers = rle.layers;
  const imported = StoryboardProject.fromJSON(document);
  const pixels = await decodePixels(
    await renderPanelPNG(imported, panel.id, { annotations: false }),
  );
  const at = (1 * 4 + 1) * 4;
  expect([...pixels.pixels.slice(at, at + 4)]).toEqual([255, 127, 127, 255]);
  expect([...pixels.pixels.slice(0, 4)]).toEqual([255, 255, 255, 255]);
  const group = rle.layers[1]!;
  if (group.kind !== "group") throw new Error("Expected isolated group");
  expect(group.name).toBe("Paint é");
  expect(group.opacity).toBe(128 / 255);
  const paint = group.children[0]!;
  if (paint.kind === "group") throw new Error("Expected paint layer");
  const element = paint.elements[0]!;
  expect(element.kind).toBe("raster-surface");
  await mkdir(resolve(".preview"), { recursive: true });
  const directory = await mkdtemp(resolve(".preview/psd-import-"));
  try {
    const file = join(directory, "import.cboard");
    await imported.save(file);
    const before = await renderPanelPNG(imported, panel.id, { annotations: false });
    const reopened = await StoryboardProject.open(file);
    expect(await renderPanelPNG(reopened, panel.id, { annotations: false })).toEqual(before);
    const plan = reopened.plan("Paint imported PSD", [
      {
        op: "pixels.patch",
        panelId: panel.id,
        layerId: paint.id,
        id: element.id,
        region: { x: 0, y: 0, width: 1, height: 1 },
        pixelsBase64: Buffer.from([0, 0, 255, 255]).toString("base64"),
      },
    ]);
    const receipt = await reopened.commit(plan, { requestId: "psd-paint" });
    const edited = await StoryboardProject.open(file);
    expect(await edited.commit(plan, { requestId: "psd-paint" })).toEqual({
      ...receipt,
      replayed: true,
    });
    expect(await renderPanelPNG(edited, panel.id, { annotations: false })).not.toEqual(before);
    expect(edited.toJSON().panels[0]!.layers[1]).toMatchObject({
      name: "Paint é",
      opacity: 128 / 255,
    });
    using store = ProjectStore.open(file);
    store.verify();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("rejects unsupported visual features even when metadata omission is permitted", async () => {
  for (const name of ["unsupported-effect", "clipping"]) {
    const bytes = await input(name);
    expect(() => importPSD(bytes, options)).toThrow(
      expect.objectContaining({
        code: "INVALID_ARGUMENT",
        details: expect.objectContaining({ reason: "PSD_UNSUPPORTED_FEATURE" }),
      }),
    );
  }
});

it("rejects oversized, truncated, tagged and unsupported-depth sources before pixel decode", async () => {
  const bytes = await input("layered-rle");
  for (const length of [0, 25, 100])
    expect(() => importPSD(bytes.subarray(0, length), options)).toThrow();
  const depth = Buffer.from(bytes);
  depth.writeUInt16BE(16, 22);
  expect(() => importPSD(depth, options)).toThrow(
    expect.objectContaining({ code: "INVALID_ARGUMENT" }),
  );
  const huge = Buffer.from(bytes);
  huge.writeUInt32BE(0xffffffff, 18);
  expect(() => importPSD(huge, options)).toThrow(
    expect.objectContaining({ code: "RESOURCE_LIMIT" }),
  );
  const tagged = Buffer.from(bytes);
  tagged.writeUInt16BE(1039, 38);
  expect(() => importPSD(tagged, options)).toThrow(
    expect.objectContaining({
      details: expect.objectContaining({
        path: "/resources/1039",
        reason: "PSD_UNSUPPORTED_FEATURE",
      }),
    }),
  );
  expect(() => importPSD(bytes, { ...options, sourceColorSpace: "p3" } as never)).toThrow();
});

it("bounds channel inflation and rejects RLE truncation or overrun", () => {
  const channel = (compression: number, bytes: Buffer) => {
    const header = Buffer.alloc(2);
    header.writeUInt16BE(compression);
    return [{ id: 0, data: Buffer.concat([header, bytes]) }];
  };
  expect(() =>
    decodePSDChannels(channel(2, deflateSync(Buffer.alloc(1_000_000))), 1, 1, "/bomb"),
  ).toThrow(/oversized ZIP/);
  expect(() => decodePSDChannels(channel(1, Buffer.from([0, 2, 253, 40])), 1, 1, "/rle")).toThrow(
    /exceeds row/,
  );
  expect(() => decodePSDChannels(channel(1, Buffer.from([0, 2, 1, 40])), 2, 1, "/rle")).toThrow(
    /Truncated/,
  );
  expect([
    ...decodePSDChannels(
      channel(3, deflateSync(Buffer.from([10, 10, 10, 30, 10, 10]))),
      3,
      2,
      "/prediction",
    ),
  ]).toEqual([
    10, 0, 0, 255, 20, 0, 0, 255, 30, 0, 0, 255, 30, 0, 0, 255, 40, 0, 0, 255, 50, 0, 0, 255,
  ]);
});
