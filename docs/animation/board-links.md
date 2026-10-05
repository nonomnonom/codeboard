# Link a shot to its storyboard

Keep storyboard captions available alongside a finished shot. Links preserve the relationship; changing captions does not redraw or retime the animation.

## Keep board panels linked to final animation

`ShotAnimation.boardPanelIds` stores an ordered list of source-board panels. New panel captures record their source panel automatically. Existing animations without the optional field have no links; opening them does not infer provenance.

```ts
project.editShotAnimation('animation:greeting', [
  {op: 'board.link', panelIds: ['panel:greeting', 'panel:reaction']},
]);
const captions = project.shotBoardPanels('animation:greeting', {offset: 0, limit: 20});
```

Links must be unique, contain at most 4,096 IDs, and address existing panels belonging to the animation's `shotId`. The standalone `reviseShotAnimation` API validates the list structure; a project transaction validates panel existence and ownership. An empty list clears the links. The same edit is available inside an `animation.edit` plan, and links persist in studio snapshots and named checkpoints.

`shotBoardPanels()` returns detached panel metadata in link order, including captions, board timing and panel revision, excluding layers and motion annotations. It defaults to 50 records and caps each page at 200, with a 256 KiB serialized response limit. These are current board captions, not frozen script revisions. Board caption/timing changes never regenerate captured artwork or local keys. Deleting a linked panel rejects until it is explicitly unlinked; unlink and delete may share one project transaction. Links do not import screenplay files or retime animation. Use [script interchange](script-import.md) for independent screenplay records. Older runtimes whose strict studio schema lacks this field cannot open newly linked animations; retain the original project when handing work to those runtimes.

Offset pages address the current in-memory state, so restart pagination after an intervening edit. A response exceeding the byte limit rejects with `RESOURCE_LIMIT`; reduce the page size instead of expecting captions to be silently truncated. For editorial clips and camera-key pages, see [timeline metadata](../reference/timeline-queries.md).
