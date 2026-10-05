import { join } from "node:path";
import {
  StoryboardProject,
  createShotRenderSession,
  shotPointCoordinates,
  shotMeshData,
  shotControllerData,
  createControllerPerformance,
  compileControllerPerformance,
  captureShotController,
  reviseShotAnimation,
  exportShotProject,
  planShotHandoffMerge,
  createCurveMeshEvaluator,
  createSkinMeshEvaluator,
  matrixFromTransform,
  type EnvelopeMeshInput,
  type EnvelopeMeshPose,
  type CurveMeshInput,
  type MeshAnimation,
  type LayerSkinInput,
} from "codeboard-studio";
import { amber, blue, ink, make, rect, save } from "../../shared.ts";
import { report, sheet } from "../../shared/artifacts.ts";

export async function render(output: string): Promise<void> {
  const project = make("Nested mesh coordinates", 480, 320);
  const panel = project.addScene("Study").addShot("Mesh warp").addPanel({ durationFrames: 24 });
  const outer = panel.addGroup("Outer mesh", { transform: { x: 70, y: 35 } });
  const inner = panel.addGroup("Inner mesh", { transform: { x: 20, y: 20 } }, outer.id);
  const rootJoint = panel.addGroup("Skin root", { transform: { x: 20, y: 20 } }, outer.id);
  const tipJoint = panel.addGroup("Skin tip", { transform: { x: 100, y: 100 } }, rootJoint.id);
  const art = panel.addVectorLayer("Checker grid", { opacity: 0.8 }, inner.id);
  for (let row = 0; row < 5; row++)
    for (let column = 0; column < 5; column++)
      rect(art, column * 40, row * 40, 40, 40, (row + column) % 2 ? blue : amber);
  for (let line = 0; line <= 5; line++) {
    art.vectorStroke(
      [
        { x: line * 40, y: 0 },
        { x: line * 40, y: 200 },
      ],
      { width: 1, color: ink },
    );
    art.vectorStroke(
      [
        { x: 0, y: line * 40 },
        { x: 200, y: line * 40 },
      ],
      { width: 1, color: ink },
    );
  }
  const ribbon = panel.addGroup("Curve ribbon", { transform: { x: 375, y: 50 } });
  const ribbonArt = panel.addVectorLayer("Ribbon stripes", {}, ribbon.id);
  for (let row = 0; row < 9; row++) rect(ribbonArt, -12, row * 20, 24, 20, row % 2 ? ink : amber);
  const curveInput: CurveMeshInput = {
    rest: {
      curve: [
        { x: 0, y: 0 },
        { x: 0, y: 60 },
        { x: 0, y: 120 },
        { x: 0, y: 180 },
      ],
      width: 24,
    },
    segments: 32,
    keyframes: [
      {
        frame: 0,
        easing: "ease-in-out",
        width: 24,
        curve: [
          { x: 0, y: 0 },
          { x: 0, y: 60 },
          { x: 0, y: 120 },
          { x: 0, y: 180 },
        ],
      },
      {
        frame: 23,
        easing: "linear",
        width: 24,
        curve: [
          { x: 0, y: 0 },
          { x: 60, y: 50 },
          { x: -60, y: 130 },
          { x: 0, y: 180 },
        ],
      },
    ],
  };
  const captured = project.capturePanelAnimation(panel.id, { id: "animation:mesh-warp" });
  const capturedId = (id: string) => {
    const found = captured.identities.find((entry) => entry.sourceId === id);
    if (!found) throw new Error(`Missing captured mesh-study identity: ${id}`);
    return found.capturedId;
  };
  const outerId = capturedId(outer.id),
    innerId = capturedId(inner.id),
    artId = capturedId(art.id);
  const track = (
    width: number,
    height: number,
    vertices: MeshAnimation["source"],
  ): MeshAnimation => {
    const source = [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ];
    return {
      source,
      triangles: [
        [0, 1, 2],
        [0, 2, 3],
      ],
      keyframes: [
        { frame: 0, vertices: source, easing: "ease-in-out" },
        { frame: 23, vertices, easing: "linear" },
      ],
    };
  };
  const path = join(output, "mesh-warp.cboard");
  const edge = (x: number, y: number, endX: number, endY: number): EnvelopeMeshPose["top"] => [
    { x, y },
    { x: x + (endX - x) / 3, y: y + (endY - y) / 3 },
    { x: x + (2 * (endX - x)) / 3, y: y + (2 * (endY - y)) / 3 },
    { x: endX, y: endY },
  ];
  const restEnvelope: EnvelopeMeshPose = {
    top: edge(0, 0, 260, 0),
    bottom: edge(0, 240, 260, 240),
    left: edge(0, 0, 0, 240),
    right: edge(260, 0, 260, 240),
  };
  const envelopeInput: EnvelopeMeshInput = {
    rest: restEnvelope,
    columns: 8,
    rows: 8,
    keyframes: [
      { frame: 0, pose: restEnvelope, easing: "ease-in-out" },
      {
        frame: 23,
        easing: "linear",
        pose: {
          ...restEnvelope,
          top: [
            { x: 0, y: 0 },
            { x: 65, y: -30 },
            { x: 195, y: -30 },
            { x: 260, y: 0 },
          ],
        },
      },
    ],
  };
  await project.save(path);
  const plan = project.plan("Bind and animate nested mesh surfaces", [
    {
      op: "animation.edit",
      id: captured.animationId,
      edits: [
        { op: "layer.curve", layerId: capturedId(ribbon.id), curve: curveInput },
        {
          op: "layer.envelope",
          layerId: outerId,
          envelope: envelopeInput,
        },
        {
          op: "layer.mesh",
          layerId: innerId,
          mesh: track(200, 200, [
            { x: 0, y: 0 },
            { x: 180, y: 30 },
            { x: 220, y: 180 },
            { x: 10, y: 200 },
          ]),
        },
      ],
    },
  ]);
  const committed = await project.commit(plan, { requestId: "study:mesh-bind" });
  const reopened = await StoryboardProject.open(path);
  const replayed = await reopened.commit(plan, { requestId: "study:mesh-bind" });
  const innerMesh = reopened
    .shotAnimation(captured.animationId)
    .meshes?.find((binding) => binding.layerId === innerId)?.mesh;
  if (!innerMesh) throw new Error("Mesh study is missing its inner vertex binding");
  const skin: LayerSkinInput = {
    jointLayers: [
      { jointId: "root", layerId: capturedId(rootJoint.id) },
      { jointId: "tip", layerId: capturedId(tipJoint.id) },
    ],
    source: innerMesh.source,
    triangles: innerMesh.triangles,
    joints: [
      { id: "root", bind: matrixFromTransform({}) },
      { id: "tip", bind: matrixFromTransform({ x: 100, y: 100 }) },
    ],
    weights: [
      [{ jointId: "root", weight: 1 }],
      [{ jointId: "tip", weight: 1 }],
      [
        { jointId: "tip", weight: 0.75 },
        { jointId: "root", weight: 0.25 },
      ],
      [{ jointId: "root", weight: 1 }],
    ],
  };
  const { jointLayers: _jointLayers, ...skinGeometry } = skin;
  const evaluateSkin = createSkinMeshEvaluator(skinGeometry);
  const skinnedPose = evaluateSkin([
    { jointId: "root", matrix: matrixFromTransform({}) },
    { jointId: "tip", matrix: matrixFromTransform({ x: 100, y: 100, rotation: 0.18 }) },
  ]);
  const posePlan = reopened.plan("Revise the middle mesh pose", [
    {
      op: "animation.edit",
      id: captured.animationId,
      edits: [
        { op: "layer.skin", layerId: innerId, skin },
        { op: "layer.skin.bind.capture", layerId: innerId, frame: 0 },
        {
          op: "layer.skin.weights.put",
          layerId: innerId,
          vertexIndex: 2,
          influences: [
            { jointId: "tip", weight: 0.6 },
            { jointId: "root", weight: 0.4 },
          ],
        },
        {
          op: "controller.put",
          controller: {
            id: "controller:skin-bend",
            name: "Bend",
            mode: "additive",
            weight: 0,
            targets: [
              { layerId: capturedId(tipJoint.id), values: { rotation: 0.18 } },
              { layerId: artId, values: { opacity: -0.1 } },
            ],
            keyframes: [],
          },
        },
        ...([0, 12, 23] as const).map((frame) => ({
          op: "controller.key.put" as const,
          id: "controller:skin-bend",
          key: { frame, weight: frame === 12 ? 1 : 0, easing: "ease-in-out" as const },
        })),
        {
          op: "layer.curve.key.put",
          layerId: capturedId(ribbon.id),
          key: {
            frame: 12,
            width: 24,
            easing: "ease-in-out",
            curve: [
              { x: 0, y: 0 },
              { x: -35, y: 55 },
              { x: 35, y: 125 },
              { x: 0, y: 180 },
            ],
          },
        },
        {
          op: "layer.envelope.key.put",
          layerId: outerId,
          key: { ...envelopeInput.keyframes[1]!, frame: 12, easing: "ease-in-out" },
        },
        { op: "layer.deformation.rest.apply", layerId: outerId, frame: 23 },
        { op: "layer.deformation.rest.apply", layerId: capturedId(ribbon.id), frame: 23 },
      ],
    },
  ]);
  const poseReceipt = await reopened.commit(posePlan, { requestId: "study:mesh-pose" });
  const transferProject = await StoryboardProject.open(path);
  const transferSource = transferProject.shotAnimation(captured.animationId);
  const capturedPose = captureShotController(transferSource, {
    id: "controller:captured-pose",
    name: "Captured bend correction",
    mode: "additive",
    frame: 12,
    referenceFrame: 0,
    evaluation: "controlled",
    targets: [{ layerId: capturedId(tipJoint.id), channels: ["rotation"] }],
  });
  const removeOriginal = { op: "controller.remove" as const, id: "controller:skin-bend" };
  const performance = createControllerPerformance(transferSource, {
    id: "performance:bend",
    name: "Bend performance",
    controllerIds: ["controller:skin-bend"],
  });
  await report(output, "controller-performance", performance);
  const transferEdits = compileControllerPerformance(
    JSON.parse(JSON.stringify(performance)),
    reviseShotAnimation(transferSource, [removeOriginal]),
    {
      controllers: [{ sourceId: "controller:skin-bend", targetId: "controller:transferred-bend" }],
      layers: [
        { sourceId: capturedId(tipJoint.id), targetId: capturedId(tipJoint.id) },
        { sourceId: artId, targetId: artId },
      ],
      frameOffset: 0,
      sourceRange: { startFrame: 0, endFrame: 24 },
    },
  );
  const transferPlan = transferProject.plan("Transfer controller identity with explicit targets", [
    {
      op: "animation.edit",
      id: captured.animationId,
      edits: [removeOriginal, ...transferEdits, { op: "controller.put", controller: capturedPose }],
    },
  ]);
  const transferReceipt = await transferProject.commit(transferPlan, {
    requestId: "study:controller-transfer",
  });
  const final = await StoryboardProject.open(path);
  const destinationShot = final.scene(final.toJSON().scenes[0]!.id).addShot("Reused rig");
  await final.save(path);
  const duplicatePlan = final.plan("Reuse the complete rig in a new shot", [
    {
      op: "animation.duplicate",
      sourceAnimationId: captured.animationId,
      id: "mesh-rig-copy",
      shotId: destinationShot.id,
      name: "Independent rig copy",
    },
  ]);
  const duplicateReceipt = await final.commit(duplicatePlan, { requestId: "study:rig-copy" });
  const duplicated = await StoryboardProject.open(path);
  const copiedAnimation = duplicated.shotAnimation("mesh-rig-copy");
  const copiedSession = createShotRenderSession(copiedAnimation);
  const handoff = await exportShotProject(
    path,
    copiedAnimation.id,
    join(output, "rig-handoff.cboard"),
    {
      projectId: "mesh-rig-handoff",
      expectedVersion: duplicated.version,
    },
  );
  const handedOff = await StoryboardProject.open(handoff.path);
  const handoffSession = createShotRenderSession(handedOff.shotAnimation(copiedAnimation.id));
  const handoffBase = StoryboardProject.fromJSON(duplicated.toJSON());
  const copyRoot = copiedAnimation.layers[0]!;
  handedOff.editShotAnimation(copiedAnimation.id, [
    { op: "layer.set", layerId: copyRoot.id, changes: { opacity: 0.9 } },
  ]);
  await handedOff.save(handoff.path);
  duplicated.editShotAnimation(copiedAnimation.id, [
    {
      op: "layer.set",
      layerId: copyRoot.id,
      changes: { transform: { ...copyRoot.transform, x: copyRoot.transform.x + 6 } },
    },
  ]);
  await duplicated.save(path);
  const workerResult = await StoryboardProject.open(handoff.path);
  const merge = planShotHandoffMerge(duplicated, handoffBase, workerResult, {
    animationId: copiedAnimation.id,
  });
  if (!merge.plan) throw new Error("Mesh handoff study requires an independent merge");
  const mergeReceipt = await duplicated.commit(merge.plan, {
    requestId: "study:rig-handoff-merge",
  });
  const assembled = await StoryboardProject.open(path);
  const assembledSession = createShotRenderSession(assembled.shotAnimation(copiedAnimation.id));
  const animation = final.shotAnimation(captured.animationId);
  const session = createShotRenderSession(animation);
  const savedCurve = animation.meshes?.find(
    (binding) => binding.layerId === capturedId(ribbon.id),
  )?.curve;
  if (!savedCurve) throw new Error("Mesh study is missing its saved curve recipe");
  const evaluateCurve = createCurveMeshEvaluator(savedCurve);
  const point = { x: 60, y: 35 };
  const samples = [],
    coordinates = [];
  for (const frame of [0, 12, 23]) {
    const forward = shotPointCoordinates(animation, artId, point, {
      direction: "localToFrame",
      frame,
    });
    coordinates.push({
      frame,
      source: point,
      forward,
      inverse: forward.candidates.map((candidate) =>
        shotPointCoordinates(animation, artId, candidate.point, {
          direction: "frameToLocal",
          frame,
        }),
      ),
    });
    samples.push({
      label: `Nested mesh / frame ${frame}`,
      png: await session.png(frame),
    });
    samples.push({
      label: `Independent rig copy / frame ${frame}`,
      png: await copiedSession.png(frame),
    });
    samples.push({
      label: `Isolated handoff / frame ${frame}`,
      png: await handoffSession.png(frame),
    });
    samples.push({
      label: `Worker opacity + local placement / frame ${frame}`,
      png: await assembledSession.png(frame),
    });
  }
  await save(
    output,
    "mesh-warp",
    assembled,
    await sheet("Persisted nested mesh and rig copy", samples),
  );
  await report(output, "mesh-coordinates", {
    duplicatePlan,
    duplicateReceipt,
    handoff,
    merge,
    mergeReceipt,
    copiedRig: {
      animationId: copiedAnimation.id,
      meshes: copiedAnimation.meshes,
      controllers: copiedAnimation.controllers,
    },
    skinnedPose,
    controllerInspection: shotControllerData(animation, "controller:transferred-bend", {
      collection: "targets",
      frame: 12,
    }),
    controllers: animation.controllers,
    envelopeInput,
    controlCurveSamples: [23, 0, 12].map((frame) => ({
      frame,
      vertices: evaluateCurve(frame).destination,
    })),
    curveInput,
    inspection: {
      keys: shotMeshData(animation, innerId),
      joints: shotMeshData(animation, innerId, { collection: "joints" }),
      weights: shotMeshData(animation, innerId, { collection: "weights" }),
      topology: shotMeshData(animation, innerId, { collection: "triangles" }),
      bind: shotMeshData(animation, innerId, { collection: "vertices" }),
      middlePose: shotMeshData(animation, innerId, { collection: "vertices", frame: 12 }),
    },
    performance,
    capturedPose,
    transferPlan,
    transferReceipt,
    posePlan,
    poseReceipt,
    plan,
    committed,
    replayed,
    meshes: animation.meshes,
    coordinates,
  });
}
