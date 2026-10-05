import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { importPSD, StoryboardProject, renderFramePNG } from "codeboard-studio";
import { make, save } from "../../shared.ts";
import { sheet, report } from "../../shared/artifacts.ts";

export async function render(output: string): Promise<void> {
  const options = { namespace: "psd", sourceColorSpace: "srgb", lossPolicy: "report" } as const;
  const input = await readFile(new URL("../../fixtures/psd/layered-rle.psd", import.meta.url));
  const imported = importPSD(input, options);
  const zipped = importPSD(
    await readFile(new URL("../../fixtures/psd/layered-zip.psd", import.meta.url)),
    options,
  );
  assert.deepEqual(zipped.layers, imported.layers);
  assert.throws(() => importPSD(input, { ...options, lossPolicy: "reject" }), {
    code: "INVALID_ARGUMENT",
  });
  const project = make("Editable PSD pixel layers", 320, 320);
  const panel = project
    .addScene("Imported artwork")
    .addShot("Pixel correction")
    .addPanel({ durationFrames: 1 });
  const document = project.toJSON();
  document.panels[0]!.layers = imported.layers;
  for (const layer of document.panels[0]!.layers)
    layer.transform = { x: 40, y: 40, scaleX: 60, scaleY: 60, rotation: 0 };
  const staged = StoryboardProject.fromJSON(document);
  const file = join(output, "psd-import.cboard");
  await staged.save(file);
  const before = await renderFramePNG(staged, 0);
  const reopened = await StoryboardProject.open(file);
  assert.deepEqual(await renderFramePNG(reopened, 0), before);
  const plan = reopened.plan("Correct one imported pixel", [
    {
      op: "pixels.patch",
      panelId: panel.id,
      layerId: "psd:layer:source:10",
      id: "psd:pixels:source:10",
      region: { x: 0, y: 0, width: 1, height: 1 },
      pixelsBase64: Buffer.from([0, 0, 255, 255]).toString("base64"),
    },
  ]);
  const receipt = await reopened.commit(plan, { requestId: "study:psd-pixel" });
  const edited = await StoryboardProject.open(file);
  assert.deepEqual(await edited.commit(plan, { requestId: "study:psd-pixel" }), {
    ...receipt,
    replayed: true,
  });
  const after = await renderFramePNG(edited, 0);
  assert.notDeepEqual(after, before);
  const rejected = [];
  for (const name of ["unsupported-effect", "clipping"]) {
    const bytes = await readFile(new URL(`../../fixtures/psd/${name}.psd`, import.meta.url));
    try {
      importPSD(bytes, options);
      throw new Error(`Unexpectedly imported ${name}`);
    } catch (error) {
      assert.ok(error instanceof Error && "code" in error && error.code === "INVALID_ARGUMENT");
      rejected.push({ input: name, message: error.message });
    }
  }
  await save(
    output,
    "psd-import",
    edited,
    await sheet(
      "PSD pixel import",
      [
        { label: "Imported layers + group opacity", png: before },
        { label: "Saved edit to one pixel", png: after },
      ],
      2,
    ),
  );
  await report(output, "psd-import", {
    sourceSha256: imported.sourceSha256,
    sourceSize: { width: imported.width, height: imported.height },
    staging: { scale: 60, x: 40, y: 40 },
    losses: imported.losses,
    receipt,
    rejected,
    limits:
      "Untagged RGB8 pixel-layer subset; no clipping/mask/effect import or PSD export. The supplied merged preview is ignored.",
  });
}
