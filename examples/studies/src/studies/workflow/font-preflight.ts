import assert from "node:assert/strict";
import { join } from "node:path";
import { writeFile, access } from "node:fs/promises";
import {
  inspectProjectFonts,
  inspectShotFonts,
  createFrameJob,
  runFrameJob,
  readFrameJobFrame,
  renderShotFramePNG,
  exportShotMovie,
} from "codeboard-studio";
import { make, ink } from "../../shared.ts";
import { comparison, report } from "../../shared/artifacts.ts";
import { pinnedTitle } from "./font-preflight/pinned.ts";

export async function generate(output: string): Promise<void> {
  const project = make("Check text dependencies before a render job");
  const panel = project.addScene("Titles").addShot("Title card").addPanel({ durationFrames: 2 });
  const layer = panel.addVectorLayer("Editable title");
  const id = layer.text("Field notes", 35, 140, {
    font: '42px "Codeboard Missing Documentation Font", sans-serif',
    color: ink,
  });
  project.capturePanelAnimation(panel.id, { id: "animation:fonts" });
  const missing = inspectShotFonts(project.shotAnimation("animation:fonts"));
  assert.equal(missing.available, false);
  const rejectedMovie = join(output, "missing-font.mp4");
  await assert.rejects(
    exportShotMovie(project.shotAnimation("animation:fonts"), rejectedMovie, {
      fontPolicy: "require-available",
    }),
    { code: "MISSING_DEPENDENCY" },
  );
  await assert.rejects(access(rejectedMovie));
  const fallback = await renderShotFramePNG(project.shotAnimation("animation:fonts"), 0);
  const source = join(output, "font-preflight.cboard"),
    job = join(output, "frames.sqlite");
  await project.save(source);
  assert.throws(
    () =>
      createFrameJob(source, job, {
        expectedVersion: project.version,
        target: { kind: "shot", animationId: "animation:fonts" },
        fontPolicy: "require-available",
      }),
    { code: "MISSING_DEPENDENCY" },
  );

  layer.edit(id, (element) =>
    element.kind === "text" ? { ...element, font: "42px serif" } : element,
  );
  const animation = project.shotAnimation("animation:fonts");
  for (const drawing of animation.layers)
    if (drawing.kind !== "group")
      for (const element of drawing.elements)
        if (element.kind === "text") element.font = "42px serif";
  project.putShotAnimation(animation);
  const repaired = inspectProjectFonts(project);
  assert.equal(repaired.available, true);
  await project.save(source);
  createFrameJob(source, job, {
    expectedVersion: project.version,
    target: { kind: "shot", animationId: animation.id },
    fontPolicy: "require-available",
  });
  const completed = await runFrameJob(job);
  assert.equal(completed.rendered, 2);
  const checked = readFrameJobFrame(job, 0);
  assert.deepEqual(checked, await renderShotFramePNG(animation, 0));
  const pinned = await pinnedTitle(output);
  await writeFile(
    join(output, "font-preflight.png"),
    await comparison(
      output,
      "Keep the title you intended",
      [
        { label: "Requested font missing: fallback", png: fallback },
        { label: "Choose an available serif font", png: checked },
        { label: "Bundle DM Sans with the project", png: pinned.png },
      ],
      3,
    ),
  );
  await report(output, "fonts", {
    missing,
    repaired,
    completed,
    moviePreflightRejected: true,
    pinned: {
      fontFiles: pinned.fontFiles,
      resumed: pinned.resumed,
      published: pinned.published,
      handoff: pinned.handoff,
    },
  });
}
