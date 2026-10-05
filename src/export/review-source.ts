import { readReviewSourceDocument } from "./review-source-read.js";
import { CodeboardError } from "../model/errors.js";
import { fingerprint } from "../core/edit-plan/fingerprint.js";
import { selectFramePanels } from "../animation/frame.js";
import type { StoryboardDocument } from "../model/types.js";
import { normalizeRate } from "../animation/rational-time.js";
import type { createEditorialResolver } from "../animation/editorial.js";
import { createShotRenderSession } from "../render/shot.js";
import { createEditorialRenderSession } from "../render/editorial.js";
import { runtimeIdentity } from "../runtime/version.js";
import type {
  ReviewTarget,
  ReviewFrameSource,
  ReviewManifest,
  parseReviewOptions,
} from "./review-contract.js";

export function prepareReviewSource(
  projectPath: string,
  input: ReturnType<typeof parseReviewOptions>,
) {
  // Decode before any await: later commits or revision deletion cannot mix frames from different sources.
  const document = readReviewSourceDocument(projectPath, input.revision);
  if (document.version !== input.expectedVersion)
    throw new CodeboardError(
      "REVISION_CONFLICT",
      "Review source differs from the expected version",
      { details: { expected: input.expectedVersion, actual: document.version } },
    );
  const target: ReviewTarget = input.target ?? { kind: "board" };
  if (target.kind !== "board" && input.annotations)
    throw new CodeboardError("INVALID_ARGUMENT", "Motion annotations belong to board review only");
  const animation =
    target.kind === "shot"
      ? document.studio.animations.find((item) => item.id === target.animationId)
      : undefined;
  const sequence =
    target.kind === "editorial"
      ? document.studio.editorial.find((item) => item.id === target.sequenceId)
      : undefined;
  if ((target.kind === "shot" && !animation) || (target.kind === "editorial" && !sequence))
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Review target not found in the selected snapshot",
    );
  const session = sequence
    ? createEditorialRenderSession(sequence, document.studio.animations)
    : animation
      ? createShotRenderSession(animation)
      : undefined;
  let pixels = 0;
  const selected = input.frames.map((frame) => {
    const selection = selectReviewFrame(
      document,
      target,
      frame,
      session && "resolve" in session ? session.resolve : undefined,
    );
    for (const canvas of selection.canvases) {
      const area = canvas.width * canvas.height;
      pixels += area;
      if (area > 32 * 1024 * 1024 || pixels > 512 * 1024 * 1024)
        throw new CodeboardError("RESOURCE_LIMIT", "Review exceeds the pixel budget", {
          details: { maxFramePixels: 32 * 1024 * 1024, maxTotalPixels: 512 * 1024 * 1024 },
        });
    }
    return { frame, ...selection };
  });
  const manifest: ReviewManifest = {
    format: "codeboard-review/2",
    createdAt: new Date().toISOString(),
    source: {
      projectId: document.id,
      version: document.version,
      schemaVersion: document.schemaVersion,
      documentHash: fingerprint(document),
      ...(input.revision === undefined ? {} : { revision: input.revision }),
    },
    renderer: runtimeIdentity(),
    settings: {
      target,
      annotations: input.annotations ?? false,
      frameRate: sequence?.frameRate ?? animation?.frameRate ?? normalizeRate(document.frameRate),
      space: "camera",
      imageFormat: "PNG",
    },
    frames: [],
  };

  return { document, session, selected, manifest };
}

function selectReviewFrame(
  document: StoryboardDocument,
  target: ReviewTarget,
  frame: number,
  resolveFrame?: ReturnType<typeof createEditorialResolver>["resolve"],
): { source: ReviewFrameSource; canvases: { width: number; height: number }[] } {
  if (target.kind === "board") {
    const { panel, incoming, progress } = selectFramePanels(document.panels, frame);
    return {
      source: {
        kind: "board",
        panelId: panel.id,
        ...(incoming ? { incomingPanelId: incoming.id } : {}),
        transitionProgress: progress,
      },
      canvases: [panel, ...(incoming ? [incoming] : [])],
    };
  }
  if (target.kind === "shot") {
    const animation = document.studio.animations.find((item) => item.id === target.animationId)!;
    if (frame >= animation.durationFrames)
      throw new CodeboardError("INVALID_ARGUMENT", "Review frame exceeds shot duration");
    return {
      source: { kind: "shot", animationId: animation.id, sourceFrame: frame },
      canvases: [animation.canvas],
    };
  }
  const sequence = document.studio.editorial.find((item) => item.id === target.sequenceId)!;
  const resolved = resolveFrame!(frame);
  const canvases = [resolved.outgoing, ...(resolved.incoming ? [resolved.incoming] : [])].map(
    (item) =>
      document.studio.animations.find((animation) => animation.id === item.animationId)!.canvas,
  );
  if (
    canvases.some(
      (canvas) => canvas.width !== canvases[0]!.width || canvas.height !== canvases[0]!.height,
    )
  )
    throw new CodeboardError(
      "INVALID_ARGUMENT",
      "Editorial transition requires matching source canvas dimensions",
    );
  return {
    source: {
      kind: "editorial",
      sequenceId: sequence.id,
      outgoing: resolved.outgoing,
      ...(resolved.incoming ? { incoming: resolved.incoming } : {}),
      transition: resolved.transition,
      transitionProgress: resolved.progress,
    },
    canvases,
  };
}
