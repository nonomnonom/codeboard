import type { Command } from "commander";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { starter } from "../starter.js";
import { registerCharacterCommands } from "./character.js";

import { CodeboardError } from "../model/errors.js";

export function registerAuthoringCommands(program: Command): void {
  registerCharacterCommands(program);
  program
    .command("migrate")
    .argument("<source>")
    .argument("<destination>")
    .option("--expected-version <number>", "Required version of the saved source")
    .action(async (source: string, destination: string, options: { expectedVersion?: string }) => {
      const { migrateProject } = await import("../core/migrate.js");

      const expectedVersion =
        options.expectedVersion === undefined
          ? undefined
          : /^\d+$/.test(options.expectedVersion)
            ? Number(options.expectedVersion)
            : NaN;
      if (expectedVersion !== undefined && !Number.isSafeInteger(expectedVersion))
        throw new CodeboardError(
          "INVALID_ARGUMENT",
          "Expected version must be a nonnegative safe integer",
        );
      console.log(
        JSON.stringify(
          await migrateProject(
            source,
            destination,
            expectedVersion === undefined ? {} : { expectedVersion },
          ),
          null,
          2,
        ),
      );
    });

  program
    .command("init")
    .argument("[file]", "New JavaScript authoring file", "scene.mjs")
    .action(async (file: string) => {
      await writeFile(resolve(file), starter, { flag: "wx" });
      console.log(`Created ${file}. Run: codeboard run ${JSON.stringify(file)}`);
    });

  program
    .command("configure")
    .argument("<project>", "Path to a .cboard file")
    .argument("<changes>", "JSON file containing ProjectChanges")
    .action(async (projectPath: string, changesPath: string) => {
      const { StoryboardProject } = await import("../core/project.js");

      const path = resolve(projectPath);
      const project = await StoryboardProject.open(path);
      project.configure(JSON.parse(readFileSync(resolve(changesPath), "utf8")));
      await project.save(path);
      console.log(`Configured ${projectPath} at version ${project.version}`);
    });

  program
    .command("plan")
    .argument("<project>")
    .argument("<commands>", "JSON array of EditCommand")
    .requiredOption("--label <text>")
    .option("--actor <id>", "Editing actor", "agent:local")
    .action(async (path: string, commands: string, options: { label: string; actor: string }) => {
      const { StoryboardProject } = await import("../core/project.js");

      const project = await StoryboardProject.open(resolve(path), { actor: options.actor });
      console.log(
        JSON.stringify(
          project.plan(options.label, JSON.parse(readFileSync(resolve(commands), "utf8"))),
          null,
          2,
        ),
      );
    });

  program
    .command("commit")
    .argument("<project>")
    .argument("<plan>", "JSON edit plan")
    .requiredOption("--request-id <id>")
    .option("--actor <id>", "Editing actor", "agent:local")
    .action(async (path: string, plan: string, options: { requestId: string; actor: string }) => {
      const { StoryboardProject } = await import("../core/project.js");

      const project = await StoryboardProject.open(resolve(path), { actor: options.actor });
      console.log(
        JSON.stringify(
          await project.commit(JSON.parse(readFileSync(resolve(plan), "utf8")), {
            requestId: options.requestId,
          }),
          null,
          2,
        ),
      );
    });

  program
    .command("receipt")
    .argument("<project>")
    .argument("<request-id>")
    .action(async (path: string, requestId: string) => {
      const { ProjectStore } = await import("../storage/store.js");

      const store = ProjectStore.open(resolve(path));
      try {
        console.log(JSON.stringify(store.readReceipt(requestId), null, 2));
      } finally {
        store.close();
      }
    });
}
