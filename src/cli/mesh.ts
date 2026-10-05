import { Option, type Command } from "commander";
import { resolve } from "node:path";
import { integerArgument } from "./integer.js";
import { CodeboardError } from "../model/errors.js";

export function registerMeshInspection(program: Command): void {
  program
    .command("mesh-data")
    .argument("<project>", "Path to a .cboard file")
    .argument("<animation>", "Shot animation ID")
    .argument("<layer>", "Mesh-bound layer ID")
    .addOption(
      new Option("--kind <kind>", "Mesh records")
        .choices(["vertices", "triangles", "keyframes", "joints", "weights"])
        .default("keyframes"),
    )
    .option("--frame <number>", "Evaluate vertices at a signed local frame; omit for bind vertices")
    .option("--limit <number>", "Maximum records, capped at 200", "50")
    .option("--offset <number>", "Skip records", "0")
    .option("--expected-version <number>", "Reject a different saved project version")
    .action(
      async (
        path: string,
        animation: string,
        layer: string,
        options: {
          kind: "vertices" | "triangles" | "keyframes" | "joints" | "weights";
          frame?: string;
          limit: string;
          offset: string;
          expectedVersion?: string;
        },
      ) => {
        const limit = integerArgument(options.limit, "Limit"),
          offset = integerArgument(options.offset, "Offset");
        if (limit < 1) throw new CodeboardError("INVALID_ARGUMENT", "Limit must be positive");
        if (options.frame !== undefined && options.kind !== "vertices")
          throw new CodeboardError("INVALID_ARGUMENT", "Frame applies only to vertex queries");
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
        const data = project.shotMeshData(
          animation,
          layer,
          options.kind === "vertices"
            ? { collection: "vertices", limit, offset, ...(frame === undefined ? {} : { frame }) }
            : { collection: options.kind, limit, offset },
        );
        console.log(JSON.stringify({ version: project.version, data }));
      },
    );
}
