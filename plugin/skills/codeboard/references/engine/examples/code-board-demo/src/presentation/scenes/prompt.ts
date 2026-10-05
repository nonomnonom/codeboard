import { text } from "../../character/art.ts";
import { welcomeTerminal } from "../artwork/terminal.ts";
import { popup, prompt, type } from "../artwork/layout.ts";
import { celStack } from "../artwork/props.ts";
import { inkAction } from "../artwork/studies.ts";
import type { SceneContext } from "./types.ts";
export function draw({ project: b, panel: p, start, end }: SceneContext): void {
  text(p, "Direct the idea.", 132, 235, 86);
  text(p, "Codeboard + Claude Code", 140, 326, 34);
  celStack(b, p, { x: 1390, y: 146, start, end });
  inkAction(
    b,
    p,
    [
      [998, 286],
      [1100, 286],
      [1220, 220],
      [1358, 220],
    ],
    start + 30,
    start + 64,
    { pen: false },
  );
  welcomeTerminal(p);
  type(b, p, prompt, 218, 737, start + 3, end, 32);
  popup(
    b,
    p,
    "The direction",
    "One obstacle. A moment of hesitation.",
    start + 70,
    end,
    960,
    886,
    828,
  );
}
