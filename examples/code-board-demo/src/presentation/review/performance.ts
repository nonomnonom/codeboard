import { StoryboardProject, createRenderSession, renderFrameSheet } from "codeboard-studio";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { colors, ground, text } from "../../character/art.ts";
import { paths } from "../../config.ts";
import { panel, sample, label } from "../artwork/performance.ts";
const out = paths.performance;
export async function sheets(final: StoryboardProject, reel: StoryboardProject) {
  const b = StoryboardProject.create({
    title: "Codeboard / actual performance contact sheet",
    width: 1920,
    height: 1440,
    frameRate: 24,
    background: colors.bg,
  });
  b.transaction("Arrange actual cels for inspection", () => {
    const p = panel(b, "Key drawings and in-betweens", 1);
    text(p, "Codeboard / performance drawings", 70, 86, 38);
    const fs = [0, 4, 8, 12, 88, 94, 118, 124, 128, 130, 134, 140, 146, 152, 156, 162, 170, 186];
    fs.forEach((f, i) => {
      const x = 180 + (i % 6) * 312,
        y = 430 + Math.floor(i / 6) * 440;
      ground(p, x - 130, x + 130, y);
      sample(p, f, x, y, 0.86);
      label(p, f, x, y + 45);
    });
  });
  await writeFile(
    join(out, "contact-sheet.png"),
    await createRenderSession(b).frame(0).toBuffer("png"),
  );
  await b.save(join(out, "contact-sheet.cboard"));
  await writeFile(
    join(out, "reel-overview.png"),
    await renderFrameSheet(reel, [24, 60, 132, 192, 240, 300, 478, 552], {
      columns: 4,
      thumbnailWidth: 480,
    }),
  );
  const fs = createRenderSession(final);
  for (const f of [8, 94, 124, 130, 140, 152, 156, 186] as const)
    await writeFile(join(out, `frame-${f}.png`), await fs.frame(f).toBuffer("png"));
}
