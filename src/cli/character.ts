import type { Command } from "commander";
import { resolve } from "node:path";
import { integerArgument } from "./integer.js";
import { CodeboardError } from "../model/errors.js";

export function registerCharacterCommands(program: Command): void {
  program
    .command("character-plan")
    .description("Plan insertion of a character rig and its performance into an existing shot")
    .argument("<project>", "Path to a .cboard file")
    .argument("<source>", "Master shot animation ID")
    .argument("<root>", "Top-level character group ID in the master")
    .argument("<target>", "Existing destination shot animation ID")
    .requiredOption("--id <id>", "New placement group ID")
    .requiredOption("--expected-version <number>", "Version of the saved project")
    .option("--frame-offset <number>", "Start frame inside the destination", "0")
    .option("--parent <id>", "Existing destination group")
    .option(
      "--composite-source <id>",
      "Receiving source node when destination has a composite graph",
    )
    .option("--actor <id>", "Editing actor", "agent:local")
    .action(
      async (
        path: string,
        source: string,
        root: string,
        target: string,
        options: {
          id: string;
          expectedVersion: string;
          frameOffset: string;
          parent?: string;
          compositeSource?: string;
          actor: string;
        },
      ) => {
        const expectedVersion = integerArgument(options.expectedVersion, "Expected version");
        const frameOffset = integerArgument(options.frameOffset, "Frame offset");
        const { StoryboardProject } = await import("../core/project.js");
        const project = await StoryboardProject.open(resolve(path), { actor: options.actor });
        if (project.version !== expectedVersion)
          throw new CodeboardError(
            "REVISION_CONFLICT",
            "Saved project version differs from expected version",
            { details: { expectedVersion, actualVersion: project.version } },
          );
        const plan = project.plan("Instantiate character", [
          {
            op: "character.instantiate",
            sourceAnimationId: source,
            id: options.id,
            rootLayerId: root,
            targetAnimationId: target,
            frameOffset,
            ...(options.parent === undefined ? {} : { parentLayerId: options.parent }),
            ...(options.compositeSource === undefined
              ? {}
              : { compositeSourceId: options.compositeSource }),
          },
        ]);
        console.log(JSON.stringify(plan, null, 2));
      },
    );
}
