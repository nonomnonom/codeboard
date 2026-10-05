import { z } from "zod";
import { storyboardSchema } from "./schema/project.js";

const legacySchema = storyboardSchema
  .omit({ studio: true })
  .extend({ schemaVersion: z.literal(3) });

/** Upgrade the document envelope only; board artwork/timing are preserved verbatim. */
export function upgradeDocument(input: unknown): unknown {
  if (input && typeof input === "object" && "schemaVersion" in input && input.schemaVersion === 3) {
    return {
      ...legacySchema.parse(input),
      schemaVersion: 5,
      studio: { animations: [], editorial: [] },
    };
  }
  if (input && typeof input === "object" && "schemaVersion" in input && input.schemaVersion === 4)
    return { ...input, schemaVersion: 5 };
  return input;
}

export function upgradeHeader(input: unknown): unknown {
  if (
    input &&
    typeof input === "object" &&
    "schemaVersion" in input &&
    (input.schemaVersion === 3 || input.schemaVersion === 4)
  )
    return { ...input, schemaVersion: 5 };
  return input;
}
