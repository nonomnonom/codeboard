import { expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  StoryboardProject,
  createShotRenderSession,
  pathCommands,
  renderShotFramePNG,
  reviseShotAnimation,
  shotPointCoordinates,
  type ShotAnimationEdit,
} from "../../../../src/index.js";
import { line, ribbon, envelope, source, triangles } from "./fixture.js";

it.each(["curve", "envelope", "skin"] as const)(
  "persists %s deformation with masks, shared transforms, seek parity and bind/rest recovery",
  async (kind) => {
    const directory = await mkdtemp(join(tmpdir(), "codeboard-deformation-"));
    try {
      const project = StoryboardProject.create({
        title: kind,
        width: 96,
        height: 64,
        background: "transparent",
      });
      const panel = project.addScene("S").addShot("S").addPanel({ durationFrames: 24 });
      const parent = panel.addGroup("Shared space", { transform: { x: 20, y: 12, scaleX: 2 } });
      const group = panel.addGroup("Surface", { transform: { x: 4, y: 3 } }, parent.id);
      const joint = panel.addGroup("Joint", { transform: { x: 4, y: 3 } }, parent.id);
      const mask = panel.addVectorLayer("Mask", { visible: false }, group.id);
      mask.path(pathCommands("M -4 0 L 2 0 L 2 30 L -4 30 Z"), { fill: "white" });
      const art = panel.addVectorLayer("Paint", { maskLayerId: mask.id }, group.id);
      art.path(pathCommands("M -4 0 L 4 0 L 4 30 L -4 30 Z"), { fill: "#d05020" });
      const captured = project.capturePanelAnimation(panel.id, { id: `animation:${kind}` });
      const mapped = (id: string) =>
        captured.identities.find((entry) => entry.sourceId === id)!.capturedId;
      const layerId = mapped(group.id);
      const base = project.shotAnimation(captured.animationId);
      const before = await renderShotFramePNG(base, 0);
      const edits: ShotAnimationEdit[] =
        kind === "curve"
          ? [
              {
                op: "layer.curve",
                layerId,
                curve: {
                  rest: ribbon,
                  segments: 2,
                  keyframes: [
                    { ...ribbon, frame: 0, easing: "linear" },
                    { width: 8, curve: line(8, 4, 0, 30), frame: 20, easing: "linear" },
                  ],
                },
              },
            ]
          : kind === "envelope"
            ? [
                {
                  op: "layer.envelope",
                  layerId,
                  envelope: {
                    rest: envelope,
                    columns: 2,
                    rows: 2,
                    keyframes: [
                      { pose: envelope, frame: 0, easing: "linear" },
                      {
                        pose: {
                          top: line(4, 4, 8, 0),
                          bottom: line(4, 34, 8, 0),
                          left: line(4, 4, 0, 30),
                          right: line(12, 4, 0, 30),
                        },
                        frame: 20,
                        easing: "linear",
                      },
                    ],
                  },
                },
              ]
            : [
                {
                  op: "layer.skin",
                  layerId,
                  skin: {
                    source,
                    triangles,
                    joints: [{ id: "joint", bind: [1, 0, 0, 1, 0, 0] }],
                    jointLayers: [{ jointId: "joint", layerId: mapped(joint.id) }],
                    weights: source.map(() => [{ jointId: "joint", weight: 1 }]),
                  },
                },
                {
                  op: "controller.put",
                  controller: {
                    id: "controller:joint",
                    name: "Reach",
                    mode: "additive",
                    weight: 0,
                    targets: [{ layerId: mapped(joint.id), values: { x: 8, y: 4 } }],
                    keyframes: [
                      { frame: 0, weight: 0, easing: "linear" },
                      { frame: 20, weight: 1, easing: "linear" },
                    ],
                  },
                },
              ];
      const file = join(directory, "deformation.cboard");
      await project.save(file);
      const plan = project.plan("Bind surface", [
        { op: "animation.edit", id: captured.animationId, edits },
      ]);
      await project.commit(plan, { requestId: "bind" });
      const reopened = await StoryboardProject.open(file);
      expect((await reopened.commit(plan, { requestId: "bind" })).replayed).toBe(true);
      const animation = reopened.shotAnimation(captured.animationId);
      const session = createShotRenderSession(animation);
      expect(await session.png(0)).toEqual(before);
      const reference = structuredClone(base);
      const referenceParent = reference.layers[0]!;
      if (referenceParent.kind !== "group" || referenceParent.children[0]!.kind !== "group")
        throw new Error("Missing surface");
      referenceParent.children[0]!.transform.x += 8;
      referenceParent.children[0]!.transform.y += 4;
      expect(await session.png(20)).toEqual(await renderShotFramePNG(reference, 20));
      for (const frame of [20, 3, 12, 0, 3])
        expect(await session.png(frame)).toEqual(await renderShotFramePNG(animation, frame));
      const forward = shotPointCoordinates(
        animation,
        mapped(art.id),
        { x: 0, y: 12 },
        { direction: "localToFrame", camera: false, frame: 20 },
      );
      expect(forward.candidates[0]!.point.x).toBeCloseTo(44);
      expect(forward.candidates[0]!.point.y).toBeCloseTo(31);
      const inverse = shotPointCoordinates(
        animation,
        mapped(art.id),
        forward.candidates[0]!.point,
        { direction: "frameToLocal", camera: false, frame: 20 },
      );
      expect(inverse.candidates[0]!.point.x).toBeCloseTo(0);
      expect(inverse.candidates[0]!.point.y).toBeCloseTo(12);
      const recovery: ShotAnimationEdit =
        kind === "skin"
          ? { op: "layer.skin.bind.capture", layerId, frame: 20 }
          : { op: "layer.deformation.rest.apply", layerId, frame: 20 };
      const restored = reviseShotAnimation(animation, [recovery]);
      expect(await renderShotFramePNG(restored, 20)).toEqual(before);
      const snapshot = structuredClone(animation);
      expect(() =>
        reviseShotAnimation(animation, [
          recovery,
          { op: "layer.mesh.key.remove", layerId, frame: 99 },
        ]),
      ).toThrow();
      expect(animation).toEqual(snapshot);
      if (kind === "curve") {
        const oversized = structuredClone(animation);
        oversized.layers[0]!.transform.scaleX = 100000;
        await expect(renderShotFramePNG(oversized, 0)).rejects.toMatchObject({
          code: "RESOURCE_LIMIT",
          details: { reason: "SURFACE_PIXEL_LIMIT" },
        });
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);
