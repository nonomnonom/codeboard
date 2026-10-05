import type { EditCommand, EditPlan } from "codeboard-studio";
import { StoryboardProject, renderPanelPNG } from "codeboard-studio";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { actor } from "../config.ts";
import { isDeepStrictEqual } from "node:util";
export async function revise(
  projectPath: string,
  panelId: string,
  planPath: string,
  dialogue: string,
) {
  const project = await StoryboardProject.open(projectPath, { actor });
  project.panel(panelId);
  const commands: EditCommand[] = [
    { op: "panel.revise", id: panelId, changes: { dialogue } },
    { op: "panel.status", id: panelId, status: "review" },
  ];
  let input: unknown;
  try {
    input = JSON.parse(await readFile(planPath, "utf8"));
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    input = project.plan("Revise dialogue for review", commands);
    await writeFile(planPath, JSON.stringify(input, null, 2), { flag: "wx" });
  }
  // Check invocation identity here; commit owns complete schema/digest/base validation.
  if (
    !input ||
    typeof input !== "object" ||
    !("digest" in input) ||
    typeof input.digest !== "string" ||
    !("commands" in input) ||
    !isDeepStrictEqual(input.commands, commands)
  ) {
    throw new Error(
      "The persisted plan does not match this request. Use its original arguments or a new plan path.",
    );
  }
  const result = await project.commit(input as EditPlan, { requestId: `dialogue:${input.digest}` });
  const current = await StoryboardProject.open(projectPath);
  await writeFile(`${planPath}.png`, await renderPanelPNG(current, panelId));
  return { ...result, evidence: resolve(`${planPath}.png`), visualReview: "pending" };
}
