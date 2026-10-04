# Projects and revisions

Save editable work as a `.cboard` file. A project contains scenes, shots, panels, layers, artwork, brush definitions, animation, and referenced asset data. PNGs, PDFs, and movies are exports, not replacements for the project.

## Save and reopen

```js
await project.save('film.cboard');
const reopened = await StoryboardProject.open('film.cboard');
const panel = reopened.panel('notice');
panel.revise({ action: 'The keeper notices the broken light.' });
await reopened.save('film.cboard');
```

Keep IDs stable across sessions. Panel names, labels, and order can change without changing their identity. A save rejects a stale writer if another session changed the same file. Reopen the latest file and reapply the intended edit instead of forcing an overwrite.

`overwrite: true` deliberately replaces an existing project. Reserve it for generated outputs you own, such as the quickstart starter file. Do not use it for routine revisions.

## Separate source and outputs

A useful working folder is:

```text
my-film/
  scene.mjs
  revise.mjs
  assets/
  film.cboard
  renders/
```

The authoring script creates artwork; the project preserves its editable state; render files are disposable outputs. If you revise the saved project, reopen it in your next script rather than rerunning a generator that replaces it.

## Save a named revision

```js
import { ProjectStore } from 'codeboard-studio';
const store = ProjectStore.open('film.cboard');
try {
  store.saveRevision('before-camera-change', { expectedVersion: store.version });
  console.log(store.listRevisions({ limit: 10 }));
} finally { store.close(); }
```

Revision names must be unique. Revisions share unchanged artwork and assets with the project. They retain a state you can restore in another session; in-memory undo history is for the current authoring session.

```js
const store = ProjectStore.open('film.cboard');
try {
  store.restoreRevision('before-camera-change', { expectedVersion: store.version });
} finally { store.close(); }
```

After restoring, reopen the project before further editing. Restoration changes the saved head; keep a named revision of any newer work you still want.

## Read a single panel

```js
const store = ProjectStore.open('film.cboard');
try {
  console.log(store.findObjects({ panelId: 'notice', limit: 20 }));
  const panel = store.readPanel('notice');
  console.log(panel.title, panel.durationFrames);
} finally { store.close(); }
```

For a small artwork-only edit, use `updatePanel(panel, { expectedVersion })`. Use `StoryboardProject.open()` when adding or removing objects, changing timeline relationships, or retiming. Always close a store when finished.

## Reuse artwork

`production.captureComponent(layerId, name)` stores a reusable static group or layer. `instantiateComponent(componentId, panelId, transform)` places a copy into another panel. Local edits belong to that instance. Source updates require `reviseComponent`, followed by an explicit `refreshComponentInstance` where you want them applied. Refresh replaces that instance's local artwork, so preserve local changes first.

## Check a project file

```sh
codeboard validate film.cboard
```

Validation checks the container and its references. Keep backups of valuable work. If a file fails validation, retain the original for recovery instead of overwriting it with a new project.

## Assets and source files

`production.addAsset` registers an image or audio source; `updateAsset` revises its metadata or path. Linked paths resolve against `assetRoot` when saving. `project.readAsset(id)` reads embedded bytes from an opened project. With a store, `readAsset(id)` and `extractAssets(directory)` retrieve saved asset data.

Adding an image asset does not place it on a layer. Decode its pixels and create a raster surface when you want it in the composition. Brush tips are retained with their stroke definitions. Save/open does not depend on rerunning authoring code or fetching an AI model.

## Revisions and storage size

`saveRevision` stores a named state that shares unchanged payloads. `readRevision(name)` reads that state without changing the active head; `readPanel(id, { revision: name })` reads one panel from it. `restoreRevision` changes the saved head and requires an expected version.

Use `deleteRevision(name)` only when that checkpoint is no longer needed. `compact()` removes unreferenced stored data after revisions and artwork are discarded; it is a deliberate maintenance operation, not something to call after every small edit. Keep the project closed in other editing sessions while doing maintenance.

The `.cboard` container separates structured metadata, binary artwork payloads, and embedded assets. `store.inspect()` reports storage information. File size depends on the actual artwork, assets, and retained revisions; an MP4's size is not a useful estimate of the editable project's size.

## Version checks and undo boundaries

Most production edits accept `{ expectedVersion }`; use the version observed before a coordinated edit to reject stale assumptions. A project transaction groups synchronous changes into one undoable unit and rolls back if an operation throws. Do file reads and asynchronous renders outside its callback.

In-memory `undo()` and `redo()` do not substitute for named saved revisions across sessions. `toJSON()` materializes the document for interoperability and debugging; it is not the recommended persistence format or a bounded inspection call.
