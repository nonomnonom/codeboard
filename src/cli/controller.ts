import { Option, type Command } from "commander";
import { resolve } from "node:path";
import { integerArgument } from "./integer.js";
import { CodeboardError } from "../model/errors.js";

export function registerControllerInspection(program: Command): void {
  program
    .command("controller-data")
    .argument("<project>", "Path to a .cboard file")
    .argument("<animation>", "Shot animation ID")
    .argument("<controller>", "Controller ID")
    .addOption(
      new Option("--kind <kind>", "Controller records")
        .choices(["targets", "keyframes"])
        .default("keyframes"),
    )
    .option("--frame <number>", "Evaluate weight and target layer state at a signed local frame")
    .option("--limit <number>", "Maximum records, capped at 200", "50")
    .option("--offset <number>", "Skip records", "0")
    .option("--expected-version <number>", "Reject a different saved project version")
    .action(
      async (
        path: string,
        animation: string,
        controller: string,
        options: {
          kind: "targets" | "keyframes";
          frame?: string;
          limit: string;
          offset: string;
          expectedVersion?: string;
        },
      ) => {
        const limit = integerArgument(options.limit, "Limit"),
          offset = integerArgument(options.offset, "Offset");
        if (limit < 1) throw new CodeboardError("INVALID_ARGUMENT", "Limit must be positive");
        const frame =
          options.frame === undefined ? undefined : integerArgument(options.frame, "Frame", true);
        const expected =
          options.expectedVersion === undefined
            ? undefined
            : integerArgument(options.expectedVersion, "Expected version");
        const { StoryboardProject } = await import("../core/project.js");
        const project = await StoryboardProject.open(resolve(path));
        if (expected !== undefined && project.version !== expected)
          throw new CodeboardError(
            "REVISION_CONFLICT",
            "Saved project version differs from expected version",
            {
              details: { expected, actual: project.version },
            },
          );
        const data = project.shotControllerData(animation, controller, {
          collection: options.kind,
          limit,
          offset,
          ...(frame === undefined ? {} : { frame }),
        });
        console.log(JSON.stringify({ version: project.version, data }));
      },
    );
}
