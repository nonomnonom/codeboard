import { storyboardSchema } from "../model/schema/project.js";
import { upgradeHeader } from "../model/migration.js";
import type { Header } from "./types.js";

export function parseHeader(input: unknown): Header {
  return storyboardSchema
    .omit({ panels: true, components: true, changes: true, studio: true })
    .parse(upgradeHeader(input)) as Header;
}
