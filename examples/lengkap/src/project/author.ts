import { StoryboardProject } from "codeboard-studio";
import {
  Art,
  charcoal,
  dry,
  fine,
  paper,
  pastel,
  pencil,
  rough,
  stampInk,
} from "../artwork/art.ts";
import { config } from "../config.ts";
import { draw as drawClosing } from "../scenes/closing.ts";
import { draw as drawDisconnect } from "../scenes/disconnect.ts";
import { draw as drawInspection } from "../scenes/inspection.ts";
import { draw as drawReport } from "../scenes/report.ts";
import { draw as drawStamp } from "../scenes/stamp.ts";
import { draw as drawWriting } from "../scenes/writing.ts";
const drawings = [drawWriting, drawReport, drawStamp, drawInspection, drawDisconnect, drawClosing];
export function author() {
  const board = StoryboardProject.create({ ...config, background: paper });
  const titles = [
    "MENULIS",
    "MEMENUHI LAPORAN",
    "MENGESAHKAN",
    "MEMERIKSA KENYATAAN",
    "TIDAK TERHUBUNG",
    "PENUTUP",
  ];
  const actions = [
    "Laporan disusun.",
    "Enam gambar motor memenuhi laporan.",
    "Cap menyatakan lengkap.",
    "Tempat barang tidak terisi.",
    "Laporan tidak terhubung ke kenyataan.",
    "Di kertas, semuanya ada.",
  ];
  for (let i = 0; i < 6; i++)
    board.transaction(`Draw scene ${i + 1}`, () => {
      const p = board
        .addScene(titles[i]!, `scene:${i + 1}`)
        .addShot(titles[i]!, `shot:${i + 1}`)
        .addPanel({
          id: `panel:${i + 1}`,
          number: String(i + 1).padStart(2, "0"),
          title: titles[i]!,
          action: actions[i]!,
          durationFrames: 60,
        });
      const a = new Art(board, p, i * 60);
      const draw = drawings[i];
      if (!draw) throw new Error("Missing scene drawing");
      draw(a, board);
    });
  board.transaction("Register brushes and provenance", () => {
    for (const brush of [rough, dry, fine, stampInk, charcoal, pastel, pencil])
      board.production.createBrush(brush);
    board.setMetadata(
      "fiction",
      "Original fictional satire. No real office, official, case or loss figure.",
    );
    board.setMetadata(
      "artwork",
      "Procedural editable brush strokes and text; no generated image or video.",
    );
    board.setMetadata("sound", "Original synthesized Foley, CC0-1.0; examples/lengkap/sound.ts.");
    board.setMetadata("fonts", "Arial and Segoe Print; system fonts.");
  });
  return board;
}
