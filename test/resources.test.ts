import sharp from "sharp";
import { zipSync } from "fflate";
import {
  importBrushResourceBuffer,
  brushFromResource,
  brushes,
  StoryboardProject,
  catmullRom,
  renderPanelPNG,
} from "../src/index.js";
const origin = {
  source: "authored test fixture",
  license: "CC0-1.0",
  redistribution: "allowed" as const,
};
it("distinguishes equal sample bytes with different geometry and different imported resolution", async () => {
  const wide = gbr(),
    tall = Buffer.from(wide);
  tall.writeUInt32BE(2, 8);
  tall.writeUInt32BE(3, 12);
  const bundle = zipSync({
    "brushes/wide.gbr": wide,
    "brushes/tall.gbr": tall,
    "brushes/duplicate.gbr": wide,
  });
  const report = await importBrushResourceBuffer(Buffer.from(bundle), "geometry.bundle", {
    origin,
  });
  expect(report.resources).toHaveLength(2);
  expect(new Set(report.resources.map((r) => r.id)).size).toBe(2);
  expect(report.resources.map((r) => [r.tip.width, r.tip.height]).sort()).toEqual([
    [2, 3],
    [3, 2],
  ]);
  expect(new Set(report.resources.map((r) => r.checksum)).size).toBe(2);
  const full = await importBrushResourceBuffer(wide, "wide.gbr", { origin, maxTipSize: 3 });
  const small = await importBrushResourceBuffer(wide, "wide.gbr", { origin, maxTipSize: 1 });
  expect(full.resources[0]!.checksum).toBe(small.resources[0]!.checksum);
  expect(full.resources[0]!.id).not.toBe(small.resources[0]!.id);
  const repeated = await importBrushResourceBuffer(wide, "wide.gbr", { origin, maxTipSize: 3 });
  expect(repeated.resources[0]!.id).toBe(full.resources[0]!.id);
});
function u32(n: number) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  return b;
}
function u16(n: number) {
  const b = Buffer.alloc(2);
  b.writeUInt16BE(n);
  return b;
}
function gbr() {
  return Buffer.concat([
    u32(32),
    u32(2),
    u32(3),
    u32(2),
    u32(1),
    Buffer.from("GIMP"),
    u32(25),
    Buffer.from("tip\0"),
    Buffer.from([0, 90, 0, 255, 128, 0]),
  ]);
}
function abr() {
  return Buffer.concat([
    u16(1),
    u16(1),
    u16(2),
    u32(40),
    Buffer.alloc(4),
    u16(20),
    Buffer.alloc(9),
    u32(0),
    u32(0),
    u32(2),
    u32(3),
    u16(8),
    Buffer.from([0, 0, 90, 0, 255, 128, 0]),
  ]);
}
function crc(data: Buffer) {
  let n = 0xffffffff;
  for (const v of data) {
    n ^= v;
    for (let i = 0; i < 8; i++) n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0);
  }
  return (n ^ 0xffffffff) >>> 0;
}
async function kpp(
  metadata = `<Preset name="Test reed" paintopid="paintbrush"><param name="brush_definition"><![CDATA[<Brush type="gbr_brush" filename="tip.gbr" spacing="0.3"/>]]></param><param name="OpacityValue">0.7</param><param name="UntranslatedSensor">curve</param></Preset>`,
) {
  const png = await sharp({ create: { width: 3, height: 3, channels: 4, background: "red" } })
    .png()
    .toBuffer();
  const data = Buffer.from(`preset\0${metadata}`),
    body = Buffer.concat([Buffer.from("tEXt"), data]);
  return Buffer.concat([
    png.subarray(0, -12),
    u32(data.length),
    body,
    u32(crc(body)),
    png.subarray(-12),
  ]);
}
describe("external brush resources", () => {
  it("prefers an exact dependency path and keeps basename-only collisions unresolved", async () => {
    const alternate = gbr();
    alternate[alternate.length - 1] = 255;
    const dependencies = { "brushes/tip.gbr": gbr(), "other/tip.gbr": alternate };
    const preset = await kpp(
      '<Preset name="Exact" paintopid="paintbrush"><param name="brush_definition"><![CDATA[<Brush filename="brushes/tip.gbr"/>]]></param></Preset>',
    );
    const exact = await importBrushResourceBuffer(preset, "exact.kpp", { origin, dependencies });
    expect(exact.missingDependencies).toEqual([]);
    expect(exact.resources).toHaveLength(1);
    expect(exact.resources[0]!.tip.alpha).toEqual([0, 90 / 255, 0, 1, 128 / 255, 0]);
    const ambiguous = await importBrushResourceBuffer(await kpp(), "ambiguous.kpp", {
      origin,
      dependencies,
    });
    expect(ambiguous.resources).toHaveLength(0);
    expect(ambiguous.missingDependencies).toEqual(["tip.gbr (ambiguous)"]);
    expect(ambiguous.presets[0]!.unsupported.join()).toContain(
      "No explicit bitmap tip reference resolved",
    );
  });
  it("reports rejected numeric mappings without coercing blank opacity into zero", async () => {
    const preset = await kpp(
      '<Preset name="Invalid settings" paintopid="paintbrush"><param name="brush_definition"><![CDATA[<Brush filename="tip.gbr" spacing="12"/>]]></param><param name="OpacityValue"> </param><param name="FlowValue">2</param></Preset>',
    );
    const report = await importBrushResourceBuffer(preset, "invalid-settings.kpp", {
      origin,
      dependencies: { "tip.gbr": gbr() },
    });
    expect(report.resources).toHaveLength(1);
    expect(report.presets[0]!.mapped).toEqual({});
    for (const parameter of ["spacing", "OpacityValue", "FlowValue"])
      expect(report.presets[0]!.unsupported.join()).toContain(parameter);
    expect(report.mapped.some((mapping) => mapping.startsWith("invalid-settings.kpp:"))).toBe(
      false,
    );
  });
  it("reads actual GBR alpha and separates GIH cells from selection behavior", async () => {
    const report = await importBrushResourceBuffer(gbr(), "tip.gbr", { origin });
    expect(report.resources[0]!.tip.alpha).toEqual([0, 90 / 255, 0, 1, 128 / 255, 0]);
    const pipe = await importBrushResourceBuffer(
      Buffer.concat([Buffer.from("pipe\n2 ncells:2 dim:1 rank0:2 sel0:random\n"), gbr(), gbr()]),
      "pipe.gih",
      { origin },
    );
    expect(pipe.unsupported.join()).toContain("selection dynamics");
    expect(pipe.resources).toHaveLength(1);
  });
  it("extracts ABR sampled bytes without inventing Photoshop behavior", async () => {
    const report = await importBrushResourceBuffer(abr(), "sample.abr", { origin });
    expect(report.resources[0]!.tip.alpha).toEqual([0, 90 / 255, 0, 1, 128 / 255, 0]);
    expect(report.unsupported.join()).toContain("Photoshop");
  });
  it("never substitutes a KPP preview for a missing tip", async () => {
    const report = await importBrushResourceBuffer(await kpp(), "reed.kpp", { origin });
    expect(report.resources).toHaveLength(0);
    expect(report.missingDependencies).toEqual(["tip.gbr"]);
    expect(report.presets[0]!.mapped).toEqual({ spacing: 0.3, opacity: 0.7 });
  });
  it("resolves bundle dependencies and reports unmapped sensors", async () => {
    const bundle = zipSync({ "paintoppresets/reed.kpp": await kpp(), "brushes/tip.gbr": gbr() });
    const report = await importBrushResourceBuffer(Buffer.from(bundle), "reed.bundle", { origin });
    expect(report.missingDependencies).toEqual([]);
    expect(report.presets[0]!.resourceIds).toHaveLength(1);
    expect(report.unsupported.join()).toContain("UntranslatedSensor");
  });
  it("rejects truncated files and unsafe archive paths", async () => {
    await expect(
      importBrushResourceBuffer(gbr().subarray(0, 31), "bad.gbr", { origin }),
    ).rejects.toThrow(/Truncated/);
    await expect(
      importBrushResourceBuffer(
        Buffer.from(zipSync({ "../bad": Buffer.from("x") })),
        "bad.bundle",
        { origin },
      ),
    ).rejects.toThrow(/Unsafe/);
  });
  it("renders imported bitmap tips with changed pressure and curvature", async () => {
    const report = await importBrushResourceBuffer(gbr(), "tip.gbr", { origin });
    const brush = brushFromResource(report.resources[0]!, {
      ...brushes.cleanInk,
      id: "test-tip",
      size: 42,
      spacing: 0.4,
    });
    const project = StoryboardProject.create({ title: "Swatch", width: 240, height: 135 });
    const panel = project.addScene("Test").addShot("Curve").addPanel();
    const l = panel.addRasterLayer("Imported");
    const id = l.rasterStroke(
      catmullRom([
        { x: 20, y: 100, pressure: 0.2 },
        { x: 70, y: 30, pressure: 1 },
        { x: 140, y: 105, pressure: 0.5 },
        { x: 220, y: 25, pressure: 1 },
      ]),
      brush,
    );
    const first = await renderPanelPNG(project, panel.id);
    l.edit(id, (e) =>
      e.kind === "raster-stroke"
        ? { ...e, points: e.points.map((p) => ({ ...p, pressure: 0.1 })) }
        : e,
    );
    const second = await renderPanelPNG(project, panel.id);
    expect(first.equals(second)).toBe(false);
    const reopened = StoryboardProject.fromJSON(project.toJSON());
    expect((await renderPanelPNG(reopened, panel.id)).equals(second)).toBe(true);
  });
});
