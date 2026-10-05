# Revise panel captions from CSV

Apply feedback to captions using panel IDs. Preview the changes before committing them to the saved project.

<!-- study:script-board:start -->
**A script and a panel caption are separate.** Does editing a caption rewrite the script?

[![Read the dialogue in the source card, the staged caption and the revised caption. The source text stays unchanged.](../../website/public/art/guides/script-board.png)](../../website/public/art/guides/script-board.png)

Read the dialogue in the source card, the staged caption and the revised caption. The source text stays unchanged. Staging links script records to panels. A later caption edit changes the panel's text, not its original script record.

<!-- study:script-board:end -->

## Import caption revisions

Import CSV or typed rows against **panel IDs**, not display numbers. The first CSV column must be `panelId`; remaining columns can be `title`, `action`, `dialogue`, `camera`, or `notes`. Quoted commas, doubled quotes, multiline fields, CRLF and an initial UTF-8 BOM are supported. Duplicate IDs/columns, unknown columns, malformed rows and missing panels reject the import. Input is limited to 1 MiB and 1,000 rows.

```ts
import { readFile, writeFile } from 'node:fs/promises';
import { StoryboardProject, parseCaptionCSV, planCaptionImport } from 'codeboard-studio';

const saved = await StoryboardProject.open('work/film.cboard');
const rows = parseCaptionCSV(await readFile('captions.csv', 'utf8'));
const report = planCaptionImport(saved, rows);
console.log(report.changes); // panelId, field, before, after
if (report.plan) {
  await writeFile('caption-plan.json', JSON.stringify(report.plan, null, 2), {flag: 'wx'});
  const result = await saved.commit(report.plan, {requestId: 'caption-import-001'});
  console.log(result.receipt);
}
```

An omitted column preserves its existing field; an empty cell explicitly clears it. Unchanged rows are reported and generate no edits; if all rows are unchanged, `plan` is `null`. The field report is capped at 256 KiB; split large imports into smaller reviewed batches. `saved.panelCaptions(id)` reads caption fields without copying artwork. Caption plans reuse normal locks, stale-version checks, atomic commit and durable retry receipts. Persist and retry the same plan/request ID after a timeout; a new revision needs a new request ID. Neither planning nor committing captions rewrites layers, shot animation or timing. This importer targets board captions. Use the [script model](scripts.md) for independent screenplay records and [script interchange](script-import.md) for CSV or the supported Final Draft subset.
