import type { ProductionScript } from "./script.js";
import type { ShotAnimation } from "./shot.js";
import type { EditorialSequence } from "./editorial.js";

export interface StudioContent {
  componentOrigins?: import("./component-origins.js").ComponentOrigin[];
  palettes?: import("./palettes.js").Palette[];
  script?: ProductionScript;
  animations: ShotAnimation[];
  editorial: EditorialSequence[];
}
