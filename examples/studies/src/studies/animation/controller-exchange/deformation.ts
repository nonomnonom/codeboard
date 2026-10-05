import assert from "node:assert/strict";
import { renderShotFramePNG, type CurveMeshInput, type StoryboardProject } from "codeboard-studio";
import type { author } from "./author.ts";

export async function bindArms(
  project: StoryboardProject,
  shots: ReturnType<typeof author>["shots"],
) {
  const pose = (bend: number): CurveMeshInput["rest"] => ({
    width: 12,
    curve: [
      { x: 0, y: 0 },
      { x: bend, y: 14 },
      { x: bend, y: 28 },
      { x: 0, y: 42 },
    ],
  });
  const bindings = shots.map((shot, index) => ({
    animationId: shot.animationId,
    arms: shot.arms.map((layerId, side) => ({
      layerId,
      curve: {
        rest: pose(0),
        segments: 14,
        keyframes: [
          { ...pose(0), frame: 0, easing: "ease-in-out" },
          {
            ...pose((side === 0 ? 1 : -1) * (index === 0 ? 2 : 6)),
            frame: Math.floor(shot.durationFrames / 2),
            easing: "ease-in-out",
          },
          { ...pose(0), frame: shot.durationFrames - 1, easing: "linear" },
        ],
      } satisfies CurveMeshInput,
    })),
  }));
  const before = await Promise.all(
    shots.map(async (shot) => ({
      rest: await renderShotFramePNG(project.shotAnimation(shot.animationId), 0),
      bent: await renderShotFramePNG(
        project.shotAnimation(shot.animationId),
        Math.floor(shot.durationFrames / 2),
      ),
    })),
  );
  const plan = project.plan(
    "Bend arms underneath reach controllers",
    bindings.map((shot) => ({
      op: "animation.edit",
      id: shot.animationId,
      edits: shot.arms.map(({ layerId, curve }) => ({ op: "layer.curve", layerId, curve })),
    })),
  );
  const requestId = "exchange:arm-curves";
  const receipt = await project.commit(plan, { requestId });
  for (const [index, shot] of shots.entries()) {
    const animation = project.shotAnimation(shot.animationId);
    assert.deepEqual(await renderShotFramePNG(animation, 0), before[index]!.rest);
    assert.notDeepEqual(
      await renderShotFramePNG(animation, Math.floor(shot.durationFrames / 2)),
      before[index]!.bent,
    );
  }
  return { plan, requestId, receipt, bindings };
}
