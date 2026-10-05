import { isDeepStrictEqual } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
import { StoryboardProject, type EditPlan, type EditCommand } from "codeboard-studio";
import { config, paths } from "../config.ts";

export async function revise(directory = config.output) {
  const files = paths(directory);
  const project = await StoryboardProject.open(files.project);
  const commands: EditCommand[] = [
    {
      op: "editorial.edit",
      id: config.sequenceId,
      edits: [
        { op: "move", id: "cut-1", beforeId: "cut-0" },
        { op: "update", id: "cut-1", changes: { durationFrames: 132 } },
        { op: "update", id: "cut-0", changes: { sourceInFrame: 12, durationFrames: 108 } },
      ],
    },
  ];
  let plan: unknown;
  try {
    plan = JSON.parse(await readFile(files.plan, "utf8"));
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    plan = project.plan("Reorder cuts and adjust the cut point, retaining ten seconds", commands);
    await writeFile(files.plan, `${JSON.stringify(plan, null, 2)}\n`, { flag: "wx" });
  }
  if (
    !plan ||
    typeof plan !== "object" ||
    !("commands" in plan) ||
    !isDeepStrictEqual(plan.commands, commands)
  )
    throw new Error("The persisted plan does not match this revision; inspect it before retrying");
  const receipt = await project.commit(plan as EditPlan, { requestId: "studio-timing-cut-v1" });
  await writeFile(files.receipt, `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}
