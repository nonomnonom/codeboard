import { Canvas, FontLibrary } from "skia-canvas";
import type { Layer } from "../model/types.js";
import type { ShotAnimation } from "../model/types/shot.js";
import { iterateLayers } from "../model/layers.js";
import { CodeboardError } from "../model/errors.js";
import { boundQueryResponse } from "../model/query.js";
import { documentOf, type RenderSource } from "./source.js";
import { fontFamilies } from "./font-families.js";
import { defineShotAnimation } from "../animation/shot.js";
import { parseStoryboardDocument } from "../model/validation/document.js";

export interface FontDependency {
  ownerId: string;
  layerId: string;
  elementId: string;
  font: string;
  canonicalFont: string | null;
  families: { name: string; status: "available" | "generic" | "missing" }[];
  resolvedFamilies: string[];
  issue: "invalid-declaration" | "unsupported-declaration" | "missing-family" | null;
}

export interface FontInspection {
  available: boolean;
  elements: FontDependency[];
}

export type FontPolicy = "allow-fallback" | "require-available";

/** Validate an export policy before inspecting the selected shots. */
export function validateFontPolicy(policy?: FontPolicy): void {
  if (policy !== undefined && policy !== "allow-fallback" && policy !== "require-available")
    throw new CodeboardError("INVALID_ARGUMENT", "Unknown font policy");
}

export function checkShotFonts(animations: readonly ShotAnimation[], policy?: FontPolicy): void {
  validateFontPolicy(policy);
  if (policy === "require-available")
    for (const animation of animations) requireAvailableFonts(inspectShotFonts(animation));
}

export function checkBoardFonts(source: RenderSource, policy?: FontPolicy): void {
  validateFontPolicy(policy);
  if (policy === "require-available")
    requireAvailableFonts(inspectOwners(parseStoryboardDocument(documentOf(source)).panels));
}

const genericFamilies = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
]);

function inspectOwners(owners: readonly { id: string; layers: Layer[] }[]): FontInspection {
  const context = new Canvas(1, 1).getContext("2d");
  const elements: FontDependency[] = [];
  let textBytes = 0;
  for (const owner of owners)
    for (const layer of iterateLayers(owner.layers)) {
      if (layer.kind === "group") continue;
      for (const element of layer.elements) {
        if (element.kind !== "text") continue;
        textBytes += Buffer.byteLength(element.text);
        if (elements.length >= 4096 || textBytes > 1048576 || element.font.length > 4096)
          throw new CodeboardError(
            "RESOURCE_LIMIT",
            "Font inspection exceeds text or element budget",
          );
        // Invalid assignments retain the previous font. Two sentinels also accept a valid
        // declaration whose normalized value happens to equal either sentinel.
        context.font = "11px monospace";
        context.font = element.font;
        const first = context.font;
        context.font = "13px serif";
        context.font = element.font;
        const valid = context.font === first;
        const requested = valid ? fontFamilies(element.font) : null;
        const families: FontDependency["families"] = (requested ?? []).map(({ name, quoted }) => ({
          name,
          status:
            !quoted && genericFamilies.has(name.toLowerCase())
              ? "generic"
              : FontLibrary.has(name)
                ? "available"
                : "missing",
        }));
        elements.push({
          ownerId: owner.id,
          layerId: layer.id,
          elementId: element.id,
          font: element.font,
          canonicalFont: valid ? first : null,
          families,
          resolvedFamilies: valid
            ? [
                ...new Set(
                  context
                    .measureText(element.text)
                    .lines.flatMap((line) => line.runs.map((run) => run.family)),
                ),
              ].sort()
            : [],
          issue: !valid
            ? "invalid-declaration"
            : !requested
              ? "unsupported-declaration"
              : families.some((family) => family.status === "missing")
                ? "missing-family"
                : null,
        });
      }
    }
  return boundQueryResponse(
    { available: elements.every((element) => element.issue === null), elements },
    "Font inspection",
  );
}

/** Inspect every text element, including hidden layers, drawings and component sources. */
export function inspectProjectFonts(source: RenderSource): FontInspection {
  const document = parseStoryboardDocument(documentOf(source));
  return inspectOwners([...document.panels, ...document.components, ...document.studio.animations]);
}

/** Report declared family availability and the backend's actual families for this shot's text. */
export function inspectShotFonts(animation: ShotAnimation): FontInspection {
  return inspectOwners([defineShotAnimation(animation)]);
}

export function requireAvailableFonts(report: FontInspection): void {
  if (!report.available)
    throw new CodeboardError(
      "MISSING_DEPENDENCY",
      "Text font dependencies are unavailable or unsupported",
      {
        details: { elements: report.elements.filter((element) => element.issue !== null) },
      },
    );
}
