import type { Command } from "commander";
import { resolve } from "node:path";

import { CodeboardError } from "../../model/errors.js";

import { writeNewFrame } from "../frame-output.js";

export function registerReviewCommand(program: Command): void {
  program
    .command("review")
    .argument("<project>")
    .requiredOption("-o, --output <directory>", "Parent directory for a new review package")
    .requiredOption("--frames <frames>", "Comma-separated frame numbers")
    .requiredOption("--expected-version <number>", "Version of the selected saved head or revision")
    .option("--revision <name>")
    .option("--annotations")
    .option("--shot <animation-id>", "Review local shot frames")
    .option("--editorial <sequence-id>", "Review editorial frames")
    .action(
      async (
        path: string,
        options: {
          output: string;
          frames: string;
          expectedVersion: string;
          revision?: string;
          annotations?: boolean;
          shot?: string;
          editorial?: string;
        },
      ) => {
        const { exportReview } = await import("../../export/review-export.js");

        if (options.shot !== undefined && options.editorial !== undefined)
          throw new CodeboardError("INVALID_ARGUMENT", "Choose either --shot or --editorial");
        const frames = options.frames
          .split(",")
          .map((value) => (/^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN));
        const expectedVersion = /^\d+$/.test(options.expectedVersion)
          ? Number(options.expectedVersion)
          : NaN;
        const result = await exportReview(resolve(path), resolve(options.output), {
          frames,
          expectedVersion,
          target:
            options.shot !== undefined
              ? { kind: "shot", animationId: options.shot }
              : options.editorial !== undefined
                ? { kind: "editorial", sequenceId: options.editorial }
                : { kind: "board" },
          annotations: options.annotations ?? false,
          ...(options.revision === undefined ? {} : { revision: options.revision }),
        });
        console.log(JSON.stringify(result, null, 2));
      },
    );
}

export function registerFrameCommand(program: Command): void {
  program
    .command("frame")
    .argument("<project>", "Saved .cboard project")
    .requiredOption("-o, --output <file>", "New PNG file; existing files are never replaced")
    .requiredOption("--frame <number>", "Nonnegative output frame")
    .requiredOption("--expected-version <number>", "Version of the selected saved head or revision")
    .option("--revision <name>")
    .option("--shot <animation-id>")
    .option("--editorial <sequence-id>")
    .action(
      async (
        path: string,
        options: {
          output: string;
          frame: string;
          expectedVersion: string;
          revision?: string;
          shot?: string;
          editorial?: string;
        },
      ) => {
        const [
          { ProjectStore },
          { renderFramePNG },
          { renderShotFramePNG },
          { renderEditorialFramePNG },
        ] = await Promise.all([
          import("../../storage/store.js"),
          import("../../render/panel-renderer.js"),
          import("../../render/shot.js"),
          import("../../render/editorial.js"),
        ]);

        if (options.shot !== undefined && options.editorial !== undefined)
          throw new CodeboardError("INVALID_ARGUMENT", "Choose either --shot or --editorial");
        const frame = /^\d+$/.test(options.frame) ? Number(options.frame) : NaN;
        const expectedVersion = /^\d+$/.test(options.expectedVersion)
          ? Number(options.expectedVersion)
          : NaN;
        if (!Number.isSafeInteger(frame) || !Number.isSafeInteger(expectedVersion))
          throw new CodeboardError(
            "INVALID_ARGUMENT",
            "Frame and expected version must be nonnegative safe integers",
          );
        const store = ProjectStore.open(resolve(path));
        const document = (() => {
          try {
            return options.revision === undefined
              ? store.readDocument()
              : store.readRevision(options.revision);
          } finally {
            store.close();
          }
        })();
        if (document.version !== expectedVersion)
          throw new CodeboardError(
            "REVISION_CONFLICT",
            "Selected saved version differs from expected version",
            { details: { expected: expectedVersion, actual: document.version } },
          );
        let png: Buffer;
        if (options.shot !== undefined) {
          const animation = document.studio.animations.find((item) => item.id === options.shot);
          if (!animation)
            throw new CodeboardError(
              "INVALID_ARGUMENT",
              `Shot animation not found: ${options.shot}`,
            );
          png = await renderShotFramePNG(animation, frame);
        } else if (options.editorial !== undefined) {
          const sequence = document.studio.editorial.find((item) => item.id === options.editorial);
          if (!sequence)
            throw new CodeboardError(
              "INVALID_ARGUMENT",
              `Editorial sequence not found: ${options.editorial}`,
            );
          png = await renderEditorialFramePNG(sequence, document.studio.animations, frame);
        } else png = await renderFramePNG(document, frame);
        const output = resolve(options.output);
        await writeNewFrame(output, png);
        console.log(
          JSON.stringify(
            {
              projectId: document.id,
              version: document.version,
              revision: options.revision ?? null,
              frame,
              target:
                options.shot !== undefined
                  ? { kind: "shot", animationId: options.shot }
                  : options.editorial !== undefined
                    ? { kind: "editorial", sequenceId: options.editorial }
                    : { kind: "board" },
              output,
            },
            null,
            2,
          ),
        );
      },
    );
}
