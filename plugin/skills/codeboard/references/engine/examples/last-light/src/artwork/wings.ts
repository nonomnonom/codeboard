import { pathCommands, type PanelHandle, type StoryboardProject } from "codeboard-studio";
import { contour, grey, ink, paper, stroke } from "./art.ts";
export function flightWingCycle(
  panel: PanelHandle,
  board: StoryboardProject,
  parentId: string,
  oldWingsId: string,
  start: number,
  duration: number,
) {
  const track = panel.addGroup("Flight / wing drawing sequence", {}, parentId);
  const spread = panel.addVectorLayer("Wings / spread", {}, track.id);
  const left = contour(
    spread,
    "M 0 0 C -35 -55 -133 -88 -154 -60 C -156 -30 -62 8 -5 10 Z",
    paper,
    ink,
    2,
  );
  spread.booleanPath(
    left,
    pathCommands("M -164 -54 L -137 -53 L -142 -42 L -163 -36 Z"),
    "difference",
  );
  contour(spread, "M 3 -2 C 34 -52 113 -83 133 -52 C 136 -23 66 3 10 11 Z", paper, ink, 2);
  for (let i = 0; i < 6; i++) {
    stroke(
      spread,
      [
        [0, 3],
        [-47 - i * 16, -22 - i * 6],
        [-143 + i * 14, -61 + i * 4],
      ],
      1,
      grey,
    );
    stroke(
      spread,
      [
        [5, 4],
        [42 + i * 13, -20 - i * 4],
        [122 - i * 10, -54 + i * 3],
      ],
      1,
      grey,
    );
  }
  const down = panel.addVectorLayer("Wings / swept down", {}, track.id);
  const downLeft = contour(
    down,
    "M -3 0 C -43 -1 -125 23 -140 52 C -129 76 -45 42 -4 12 Z",
    paper,
    ink,
    2,
  );
  down.booleanPath(
    downLeft,
    pathCommands("M -149 47 L -122 48 L -127 56 L -146 64 Z"),
    "difference",
  );
  contour(down, "M 6 0 C 40 -8 119 13 132 38 C 134 65 56 43 8 12 Z", paper, ink, 2);
  for (let i = 0; i < 5; i++) {
    stroke(
      down,
      [
        [-3, 8],
        [-44 - i * 15, 15 + i * 3],
        [-125 + i * 15, 55 - i * 4],
      ],
      1,
      grey,
    );
    stroke(
      down,
      [
        [8, 7],
        [44 + i * 14, 11 + i * 3],
        [121 - i * 13, 40 - i * 3],
      ],
      1,
      grey,
    );
  }
  const raised = panel.addVectorLayer("Wings / raised recovery", {}, track.id);
  const raisedLeft = contour(
    raised,
    "M -5 4 C -22 -31 -69 -109 -91 -104 C -112 -96 -63 -22 -8 14 Z",
    paper,
    ink,
    2,
  );
  raised.booleanPath(
    raisedLeft,
    pathCommands("M -105 -93 L -88 -88 L -92 -78 L -108 -80 Z"),
    "difference",
  );
  contour(raised, "M 5 3 C 15 -39 51 -111 69 -107 C 91 -101 58 -28 10 14 Z", paper, ink, 2);
  for (let i = 0; i < 4; i++) {
    stroke(
      raised,
      [
        [-5, 6],
        [-30 - i * 9, -29 - i * 8],
        [-91 + i * 11, -91 + i * 12],
      ],
      1,
      grey,
    );
    stroke(
      raised,
      [
        [7, 5],
        [24 + i * 7, -33 - i * 8],
        [67 - i * 7, -93 + i * 14],
      ],
      1,
      grey,
    );
  }
  const phases = [spread.id, spread.id, down.id, raised.id, raised.id, down.id];
  const keys = [];
  for (let frame = 0; frame < duration; frame++)
    if (frame === 0 || phases[frame % 6] !== phases[(frame - 1) % 6])
      keys.push({ frame: start + frame, drawingId: phases[frame % 6]! });
  board.production.setDrawingSequence(track.id, keys);
  board.production.moveLayer(track.id, oldWingsId);
  board.production.removeLayer(oldWingsId);
  return track;
}
