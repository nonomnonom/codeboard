import type { Command } from "commander";
import { basename, dirname, resolve } from "node:path";
import { realpath } from "node:fs/promises";
import type { verifyReviewExport } from "../export/verify-review.js";
import { CodeboardError } from "../model/errors.js";
import { cancellable } from "./cancellation.js";

function summary(verified: Awaited<ReturnType<typeof verifyReviewExport>>) {
  return {
    directory: verified.directory,
    manifestSha256: verified.manifestSha256,
    verified: verified.verified,
    decoded: verified.decoded,
    bytes: verified.bytes,
    evidenceSource: verified.manifest.source,
    target: verified.manifest.settings.target,
  };
}

async function readDecision(path: string, signal: AbortSignal): Promise<unknown> {
  const { readPackageFile } = await import("../export/package-file.js");
  const absolute = resolve(path),
    root = await realpath(dirname(absolute)),
    chunks: Buffer[] = [];
  for await (const chunk of readPackageFile(root, basename(absolute), 1024 * 1024, signal))
    chunks.push(chunk);
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (cause) {
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid review decision JSON", { cause });
  }
}

export function registerReviewVerification(program: Command): void {
  program
    .command("review-verify")
    .argument("<directory>", "Delivered review package")
    .option("--decode", "Decode PNGs and check dimensions in addition to hashes")
    .option("--decision <file>", "Check a saved review decision against this package")
    .option("--source <project>", "Require the decision to match this saved project")
    .option("--revision <name>", "Check a named source revision instead of the saved head")
    .action(
      async (
        directory: string,
        options: { decode?: boolean; decision?: string; source?: string; revision?: string },
      ) => {
        if (options.source !== undefined && options.decision === undefined)
          throw new CodeboardError("INVALID_ARGUMENT", "Source checking requires --decision");
        if (options.revision !== undefined && options.source === undefined)
          throw new CodeboardError("INVALID_ARGUMENT", "A named revision requires --source");
        await cancellable(async (signal) => {
          if (options.decision === undefined) {
            const { verifyReviewExport } = await import("../export/verify-review.js");
            const verified = await verifyReviewExport(resolve(directory), {
              decode: options.decode ?? false,
              signal,
            });
            console.log(JSON.stringify({ ...summary(verified), sourceChecked: false }));
            return;
          }
          const { verifyReviewDecision } = await import("../export/review-decision.js");
          const verified = await verifyReviewDecision(
            resolve(directory),
            await readDecision(options.decision, signal),
            {
              decode: options.decode ?? false,
              signal,
              ...(options.source === undefined
                ? {}
                : {
                    source: {
                      projectPath: resolve(options.source),
                      ...(options.revision === undefined ? {} : { revision: options.revision }),
                    },
                  }),
            },
          );
          console.log(
            JSON.stringify({
              ...summary(verified.verification),
              decision: {
                id: verified.decision.id,
                outcome: verified.decision.outcome,
                reviewer: verified.decision.reviewer,
                frames: verified.decision.frames,
                sha256: verified.decision.sha256,
              },
              sourceChecked: verified.source !== undefined,
              ...(verified.source === undefined ? {} : { checkedSource: verified.source }),
            }),
          );
        });
      },
    );
}
