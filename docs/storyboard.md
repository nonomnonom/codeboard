# Sequences, shots, and panels

A sequence contains scenes; a scene contains shots; a shot contains ordered panels. A panel is an artwork composition with a duration and production captions. A storyboard sheet is a separate page layout built from those panels.

## Build a shot from several beats

```ts
import { StoryboardProject } from 'codeboard-studio';
const project = StoryboardProject.create({
  title: 'One considered hop', width: 1920, height: 1080, frameRate: 24,
});
const sequence = project.addSequence('The obstacle', 'obstacle');
const scene = sequence.addScene('Street', 'street');
const shot = scene.addShot('Notice and decide', 'notice-shot');
const notice = shot.addPanel({
  id: 'notice', number: '01A', title: 'Notice', durationFrames: 48,
  action: 'Clawd stops at the line.', dialogue: '',
  camera: 'Locked medium wide.', notes: 'Let the gaze lead the body.',
});
const prepare = shot.addPanel({
  id: 'prepare', number: '01B', title: 'Prepare', durationFrames: 24,
  action: 'Weight lowers before the push.',
});
```

Panel captions describe the action; they do not generate artwork. Draw each panel through its layers, or use a drawing sequence within a panel for changing poses. Choose the number of panels according to the action you need to explain.

## Keep an independent production script

Script records hold scene headings, action and dialogue separately from board captions. IDs are supplied by the author/importer and stay stable across revisions. Link records to existing panel IDs; one record can span several panels and one panel can illustrate several records. Updating script text does not change captions, artwork, editorial timing or animation.

```ts
import type { ScriptInput } from 'codeboard-studio';

const script: ScriptInput = {
  id: 'script:main', title: 'The doorway',
  entries: [
    {id: 'script:scene-01', kind: 'scene', text: 'INT. ROOM', panelIds: [notice.id]},
    {id: 'script:line-01', kind: 'dialogue', speaker: 'Mira', text: 'Come in.', panelIds: [notice.id]},
  ],
};
const changes = project.replaceScript(script, 0); // zero means no previous script
console.log(changes.revision, changes.added, changes.updated);
console.log(project.scriptSummary());
console.log(project.scriptEntries({offset: 0, limit: 50}));
```

`replaceScript` replaces the complete entry list explicitly. Its required expected revision prevents stale script revisions; unchanged input creates neither a new script revision nor a project edit. Reports list added/removed IDs, changed fields, title changes and entry-order changes. Omitting an existing entry removes it. To unlink a panel, remove its ID from the relevant entries before deleting that panel, optionally in the same transaction. Missing panel links, duplicate IDs, an ID shared with artwork, and a speaker on a non-dialogue record reject atomically.

For durable agent edits, use the existing saved-project plan workflow with `{op: 'script.replace', script, expectedRevision: 1}` and persist/retry the same plan/request ID. Script state participates in save/open, undo/redo, named checkpoints, query discovery (`script` and `script-entry` kinds), and global ID validation. Reads are detached and paged. A script is limited to 1,000 entries and 1 MiB; entry text is limited to 65,536 characters. The current project supports one script. This is a typed script model, not a Final Draft parser or automatic story generator.

The optional data lives under the strict schema-4 studio payload. Existing files without a script remain compatible. Older runtimes that do not recognize `studio.script` reject these newer files; use a matching local build rather than expecting older releases to preserve the field.

### Stage new panels from script records

`planScriptBoard` creates panels from explicitly selected script records and appends the new panel IDs to those records in one atomic plan. Supply an existing shot ID, new panel ID, selected entry IDs and duration for every panel. The engine does not infer shot boundaries or timing from text.

```ts
import { planScriptBoard } from 'codeboard-studio';

const staging = planScriptBoard(project, [{
  panelId: 'board:doorway-reply', shotId: shot.id,
  entryIds: ['script:scene-01', 'script:line-01'], durationFrames: 48,
}]);
// Persist staging.plan before committing to a saved project.
await project.commit(staging.plan, {requestId: 'stage-doorway-v1'});
```

Scene text supplies the title unless `title` is specified; action records supply action captions; dialogue records supply speaker-prefixed dialogue. Multiple records join in the requested order. Panels append to their selected shots using the existing timeline reflow rules, so inserting into an earlier shot can shift later board material. Existing script links are retained. Existing panel IDs, duplicate requests, unknown entries/shots and invalid durations reject rather than guessing or overwriting. New panels have empty layers; draw their artwork separately. Subsequent script revisions do not silently regenerate these panels. After a timeout, retry the same persisted plan/request ID instead of planning another staging operation.

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

An omitted column preserves its existing field; an empty cell explicitly clears it. Unchanged rows are reported and generate no edits; if all rows are unchanged, `plan` is `null`. The field report is capped at 256 KiB; split large imports into smaller reviewed batches. `saved.panelCaptions(id)` reads caption fields without copying artwork. Caption plans reuse normal locks, stale-version checks, atomic commit and durable retry receipts. Persist and retry the same plan/request ID after a timeout; a new revision needs a new request ID. Neither planning nor committing captions rewrites layers, shot animation or timing. This importer targets board captions; use the separate script model above for independent screenplay records, including the Final Draft subset below.

## Notes and movement arrows

```ts
notice.revise({ notes: 'Keep all four feet readable.' });
notice.addMotion('Look toward the line',
  { x: 1000, y: 500 }, { x: 1250, y: 500 }, '#f48136');
```

Movement annotations describe intent; they are not motion keyframes. Render panels with annotations for review, or set `annotations: false` for clean artwork. Titles, action, dialogue, camera notes, and general notes supply the storyboard sheet captions.

## Order, duplicate, and remove panels

```ts
const alternative = project.production.duplicatePanel(prepare.id);
project.production.movePanel(alternative, prepare.id);
project.production.setPanelNumber(alternative, '01B-alt');
project.production.deletePanel(alternative);
```

`movePanel` reorders within the panel's existing shot; omitting the destination moves it to the end of that shot. It does not move a panel between shots. Duplication creates new object IDs and remaps contained relationships. Deletion removes that panel's artwork. Timeline structural edits reflow following material; inspect timing and audio afterward.

Panel numbers are display labels. Use IDs to address a panel across numbering changes. `setPanelStatus(id, 'working' | 'review' | 'approved')` records production status; approval status is not a substitute for review or an edit lock.

## Layout the sheets

```ts
import { exportStoryboard } from 'codeboard-studio';
await exportStoryboard(project, 'sheets', {
  columns: 2, rows: 2, pageWidth: 1191, pageHeight: 842,
  margin: 36, gutter: 18, captionHeight: 110,
});
```

Page sizes and spacing are layout units. The exporter lays out headers, captions, numbers and pagination independently of the 1920 × 1080 artwork. It samples each panel at 60% of its duration for the sheet image. Use explicit frame renders when another moment is needed for timing review.

See [animation](animation.md) for retiming and transitions, [review](review.md) for contact sheets, and [export](export.md) for delivery formats.

## Exchange script records as CSV

`exportScriptCSV(script)` exports a ScriptInput or saved ProductionScript, including stable
entry IDs and ordered panel links. `importScriptCSV(csv, {id, title})` returns detached
ScriptInput data for `replaceScript` or a durable `script.replace` plan:

```ts
const current = project.studio.script;
if (!current) throw new Error('Project has no script');
const csv = exportScriptCSV(current);
const incoming = importScriptCSV(csv, { id: current.id, title: current.title });
const plan = project.plan('Import revised script', [{
  op: 'script.replace', script: incoming, expectedRevision: current.revision,
}]);
```

The exact header is `id,kind,text,speaker,panelIds`. Kinds are scene/action/dialogue.
`panelIds` is a JSON array inside a CSV cell; an empty cell means no links. Empty speaker
means absent, and only dialogue may name a speaker. Commas, doubled quotes and multiline
quoted text are supported; CRLF, LF and CR record separators and an initial UTF-8 BOM are
accepted. Text is not trimmed. Unknown columns, malformed quoting, invalid field types,
duplicate IDs and invalid speakers reject. Existing caption CSV and script CSV share the
same lexical parser but have separate headers and domain validation.

CSV is limited to 2 MiB/1000 entries, with the resulting script still capped at 1 MiB.
Script ID/title are explicit import options; revision is deliberately outside the file and
must come from the inspected project. Panel links are preserved in exported records rather
than inferred from names or text. Missing/deleted panel links and global ID collisions reject
when applying to a project. Removing a CSV row removes that entry on full replacement; review
the existing field-level change report and preserve the original CSV before committing edits.
No panel artwork or timing is regenerated by import. CSV export retains text literally and
is a data interchange format, not a spreadsheet formula sanitizer or Final Draft adapter.
The script-board study exports linked records to `script.csv`, imports them and reports the
replacement result. This new adapter still needs runtime round-trip qualification.

## Import a Final Draft screenplay subset

`inspectScriptFDX(xml)` reads FDX version 3 Script documents and returns a source SHA-256,
supported paragraphs and loss records. `importScriptFDX(xml, options)` converts explicitly
bound records into detached ScriptInput data. Both operations are synchronous and perform no
filesystem/network access or project mutation.

```ts
import { inspectScriptFDX, importScriptFDX } from 'codeboard-studio';

const xml = await readFile('screenplay.fdx', 'utf8');
const inspected = inspectScriptFDX(xml);
console.log(inspected.paragraphs, inspected.losses);
// Prepare these bindings from the actual inspection, retaining existing IDs/links on revision.
// Here the source has Action, Character, Dialogue at direct Paragraph positions 0, 1, 2.
const imported = importScriptFDX(xml, {
  id: 'script:film', title: 'Film', sourceSha256: inspected.sourceSha256,
  bindings: [
    { paragraph: 0, id: 'entry:arrival', panelIds: [] },
    { paragraph: 2, id: 'entry:greeting', panelIds: [] },
  ],
});
const plan = project.plan('Import screenplay', [{
  op: 'script.replace', script: imported.script,
  expectedRevision: project.scriptSummary()?.revision ?? 0,
}]);
```

The supported mapping is Scene Heading → scene, Action → action and Dialogue → dialogue.
Character establishes the speaker for following dialogue paragraphs; it produces no separate
entry. Action, scene headings and other unsupported content boundaries clear that speaker.
Parenthetical paragraphs retain the current speaker but their text is omitted and reported.
Unconsumed character cues are also reported. Ordered Text runs concatenate without trimming;
formatting attributes are reported as losses, even when they look like defaults.

Transitions, parentheticals, custom paragraph types, dual-dialogue containers, nested text
markup, scene properties, title pages, headers, revision metadata, layout and other unknown
subtrees are not represented in the script model. The report identifies an omitted subtree
once, rather than enumerating all of its descendants. Comments and processing instructions
other than the XML declaration are also reported. Plain script import does not recreate Final
Draft pagination or styling. See Final Draft's [description of script elements](https://kb.finaldraft.com/hc/en-us/articles/27646947570196-What-are-script-elements).
The XML layout was checked against an [independent implementation's FDX sample](https://github.com/rsdoiel/fdx/blob/main/testdata/sample-01.fdx);
this is implementation evidence, not a vendor conformance specification.

Import rejects any losses by default. `lossPolicy: 'report'` explicitly permits every listed
omission and returns the loss report beside the script. Inspect the complete report before
using this policy. Preserve the original file; there is no FDX exporter or lossless round trip.
The source hash covers the exact UTF-8 encoding of the supplied string, including whitespace.
A mismatch rejects stale mappings. Every supported paragraph needs exactly one binding;
missing, duplicate or extra bindings reject. Paragraph indices count direct Paragraph nodes,
including unsupported paragraph types and Character cues. They are positions in that exact
source, never persistent IDs: a revised file must be inspected and its bindings reconciled.
The adapter never matches by text, speaker or position across revisions. Existing entry IDs
and panel links must be carried explicitly in the revised bindings.

Full replacement removes entries absent from the import. Review the existing field-level
replacement report and use saved-project plan/commit receipts for durable changes. Global ID
collisions and missing panel links still reject at the project boundary. Import creates no
artwork, panels, timing or audio; use `planScriptBoard` for explicit staging afterward.

Resource limits: 2 MiB source and inspection, 20,000 XML elements, parser nesting limit 32,
4,000 direct paragraphs, 1,000 resulting entries, 1,000 loss records and a 256 KiB loss report.
The resulting script must satisfy the shared 1 MiB/field/ID/link limits. DOCTYPE and entity
declarations reject; no external references are loaded. Malformed XML, unsupported document
version/type and templates reject regardless of loss policy. The script-board study now imports
an authored FDX sample before staging and emits the original file and import report. Runtime
qualification against real vendor exports, entity handling and revision workflows remains pending.
