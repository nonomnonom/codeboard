import type { Command } from "commander";
import { resolve } from "node:path";
import { integerArgument } from "./integer.js";
import { CodeboardError } from "../model/errors.js";

type PageArguments = { limit: string; offset: string; expectedVersion?: string };

function readArguments(options: PageArguments) {
  const limit = integerArgument(options.limit, "Limit");
  const offset = integerArgument(options.offset, "Offset");
  if (limit < 1) throw new CodeboardError("INVALID_ARGUMENT", "Limit must be positive");
  const expected =
    options.expectedVersion === undefined
      ? undefined
      : integerArgument(options.expectedVersion, "Expected version");
  return { page: { limit, offset }, expected };
}

export function registerTimelineInspection(program: Command): void {
  program
    .command("board-data")
    .argument("<project>", "Path to a .cboard file")
    .option("--limit <number>", "Maximum panel records, capped at 200", "50")
    .option("--offset <number>", "Skip panels in timeline order", "0")
    .option("--expected-version <number>", "Reject a different saved project version")
    .action(async (path: string, options: PageArguments) => {
      const { page, expected } = readArguments(options);
      const { ProjectStore } = await import("../storage/store.js");
      const store = ProjectStore.open(resolve(path));
      try {
        console.log(
          JSON.stringify(
            store.boardPanels(page, expected === undefined ? {} : { expectedVersion: expected }),
          ),
        );
      } finally {
        store.close();
      }
    });

  program
    .command("editorial-data")
    .argument("<project>", "Path to a .cboard file")
    .argument("<sequence>", "Editorial sequence ID")
    .option("--limit <number>", "Maximum clip records, capped at 200", "50")
    .option("--offset <number>", "Skip clips in sequence order", "0")
    .option("--expected-version <number>", "Reject a different saved project version")
    .action(async (path: string, sequence: string, options: PageArguments) => {
      const { page, expected } = readArguments(options);
      const { ProjectStore } = await import("../storage/store.js");
      const store = ProjectStore.open(resolve(path));
      try {
        console.log(
          JSON.stringify(
            store.editorialClips(
              sequence,
              page,
              expected === undefined ? {} : { expectedVersion: expected },
            ),
          ),
        );
      } finally {
        store.close();
      }
    });
}
