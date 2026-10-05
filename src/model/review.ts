import type { Id, StoryboardDocument } from "./types.js";

/** Replace the array without mutating comment records shared with an undo snapshot. */
export function removeReviewAnchors(
  document: StoryboardDocument,
  removedIds: ReadonlySet<Id>,
): void {
  document.comments = document.comments.filter(
    ({ anchor }) =>
      ![anchor.panelId, anchor.layerId, anchor.elementId].some(
        (id) => id !== undefined && removedIds.has(id),
      ),
  );
}
