import { join } from "node:path";
import { StoryboardProject } from "codeboard-studio";
import { author } from "../studies/animation/controller-exchange/author.ts";
import {
  addDialogue,
  verifyPerformance,
} from "../studies/animation/controller-exchange/performance.ts";
import { bindArms } from "../studies/animation/controller-exchange/deformation.ts";

export async function prepare(output: string) {
  const { project, shots } = author("workload");
  const source = join(output, "workload.cboard");
  await project.save(source);
  await project.commit(
    project.plan(
      "Workload controllers",
      shots.map((shot) => ({
        op: "animation.edit",
        id: shot.animationId,
        edits: shot.controllers.map((controller) => ({ op: "controller.put", controller })),
      })),
    ),
    { requestId: "workload:controllers" },
  );
  await addDialogue(project, shots);
  await bindArms(project, shots);
  const reopened = await StoryboardProject.open(source);
  verifyPerformance(reopened, shots);
  return { project: reopened, source, shots };
}
