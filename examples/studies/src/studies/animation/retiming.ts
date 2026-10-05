import { renderShotFramePNG } from "codeboard-studio";
import { motion } from "../../shared/motion.ts";
import { save } from "../../shared.ts";
import { comparison } from "../../shared/artifacts.ts";

export async function generate(output: string): Promise<void> {
  const { project } = motion("Give the same movement more time", 24);
  const original = structuredClone(project.shotAnimation("animation:study"));
  project.editShotAnimation(original.id, [
    { op: "timing.retime", durationFrames: 48, rounding: "exact", audio: "scale-starts" },
  ]);
  const slower = project.shotAnimation(original.id);
  await save(
    output,
    "retiming",
    project,
    await comparison(output, "Give the same movement more time", [
      { label: "Original: position at frame 12", png: await renderShotFramePNG(original, 12) },
      {
        label: "Slower version: less travel by frame 12",
        png: await renderShotFramePNG(slower, 12),
      },
      { label: "Slower version reaches it at frame 24", png: await renderShotFramePNG(slower, 24) },
    ]),
  );
}
