import { registerControllerInspection } from "./controller.js";
import { Option, type Command } from "commander";
import { resolve } from "node:path";
import { integerArgument } from "./integer.js";
import { registerMeshInspection } from "./mesh.js";
import { registerTimelineInspection } from "./timeline-data.js";
import { registerReviewVerification } from "./review-verify.js";

export function registerInspectionCommands(program: Command): void {
  registerMeshInspection(program);
  registerControllerInspection(program);
  registerTimelineInspection(program);
  registerReviewVerification(program);
  program
    .command("capabilities")
    .option("--probe-dependencies", "Check FFmpeg and ffprobe startup (two-second limit each)")
    .option("--ffmpeg <path>")
    .option("--ffprobe <path>")
    .action(async (options: { probeDependencies?: boolean; ffmpeg?: string; ffprobe?: string }) => {
      const { capabilities } = await import("../runtime/capabilities.js");

      console.log(
        JSON.stringify(
          await capabilities({
            probeDependencies: options.probeDependencies ?? false,
            ...(options.ffmpeg === undefined ? {} : { ffmpegPath: options.ffmpeg }),
            ...(options.ffprobe === undefined ? {} : { ffprobePath: options.ffprobe }),
          }),
          null,
          2,
        ),
      );
    });

  program
    .command("validate")
    .argument("<project>", "Path to a .cboard file")
    .action(async (projectPath: string) => {
      const { ProjectStore } = await import("../storage/store.js");

      const store = ProjectStore.open(resolve(projectPath));
      try {
        store.verify();
        console.log(JSON.stringify(store.inspect(), null, 2));
      } finally {
        store.close();
      }
    });

  program
    .command("inspect")
    .argument("<project>")
    .option("--panel <id>")
    .option("--name <text>")
    .option("--limit <number>", "Result count (maximum 200)", "50")
    .option("--offset <number>", "Skip matching objects", "0")
    .action(
      async (
        path: string,
        options: { panel?: string; name?: string; limit: string; offset: string },
      ) => {
        const { ProjectStore } = await import("../storage/store.js");

        const store = ProjectStore.open(resolve(path));
        try {
          console.log(
            JSON.stringify(
              {
                storage: store.inspect(),
                objects: store.findObjects({
                  limit: Number(options.limit),
                  offset: Number(options.offset),
                  ...(options.panel ? { panelId: options.panel } : {}),
                  ...(options.name ? { name: options.name } : {}),
                }),
              },
              null,
              2,
            ),
          );
        } finally {
          store.close();
        }
      },
    );

  program
    .command("query")
    .argument("<project>")
    .option("--kind <kind>")
    .option("--parent <id>")
    .option("--id <id>")
    .option("--panel <id>")
    .option("--name <text>")
    .option("--limit <number>", "Maximum records, capped at 200", "50")
    .option("--offset <number>", "Skip matching records", "0")
    .option("--expected-version <number>", "Reject a different saved project version")
    .action(
      async (
        path: string,
        options: {
          kind?: string;
          parent?: string;
          id?: string;
          panel?: string;
          name?: string;
          limit: string;
          offset: string;
          expectedVersion?: string;
        },
      ) => {
        const { ProjectStore } = await import("../storage/store.js");

        const store = ProjectStore.open(resolve(path));
        try {
          console.log(
            JSON.stringify(
              store.query(
                {
                  limit: Number(options.limit),
                  offset: Number(options.offset),
                  ...(options.kind === undefined ? {} : { kind: options.kind }),
                  ...(options.parent === undefined ? {} : { parentId: options.parent }),
                  ...(options.id === undefined ? {} : { id: options.id }),
                  ...(options.panel === undefined ? {} : { panelId: options.panel }),
                  ...(options.name === undefined ? {} : { name: options.name }),
                },
                options.expectedVersion === undefined
                  ? {}
                  : { expectedVersion: Number(options.expectedVersion) },
              ),
            ),
          );
        } finally {
          store.close();
        }
      },
    );

  program
    .command("drawing-data")
    .argument("<project>", "Path to a .cboard file")
    .argument("<group>", "Board, component or shot drawing group ID")
    .addOption(
      new Option("--kind <kind>", "Drawing records to inspect")
        .choices(["exposures", "alternatives"])
        .default("exposures"),
    )
    .option("--limit <number>", "Maximum records, capped at 200", "50")
    .option("--offset <number>", "Skip records in sequence/child order", "0")
    .option("--expected-version <number>", "Reject a different saved project version")
    .action(
      async (
        path: string,
        group: string,
        options: {
          kind: "exposures" | "alternatives";
          limit: string;
          offset: string;
          expectedVersion?: string;
        },
      ) => {
        const [{ StoryboardProject }, { CodeboardError }] = await Promise.all([
          import("../core/project.js"),
          import("../model/errors.js"),
        ]);
        const limit = integerArgument(options.limit, "Limit"),
          offset = integerArgument(options.offset, "Offset");
        if (limit < 1) throw new CodeboardError("INVALID_ARGUMENT", "Limit must be positive");
        const expectedVersion =
          options.expectedVersion === undefined
            ? undefined
            : integerArgument(options.expectedVersion, "Expected version");
        const project = await StoryboardProject.open(resolve(path));
        if (expectedVersion !== undefined && project.version !== expectedVersion)
          throw new CodeboardError(
            "REVISION_CONFLICT",
            "Saved project version differs from expected version",
            {
              details: { expected: expectedVersion, actual: project.version },
            },
          );
        const items =
          options.kind === "exposures"
            ? project.production.drawingExposures(group, { limit, offset })
            : project.production.drawingAlternatives(group, { limit, offset });
        console.log(JSON.stringify({ version: project.version, items }));
      },
    );
}
