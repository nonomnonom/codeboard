import { isDeepStrictEqual } from "node:util";
import type { StoryboardProject } from "../project.js";
import type { Palette } from "../../model/types/palettes.js";
import { mergePalette, type PaletteMergeOptions } from "../../model/palette-merge.js";

/** Resolve one palette against the current project and prepare its existing native command. */
export function planPaletteMerge(
  project: StoryboardProject,
  base: Palette | null,
  incoming: Palette | null,
  options: PaletteMergeOptions = {},
) {
  const id = base?.id ?? incoming?.id;
  const local = project.studio.palettes?.find((entry) => entry.id === id) ?? null;
  const result = mergePalette(base, local, incoming, options);
  const plan =
    result.conflictsResolved && !isDeepStrictEqual(local, result.palette)
      ? project.plan("Merge shared palette revision", [
          result.palette
            ? { op: "palette.put", palette: result.palette }
            : { op: "palette.remove", id: result.id },
        ])
      : null;
  return { ...result, plan };
}
