import assert from "node:assert/strict";
import {
  evaluateDrawing,
  planShotLipSync,
  type StoryboardProject,
  type Layer,
} from "codeboard-studio";
import type { author } from "./author.ts";
import { amber } from "../../../shared.ts";

type Shots = ReturnType<typeof author>["shots"];

export async function addDialogue(project: StoryboardProject, shots: Shots) {
  const receipts = [];
  for (const shot of shots) {
    for (const mouth of shot.mouths.filter((entry) => entry.speaking)) {
      const plan = planShotLipSync(project, shot.animationId, mouth.layerId, {
        startFrame: 0,
        endFrame: 24,
        mouths: { open: mouth.openId },
        restDrawingId: mouth.restId,
        cues: [{ startFrame: 4, endFrame: 18, mouth: "open" }],
        corrections: [{ startFrame: 10, endFrame: 13, drawingId: mouth.restId }],
      });
      const requestId = `dialogue:${shot.animationId}`;
      receipts.push({ plan, requestId, receipt: await project.commit(plan, { requestId }) });
    }
  }
  return receipts;
}

export function verifyPerformance(project: StoryboardProject, shots: Shots) {
  for (const shot of shots) {
    const animation = project.shotAnimation(shot.animationId);
    assert.deepEqual(animation.controllers, shot.controllers);
    const verifyKeys = (layers: Layer[]) => {
      for (const layer of layers) {
        assert.deepEqual(project.production.layer(layer.id).keyframes, layer.keyframes);
        if (layer.kind === "group") verifyKeys(layer.children);
      }
    };
    verifyKeys(shot.baseLayers);
    for (const mouth of shot.mouths) {
      const layer = project.production.layer(mouth.layerId);
      if (layer.kind !== "group") throw new Error("Mouth must remain an editable drawing group");
      for (const frame of [0, 4, 10, 12, 13, 18, 23]) {
        const open = mouth.speaking && frame >= 4 && frame < 18 && !(frame >= 10 && frame < 13);
        assert.equal(
          evaluateDrawing(layer.drawingSequence, frame),
          open ? mouth.openId : mouth.restId,
        );
      }
    }
    assert.equal(
      project.production.element(shot.receiverCuff).colorBindings?.fill?.override,
      amber,
    );
  }
}
