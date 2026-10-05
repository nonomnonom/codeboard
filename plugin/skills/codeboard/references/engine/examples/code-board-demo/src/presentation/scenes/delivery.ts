import { colors, text } from "../../character/art.ts";
import { enter, mono } from "../artwork/layout.ts";
import { fileProp } from "../artwork/props.ts";
import { inkAction } from "../artwork/studies.ts";
import type { SceneContext } from "./types.ts";
export function draw({ project: b, panel: p, start, end }: SceneContext): void {
  text(p, "Yours to keep.", 130, 274, 79);
  mono(p, "EDITABLE DRAWINGS. FINISHED FILM.", 135, 353, 28, colors.orange);
  const files = enter(b, p, "Delivery files settle", start + 3, end, { dy: 56 });
  fileProp(p, { x: 1140, y: 400, name: ".cboard", scale: 1.8, parent: files.id });
  fileProp(p, { x: 1460, y: 400, name: ".mp4", scale: 1.8, parent: files.id });
  inkAction(
    b,
    p,
    [
      [1150, 730],
      [1540, 730],
      [1635, 684],
    ],
    start + 12,
    start + 32,
    { pen: false },
  );
  mono(p, "$ codeboard movie clawd-final.cboard", 135, 591, 31, colors.paper);
  mono(p, "  --output clawd-final.mp4", 135, 648, 31, colors.paper);
  mono(p, "1920 x 1080 / 24 fps", 135, 837, 28, colors.muted);
}
