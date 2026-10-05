import type { Id, ReviewComment } from "../../model/types.js";
import type { ProductionHost, MutationOptions } from "./host.js";

type Host = Pick<ProductionHost, "_applyProduction" | "actor">;

export { removeReviewAnchors } from "../../model/review.js";

export function comment(
  host: Host,
  body: string,
  anchor: ReviewComment["anchor"],
  options: MutationOptions & { author?: string } = {},
): Id {
  let id = "";
  host._applyProduction(
    "add review comment",
    Object.values(anchor).filter((value): value is string => typeof value === "string"),
    options.expectedVersion,
    (document, nextId) => {
      id = nextId("comment");
      document.comments.push({
        id,
        author: options.author ?? host.actor,
        body,
        status: "open",
        anchor: structuredClone(anchor),
        createdAt: new Date().toISOString(),
      });
    },
  );
  return id;
}

export function resolveComment(host: Host, commentId: Id, options: MutationOptions = {}): void {
  host._applyProduction(
    "resolve review comment",
    [commentId],
    options.expectedVersion,
    (document) => {
      const comment = document.comments.find((entry) => entry.id === commentId);
      if (!comment) throw new Error(`Comment not found: ${commentId}`);
      comment.status = "resolved";
      comment.resolvedAt = new Date().toISOString();
    },
  );
}
