import assert from "node:assert/strict";
import { join } from "node:path";
import {
  StoryboardProject,
  renderShotFramePNG,
  createShotRenderSession,
  decodePixels,
} from "codeboard-studio";
import { make, rect, save } from "../../shared.ts";
import { sheet, report } from "../../shared/artifacts.ts";

export async function render(output: string): Promise<void> {
  const project = make("Transparent mesh coverage", 128, 128);
  project.configure({ canvas: { background: "transparent" } });
  const panel = project.addScene("Alpha").addShot("Mesh edge").addPanel({ durationFrames: 24 });
  const group = panel.addGroup("Surface", { transform: { x: 16, y: 24 } });
  rect(panel.addVectorLayer("Translucent fill", {}, group.id), 0, 0, 64, 64, "#c8501480");
  const captured = project.capturePanelAnimation(panel.id, { id: "animation:mesh-alpha" });
  const layerId = captured.identities.find((entry) => entry.sourceId === group.id)!.capturedId;
  const before = await renderShotFramePNG(project.shotAnimation(captured.animationId), 0);
  const vertices = [
    { x: 0, y: 0 },
    { x: 64, y: 0 },
    { x: 64, y: 64 },
    { x: 0, y: 64 },
  ];
  await project.save(join(output, "mesh-alpha.cboard"));
  const plan = project.plan("Bind transparent mesh", [
    {
      op: "animation.edit",
      id: captured.animationId,
      edits: [
        {
          op: "layer.mesh",
          layerId,
          mesh: {
            source: vertices,
            triangles: [
              [0, 1, 2],
              [0, 2, 3],
            ],
            keyframes: [
              { frame: 0, vertices, easing: "linear" },
              {
                frame: 23,
                vertices: vertices.map(({ x, y }) => ({ x: x + y / 2, y })),
                easing: "linear",
              },
            ],
          },
        },
      ],
    },
  ]);
  await project.commit(plan, { requestId: "mesh:alpha" });
  const reopened = await StoryboardProject.open(join(output, "mesh-alpha.cboard"));
  assert.equal((await reopened.commit(plan, { requestId: "mesh:alpha" })).replayed, true);
  const animation = reopened.shotAnimation(captured.animationId),
    session = createShotRenderSession(animation);
  const identity = await session.png(0),
    deformed = await session.png(23);
  assert.deepEqual(identity, before);
  const identityPixels = await decodePixels(identity);
  const alpha = Array.from(
    { length: 48 },
    (_, i) => identityPixels.pixels[((i + 32) * 128 + i + 24) * 4 + 3],
  );
  assert.ok(alpha.every((value) => value === 128));
  for (const frame of [23, 3, 12, 0, 3])
    assert.deepEqual(await session.png(frame), await renderShotFramePNG(animation, frame));
  await save(
    output,
    "mesh-alpha",
    reopened,
    await sheet("One translucent surface across triangle edges", [
      { label: "Unbound artwork", png: before },
      { label: "Identity mesh · same pixels", png: identity },
      { label: "Deformed surface", png: deformed },
    ]),
  );
  await report(output, "coverage", {
    identityPixelParity: true,
    sharedEdgeAlpha: alpha,
    backwardSeekParity: true,
    plan,
  });
}
