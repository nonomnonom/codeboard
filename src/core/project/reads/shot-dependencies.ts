import type { StoryboardDocument, PageOptions } from "../../../model/types.js";
import { collectShotDependencies } from "../../../model/shot-dependencies.js";
import { boundQueryResponse, pageBounds } from "../../../model/query.js";

export function readShotDependencies(
  document: StoryboardDocument,
  animationId: string,
  options: PageOptions,
) {
  const { offset, limit } = pageBounds(options);
  const { items, dependencyHash } = collectShotDependencies(document, animationId);
  const page = items.slice(offset, offset + limit);
  return boundQueryResponse(
    {
      version: document.version,
      animationId,
      dependencyHash,
      total: items.length,
      offset,
      limit,
      nextOffset: offset + page.length < items.length ? offset + page.length : null,
      items: page,
    },
    "Shot dependency page",
  );
}
