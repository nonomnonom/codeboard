import { pathCommands, type PanelHandle } from "codeboard-studio";
import { rect, ink } from "../../../shared.ts";

export function character(
  panel: PanelHandle,
  name: string,
  x: number,
  color: string,
  side: "left" | "right",
) {
  const root = panel.addGroup(name, { transform: { x, y: 195 } });
  const body = panel.addVectorLayer(`${name} body`, {}, root.id);
  const coat = rect(body, -15, -64, 30, 48, color);
  rect(body, -13, -16, 9, 16, ink);
  rect(body, 4, -16, 9, 16, ink);
  const head = panel.addGroup(`${name} head`, { transform: { y: -80 } }, root.id);
  const face = panel.addVectorLayer(`${name} face`, {}, head.id);
  face.path(pathCommands("M -18 0 C -18 -24 18 -24 18 0 C 18 22 -18 22 -18 0 Z"), {
    fill: "#dfb58a",
  });
  rect(face, side === "left" ? 5 : -9, -4, 4, 4, ink);
  const mouth = panel.addGroup(`${name} mouth`, {}, head.id);
  const rest = panel.addVectorLayer(`${name} rest mouth`, {}, mouth.id);
  rect(rest, side === "left" ? 5 : -11, 6, 6, 2, ink);
  const open = panel.addVectorLayer(`${name} open mouth`, {}, mouth.id);
  rect(open, side === "left" ? 4 : -12, 4, 8, 7, ink);
  const arm = panel.addGroup(
    `${name} reaching arm`,
    { transform: { x: side === "left" ? 14 : -14, y: -58 } },
    root.id,
  );
  const sleeve = panel.addVectorLayer(`${name} sleeve`, {}, arm.id);
  const cuff = rect(sleeve, -4, 0, 8, 36, color);
  rect(sleeve, -5, 32, 10, 9, "#dfb58a");
  return { root, head, arm, coat, cuff, mouth, rest, open };
}
