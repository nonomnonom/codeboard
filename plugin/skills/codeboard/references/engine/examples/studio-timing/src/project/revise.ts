import { readFile, writeFile } from "node:fs/promises";
import { StoryboardProject, type EditPlan } from "codeboard-studio";
import { config, paths } from "../config.ts";

export async function revise(directory = config.output) {
  const files = paths(directory);
  const project = await StoryboardProject.open(files.project);
  let plan: EditPlan;
  try {
    plan = JSON.parse(await readFile(files.plan, "utf8"));
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    plan = project.plan("Reorder cuts and adjust the cut point, retaining ten seconds", [
      {
        op: "editorial.edit",
        id: config.sequenceId,
        edits: [
          { op: "move", id: "cut-1", beforeId: "cut-0" },
          { op: "update", id: "cut-1", changes: { durationFrames: 132 } },
          { op: "update", id: "cut-0", changes: { sourceInFrame: 12, durationFrames: 108 } },
        ],
      },
    ]);
    await writeFile(files.plan, `${JSON.stringify(plan, null, 2)}\n`, { flag: "wx" });
  }
  const receipt = await project.commit(plan, { requestId: "studio-timing-cut-v1" });
  await writeFile(files.receipt, `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}
