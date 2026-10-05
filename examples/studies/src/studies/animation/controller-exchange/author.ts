import type { ShotController } from "codeboard-studio";
import { make, rect, ink, amber, blue } from "../../../shared.ts";
import { character } from "./characters.ts";

export function author(profile: "study" | "workload" = "study") {
  const durationFrames = profile === "workload" ? 180 : 24;
  const cycles = profile === "workload" ? 6 : 1;
  const middle = Math.floor(durationFrames / 2);
  const last = durationFrames - 1;
  const project = make("Four-shot controller exchange");
  project.putPalette({
    id: "palette:exchange",
    name: "Character clothes",
    swatches: [
      { id: "swatch:sender", name: "Sender", color: blue },
      { id: "swatch:receiver", name: "Receiver", color: amber },
    ],
  });
  const scene = project.addScene("A card changes hands");
  const stages = ["Notice", "Offer", "Receive", "Settle"];
  const shots = [];
  for (let index = 0; index < stages.length * cycles; index++) {
    const stage = index % stages.length;
    const name = `${stages[stage]}${cycles > 1 ? ` ${Math.floor(index / 4) + 1}` : ""}`;
    const panel = scene.addShot(name).addPanel({ title: name, durationFrames });
    rect(panel.addVectorLayer("Ground"), 30, 195, 300, 2, ink);
    const left = character(panel, "Sender", 122, blue, "left");
    const right = character(panel, "Receiver", 238, amber, "right");
    for (const [actor, swatchId] of [
      [left, "swatch:sender"],
      [right, "swatch:receiver"],
    ] as const) {
      project.setColorBinding(actor.coat, "fill", { swatchId });
      project.setColorBinding(actor.cuff, "fill", {
        swatchId,
        ...(actor === right ? { override: amber } : {}),
      });
      project.production.setDrawingSequence(actor.mouth.id, [
        { frame: index * durationFrames, drawingId: actor.rest.id },
      ]);
    }
    const prop = panel.addGroup("Card", {
      transform: { x: [136, 136, 180, 188][stage]!, y: [177, 177, 137, 137][stage]! },
    });
    rect(panel.addVectorLayer("Card artwork", {}, prop.id), -8, -5, 16, 10, "#f5d352");
    for (const [frame, y] of [
      [0, 195],
      [middle, 192],
      [last, 195],
    ] as const)
      project.production.addLayerKeyframe(left.root.id, index * durationFrames + frame, {
        transform: { y },
        easing: "linear",
      });
    const captured = project.capturePanelAnimation(panel.id, { id: `animation:exchange-${index}` });
    const id = (sourceId: string) =>
      captured.identities.find((entry) => entry.sourceId === sourceId)!.capturedId;
    const controller = (
      suffix: string,
      layerId: string,
      values: ShotController["targets"][number]["values"],
      mode: ShotController["mode"],
      weights: [number, number, number],
    ): ShotController => ({
      id: `controller:${index}:${suffix}`,
      name: suffix,
      mode,
      weight: 0,
      targets: [{ layerId: id(layerId), values }],
      keyframes: weights.map((weight, i) => ({
        frame: [0, middle, last][i]!,
        weight,
        easing: "ease-in-out",
      })),
    });
    const controllers = [
      controller(
        "sender reach",
        left.arm.id,
        { rotation: -Math.PI / 2 },
        "replace",
        stage === 1 ? [0, 1, 1] : stage === 2 ? [1, 1, 0] : [0, 0, 0],
      ),
      controller(
        "receiver reach",
        right.arm.id,
        { rotation: Math.PI / 2 },
        "replace",
        stage === 2 ? [0, 1, 1] : stage === 3 ? [1, 0, 0] : [0, 0, 0],
      ),
      controller(
        "sender lean",
        left.root.id,
        { x: 10 },
        "additive",
        stage === 1 ? [0, 1, 1] : stage === 2 ? [1, 1, 0] : [0, 0, 0],
      ),
      controller(
        "receiver lean",
        right.root.id,
        { x: -10 },
        "additive",
        stage === 2 ? [0, 1, 0] : [0, 0, 0],
      ),
      controller(
        "card travel",
        prop.id,
        { x: [0, 44, 8, 36][stage]!, y: [0, -40, 0, 40][stage]! },
        "additive",
        stage === 0 ? [0, 0, 0] : stage === 2 ? [0, 0, 1] : [0, 1, 1],
      ),
    ];
    shots.push({
      animationId: captured.animationId,
      name,
      durationFrames,
      controllers,
      mouths: [left, right].map((actor, speaker) => ({
        layerId: id(actor.mouth.id),
        restId: id(actor.rest.id),
        openId: id(actor.open.id),
        speaking: stage === speaker + 1,
      })),
      receiverCuff: id(right.cuff),
      arms: [id(left.arm.id), id(right.arm.id)],
      baseLayers: project.shotAnimation(captured.animationId).layers,
    });
  }
  project.putEditorialSequence({
    id: "edit:exchange",
    frameRate: { numerator: 24, denominator: 1 },
    clips: shots.map((shot, index) => ({
      id: `clip:exchange-${index}`,
      animationId: shot.animationId,
      startFrame: index * durationFrames,
      sourceInFrame: 0,
      durationFrames,
      transition: { type: "cut", durationFrames: 0 },
    })),
  });
  return { project, shots };
}
