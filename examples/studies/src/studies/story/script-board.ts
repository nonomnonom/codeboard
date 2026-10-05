import assert from "node:assert/strict";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import {
  planScriptBoard,
  planCaptionImport,
  parseCaptionCSV,
  renderFramePNG,
  exportScriptCSV,
  importScriptCSV,
  inspectScriptFDX,
  importScriptFDX,
} from "codeboard-studio";
import { make, text, save } from "../../shared.ts";
import { report, comparison } from "../../shared/artifacts.ts";

export async function generate(output: string): Promise<void> {
  const project = make("Script staging and caption import");
  const shot = project.addScene("Study").addShot("Explicit board staging");
  const fdx = `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script" Template="No" Version="3"><Content>
<Paragraph Type="Action"><Text>A opens the door.</Text></Paragraph>
<Paragraph Type="Character"><Text>B</Text></Paragraph>
<Paragraph Type="Dialogue"><Text>Come in.</Text></Paragraph>
</Content></FinalDraft>`;
  const inspected = inspectScriptFDX(fdx);
  const importedScript = importScriptFDX(fdx, {
    id: "script:study",
    title: "A short exchange",
    sourceSha256: inspected.sourceSha256,
    bindings: [
      { paragraph: 0, id: "line:action", panelIds: [] },
      { paragraph: 2, id: "line:dialogue", panelIds: [] },
    ],
  });
  await writeFile(join(output, "script.fdx"), fdx);
  project.replaceScript(importedScript.script, 0);
  await project.save(join(output, "script-board.cboard"));
  const staged = planScriptBoard(project, [
    {
      panelId: "panel:action",
      shotId: shot.id,
      entryIds: ["line:action"],
      title: "Action",
      durationFrames: 24,
    },
    {
      panelId: "panel:dialogue",
      shotId: shot.id,
      entryIds: ["line:dialogue"],
      title: "Dialogue",
      durationFrames: 36,
    },
  ]);
  await project.commit(staged.plan, { requestId: "stage-script" });
  const linkedScript = project.studio.script;
  if (!linkedScript) throw new Error("Staged study requires its script");
  const csv = exportScriptCSV(linkedScript);
  await writeFile(join(output, "script.csv"), csv);
  const csvRoundTrip = project.replaceScript(
    importScriptCSV(csv, { id: linkedScript.id, title: linkedScript.title }),
    linkedScript.revision,
  );
  const before = project.panelCaptions("panel:dialogue");
  const imported = planCaptionImport(
    project,
    parseCaptionCSV('panelId,dialogue\npanel:dialogue,"B: Please come in."'),
  );
  assert.ok(imported.plan);
  await project.commit(imported.plan, { requestId: "revise-caption" });
  assert.equal(project.scriptEntries()[1]!.text, "Come in.");
  assert.equal(project.toJSON().panels[1]!.layers.length, 0);
  const diagram = make("Actual script and caption records");
  const cards = diagram.addScene("Inspection").addShot("Data after staging");
  const rows = [
    ["Original script", "Source dialogue", "B: Come in.", "The sentence in the script"],
    [
      "Caption copied to the panel",
      "Panel dialogue",
      before.dialogue,
      "Text only, no drawing generated",
    ],
    [
      "Caption after your edit",
      "Revised panel dialogue",
      project.panelCaptions("panel:dialogue").dialogue,
      "Script remains unchanged",
    ],
  ];
  const samples = [];
  for (const [title, id, dialogue, note] of rows) {
    const panel = cards.addPanel({ title: title!, durationFrames: 1 });
    const layer = panel.addVectorLayer("Actual record values");
    text(layer, id!, 22, 55, 18);
    text(layer, dialogue!, 22, 128, 23);
    text(layer, note!, 22, 220, 17);
    samples.push({ label: title!, png: await renderFramePNG(diagram, samples.length) });
  }
  await save(
    output,
    "script-board",
    project,
    await comparison(output, "Script text and panel captions", samples),
  );
  await report(output, "records", {
    script: project.scriptEntries(),
    captions: project.toJSON().panels.map((panel) => project.panelCaptions(panel.id)),
    changes: imported.changes,
    csvRoundTrip,
    fdx: { sourceSha256: importedScript.sourceSha256, losses: importedScript.losses },
  });
}
