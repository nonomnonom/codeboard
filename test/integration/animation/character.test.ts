import { expect, it, onTestFinished } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  StoryboardProject,
  brushes,
  pathCommands,
  renderShotFramePNG,
  type CharacterInstanceOptions,
  type Layer,
} from "../../../src/index.js";
import { fixture as componentFixture } from "../authoring/component-upgrade/fixture.js";
import { cli } from "../authoring/edit-plan/fixture.js";

function layers(tree: Layer[]): Layer[] {
  return tree.flatMap((layer) => [
    layer,
    ...(layer.kind === "group" ? layers(layer.children) : []),
  ]);
}

function fixture() {
  const project = StoryboardProject.create({
    title: "Character reuse",
    width: 96,
    height: 64,
    frameRate: 24,
  });
  let rootId = "",
    faceId = "",
    bankId = "",
    armId = "",
    elbowId = "",
    inkId = "";
  const scene = project.addScene("Studio");
  const panel = scene.addShot("Master").addPanel({ durationFrames: 24 });
  project.transaction("Master with editable drawings, IK and textured reveal", () => {
    const environment = panel.addVectorLayer("Set stays in the master");
    environment.path(pathCommands("M 70 0 L 96 0 L 96 64 L 70 64 Z"), { fill: "#d5ccbd" });
    const root = panel.addGroup("Clawd rig", { transform: { x: 24, y: 34 } });
    rootId = root.id;
    const bank = panel.addGroup("Eye drawings", {}, root.id);
    bankId = bank.id;
    const face = panel.addVectorLayer("Neutral", {}, bank.id);
    faceId = face.id;
    face.path(pathCommands("M 0 0 L 8 0 L 8 8 L 0 8 Z"), { fill: "#f58836" });
    const blink = panel.addVectorLayer("Blink", {}, bank.id);
    blink.path(pathCommands("M 0 4 L 8 4 L 8 6 L 0 6 Z"), { fill: "#191915" });
    project.production.setDrawingSequence(bank.id, [
      { frame: 0, drawingId: face.id },
      { frame: 8, drawingId: blink.id },
      { frame: 12, drawingId: face.id },
    ]);
    const arm = panel.addGroup("Shoulder", { transform: { x: 8 } }, root.id);
    armId = arm.id;
    const elbow = panel.addGroup("Elbow", { transform: { x: 9 } }, arm.id);
    elbowId = elbow.id;
    panel.addVectorLayer("Upper arm", {}, arm.id).vectorStroke(
      [
        { x: 0, y: 0 },
        { x: 9, y: 0 },
      ],
      { color: "#191915", width: 2 },
    );
    panel.addVectorLayer("Forearm", {}, elbow.id).vectorStroke(
      [
        { x: 0, y: 0 },
        { x: 7, y: 0 },
      ],
      { color: "#191915", width: 2 },
    );
    project.production.setTwoBoneRig(arm.id, { elbowId: elbow.id, upperLength: 9, lowerLength: 7 });
    const ink = panel.addRasterLayer(
      "Seeded texture",
      { exposure: { startFrame: 2, endFrame: 22 } },
      root.id,
    );
    inkId = ink.id;
    ink.rasterStroke(
      [
        { x: -5, y: -5 },
        { x: 10, y: -5 },
      ],
      brushes.roughPencil,
      { color: "#b94c3d", seed: 6, reveal: { startFrame: 2, endFrame: 10 } },
    );
    project.production.addLayerKeyframe(root.id, 0, { transform: { x: 24 }, easing: "linear" });
    project.production.addLayerKeyframe(root.id, 23, { transform: { x: 28 }, easing: "linear" });
  });
  const capture = project.capturePanelAnimation(panel.id, { id: "animation:master" });
  const mapped = (id: string) =>
    capture.identities.find((entry) => entry.sourceId === id)!.capturedId;
  rootId = mapped(rootId);
  faceId = mapped(faceId);
  bankId = mapped(bankId);
  armId = mapped(armId);
  elbowId = mapped(elbowId);
  inkId = mapped(inkId);
  project.editShotAnimation(capture.animationId, [
    { op: "layer.rig.rest.capture", layerId: armId, frame: 0 },
    {
      op: "controller.put",
      controller: {
        id: "controller:look",
        name: "Look",
        mode: "additive",
        weight: 0,
        activeRange: { startFrame: 4, endFrame: 20 },
        targets: [{ layerId: bankId, values: { y: -4 } }],
        keyframes: [
          { frame: 0, weight: 0, easing: "linear" },
          { frame: 12, weight: 1, easing: "linear" },
        ],
      },
    },
    {
      op: "layer.mesh",
      layerId: faceId,
      mesh: {
        source: [
          { x: 0, y: 0 },
          { x: 8, y: 0 },
          { x: 0, y: 8 },
        ],
        triangles: [[0, 1, 2]],
        keyframes: [
          {
            frame: 0,
            vertices: [
              { x: 0, y: 0 },
              { x: 8, y: 0 },
              { x: 0, y: 8 },
            ],
            easing: "linear",
          },
          {
            frame: 23,
            vertices: [
              { x: 0, y: 0 },
              { x: 9, y: 0 },
              { x: 0, y: 8 },
            ],
            easing: "linear",
          },
        ],
      },
    },
  ]);
  const targetShot = scene.addShot("Existing shot");
  project.putShotAnimation({
    id: "animation:target",
    shotId: targetShot.id,
    name: "Destination",
    frameRate: { numerator: 24, denominator: 1 },
    durationFrames: 48,
    canvas: { width: 96, height: 64, background: "#eeddbb" },
    layers: [],
    cameraKeyframes: [
      { id: "camera:target", frame: 0, x: 0, y: 0, zoom: 1, rotation: 0, easing: "linear" },
    ],
  });
  const options: CharacterInstanceOptions = {
    id: "character:first",
    rootLayerId: rootId,
    targetAnimationId: "animation:target",
    frameOffset: 12,
  };
  return { project, options, rootId, bankId, faceId, armId, elbowId, inkId };
}

it("inserts only the character with remapped editable rig, substitutions, controllers, textures and deformation", async () => {
  const { project, options, rootId, bankId, armId, elbowId, inkId } = fixture();
  const master = project.shotAnimation("animation:master"),
    target = project.shotAnimation(options.targetAnimationId);
  const set = structuredClone(master.layers[0]!);
  set.id = "layer:existing-set";
  if (set.kind === "group") throw new Error("Expected set paint");
  set.elements[0]!.id = "element:existing-set";
  target.layers.push(set);
  target.controllers = [
    {
      id: "controller:existing-set",
      name: "Set lighting",
      mode: "additive",
      weight: 1,
      targets: [{ layerId: set.id, values: { opacity: -0.1 } }],
      keyframes: [],
    },
  ];
  project.putShotAnimation(target);
  const result = project.instantiateShotCharacter(master.id, options);
  const mapping = new Map(result.identities.map((entry) => [entry.sourceId, entry.copyId]));
  expect(new Set(mapping.values()).size).toBe(result.identities.length);
  for (const entry of result.identities) expect(entry.copyId).not.toBe(entry.sourceId);
  const after = project.shotAnimation(target.id);
  expect(after.canvas).toEqual(target.canvas);
  expect(after.cameraKeyframes).toEqual(target.cameraKeyframes);
  expect(project.shotAnimation(master.id)).toEqual(master);
  expect(after.layers).toHaveLength(2);
  expect(after.layers[0]).toEqual(target.layers[0]);
  expect(after.controllers?.[0]).toEqual(target.controllers[0]);
  const bank = layers(after.layers).find((layer) => layer.id === mapping.get(bankId));
  expect(bank?.kind).toBe("group");
  if (bank?.kind !== "group") throw new Error("Missing bank");
  expect(bank.drawingSequence?.map((key) => key.frame)).toEqual([12, 20, 24]);
  expect(
    bank.drawingSequence?.every((key) => bank.children.some((child) => child.id === key.drawingId)),
  ).toBe(true);
  const arm = layers(after.layers).find((layer) => layer.id === mapping.get(armId));
  expect(arm?.kind === "group" && arm.twoBoneRig?.elbowId).toBe(mapping.get(elbowId));
  expect(arm?.kind === "group" && arm.twoBoneRig?.restPose).toBeTruthy();
  const ink = layers(after.layers).find((layer) => layer.id === mapping.get(inkId));
  expect(ink?.exposure).toEqual({ startFrame: 14, endFrame: 34 });
  expect(
    ink?.kind !== "group" && ink?.elements[0]?.kind === "raster-stroke" && ink.elements[0].reveal,
  ).toEqual({ startFrame: 14, endFrame: 22 });
  expect(after.controllers?.[1]?.activeRange).toEqual({ startFrame: 16, endFrame: 32 });
  expect(after.meshes?.[0]?.mesh?.keyframes.map((key) => key.frame)).toEqual([12, 35]);
  for (const frame of [0, 4, 8, 12, 23]) {
    const source = await renderShotFramePNG(master, frame, {
      layerIds: [rootId],
      background: "transparent",
    });
    const copy = await renderShotFramePNG(after, frame + 12, {
      layerIds: [options.id],
      background: "transparent",
    });
    expect(copy).toEqual(source);
  }
  const directory = await mkdtemp(join(tmpdir(), "codeboard-character-"));
  onTestFinished(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, "reuse.cboard");
  await project.save(file);
  const reopened = await StoryboardProject.open(file);
  expect(reopened.shotAnimation(target.id)).toEqual(after);
  expect(await renderShotFramePNG(reopened.shotAnimation(target.id), 24)).toEqual(
    await renderShotFramePNG(after, 24),
  );
});

it("gives two instances independent placement and local pose revisions; undo restores just the insertion", () => {
  const { project, options, bankId } = fixture();
  const first = project.instantiateShotCharacter("animation:master", options);
  const before = project.toJSON();
  project.instantiateShotCharacter("animation:master", {
    ...options,
    id: "character:second",
    transform: { x: 30 },
  });
  const after = project.toJSON();
  expect(project.undo()).toBe(true);
  expect(project.shotAnimation(options.targetAnimationId)).toEqual(
    before.studio.animations.find((entry) => entry.id === options.targetAnimationId),
  );
  expect(project.redo()).toBe(true);
  expect(project.shotAnimation(options.targetAnimationId)).toEqual(
    after.studio.animations.find((entry) => entry.id === options.targetAnimationId),
  );
  const layerId = first.identities.find((entry) => entry.sourceId === bankId)!.copyId;
  const master = project.shotAnimation("animation:master");
  const second = project
    .shotAnimation(options.targetAnimationId)
    .layers.find((layer) => layer.id === "character:second");
  project.editShotAnimation(options.targetAnimationId, [
    { op: "layer.set", layerId, changes: { opacity: 0.5 } },
  ]);
  expect(project.shotAnimation("animation:master")).toEqual(master);
  expect(
    project
      .shotAnimation(options.targetAnimationId)
      .layers.find((layer) => layer.id === "character:second"),
  ).toEqual(second);
});

it("commits character insertion atomically and replays the original plan after reopen without another instance", async () => {
  const { project, options } = fixture();
  const directory = await mkdtemp(join(tmpdir(), "codeboard-character-plan-"));
  onTestFinished(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, "project.cboard");
  await project.save(file);
  const plan = project.plan("Reusable character", [
    { op: "character.instantiate", sourceAnimationId: "animation:master", ...options },
  ]);
  await project.commit(plan, { requestId: "character:request" });
  const reopened = await StoryboardProject.open(file),
    before = reopened.toJSON();
  expect((await reopened.commit(plan, { requestId: "character:request" })).replayed).toBe(true);
  expect(reopened.toJSON()).toEqual(before);
  expect(reopened.shotAnimation(options.targetAnimationId).layers).toHaveLength(1);
});

it("CLI emits a version-pinned plan that the existing commit command can retry", async () => {
  const { project, options } = fixture();
  const directory = await mkdtemp(join(tmpdir(), "codeboard-character-cli-"));
  onTestFinished(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, "project.cboard"),
    planFile = join(directory, "insert.json");
  await project.save(file);
  const args = [
    "character-plan",
    file,
    "animation:master",
    options.rootLayerId,
    options.targetAnimationId,
    "--id",
    options.id,
    "--frame-offset",
    "12",
    "--expected-version",
    String(project.version),
  ];
  const planned = cli(args);
  expect(planned.status, planned.stderr).toBe(0);
  expect((await StoryboardProject.open(file)).toJSON()).toEqual(project.toJSON());
  await writeFile(planFile, planned.stdout);
  const committed = cli(["commit", file, planFile, "--request-id", "character:cli"]);
  expect(committed.status, committed.stderr).toBe(0);
  const retry = cli(["commit", file, planFile, "--request-id", "character:cli"]);
  expect(retry.status, retry.stderr).toBe(0);
  expect(JSON.parse(retry.stdout).replayed).toBe(true);
  const reopened = await StoryboardProject.open(file);
  expect(reopened.shotAnimation(options.targetAnimationId).layers).toHaveLength(1);
  const stale = cli(args);
  expect(stale.status).toBe(1);
  expect(
    JSON.parse(stale.stderr.split("\n").find((line) => line.startsWith("{"))!).error.code,
  ).toBe("REVISION_CONFLICT");
});

it.each([
  ["character root", { rootLayerId: "missing" }],
  ["parent", { parentLayerId: "missing" }],
  ["duration", { frameOffset: 40 }],
  ["negative offset", { frameOffset: -1 }],
  ["identity collision", { id: "animation:master" }],
  ["source frame range", { frameOffset: Number.MAX_SAFE_INTEGER }],
])("rejects invalid %s without changing artwork or consuming identities", (_, changes) => {
  const { project, options } = fixture();
  const before = project.toJSON();
  expect(() =>
    project.instantiateShotCharacter("animation:master", { ...options, ...changes }),
  ).toThrow();
  expect(project.toJSON()).toEqual(before);
});

it("rejects mixed controller targets, external masks/joints and unequal frame rates instead of dropping dependencies", () => {
  for (const kind of ["controller", "mask", "skin", "rate", "clip"] as const) {
    const { project, options, rootId, bankId, faceId } = fixture();
    const master = project.shotAnimation("animation:master");
    const environment = master.layers[0]!;
    if (kind === "controller")
      master.controllers![0]!.targets = [
        ...master.controllers![0]!.targets,
        { layerId: environment.id, values: { x: 1 } },
      ];
    if (kind === "mask")
      master.layers.find((layer) => layer.id === rootId)!.maskLayerId = environment.id;
    if (kind === "clip") master.layers.find((layer) => layer.id === rootId)!.clipToBelow = true;
    if (kind === "skin")
      master.meshes = [
        {
          layerId: faceId,
          skin: {
            source: [
              { x: 0, y: 0 },
              { x: 8, y: 0 },
              { x: 0, y: 8 },
            ],
            triangles: [[0, 1, 2]],
            joints: [{ id: "joint", bind: [1, 0, 0, 1, 0, 0] }],
            weights: [
              [{ jointId: "joint", weight: 1 }],
              [{ jointId: "joint", weight: 1 }],
              [{ jointId: "joint", weight: 1 }],
            ],
            jointLayers: [{ jointId: "joint", layerId: environment.id }],
          },
        },
      ];
    if (kind === "rate") master.frameRate = { numerator: 25, denominator: 1 };
    project.putShotAnimation(master);
    const before = project.toJSON();
    expect(() => project.instantiateShotCharacter(master.id, options)).toThrow();
    expect(project.toJSON()).toEqual(before);
    expect(bankId).not.toBe(environment.id);
  }
});

it("requires an explicit receiving composite source and preserves its existing graph", async () => {
  const { project, options } = fixture();
  project.editShotAnimation(options.targetAnimationId, [
    { op: "layer.add", id: "layer:set", kind: "vector", name: "Set" },
  ]);
  project.editShotAnimation(options.targetAnimationId, [
    {
      op: "compositing.set",
      graph: {
        output: "node:set",
        nodes: [{ id: "node:set", kind: "source", layerIds: ["layer:set"] }],
      },
    },
  ]);
  const before = project.toJSON();
  expect(() => project.instantiateShotCharacter("animation:master", options)).toThrow(
    /receiving source/,
  );
  expect(project.toJSON()).toEqual(before);
  project.instantiateShotCharacter("animation:master", {
    ...options,
    compositeSourceId: "node:set",
  });
  expect(project.shotAnimation(options.targetAnimationId).compositing?.nodes[0]).toEqual({
    id: "node:set",
    kind: "source",
    layerIds: ["layer:set", options.id],
  });
  const after = project.shotAnimation(options.targetAnimationId);
  expect(await renderShotFramePNG(after, 24)).not.toEqual(await renderShotFramePNG(after, 0));
});

it("allows reuse of a reviewed master but respects locked destination ancestors", () => {
  const { project, options, rootId } = fixture();
  project.production.lock("layer", rootId, "Reviewed master");
  project.editShotAnimation(options.targetAnimationId, [
    { op: "layer.add", id: "group:locked", kind: "group", name: "Reviewed set" },
  ]);
  project.production.lock("layer", "group:locked", "Reviewed destination");
  const other = StoryboardProject.fromJSON(project.toJSON(), { actor: "agent:other" });
  const before = other.toJSON();
  expect(() =>
    other.instantiateShotCharacter("animation:master", {
      ...options,
      parentLayerId: "group:locked",
    }),
  ).toThrow(/Locked/);
  expect(other.toJSON()).toEqual(before);
  expect(() => other.instantiateShotCharacter("animation:master", options)).not.toThrow();
});

it("keeps whole-shot duplication on the same rig/controller remapping path", () => {
  const { project, rootId } = fixture();
  const shot = project.addScene("Copies").addShot("Full copy");
  const master = project.shotAnimation("animation:master");
  const copy = project.duplicateShotAnimation(master.id, {
    id: "animation:full-copy",
    shotId: shot.id,
  });
  const mapping = new Map(copy.identities.map((entry) => [entry.sourceId, entry.copyId]));
  const duplicated = project.shotAnimation(copy.animationId);
  expect(duplicated.layers).toHaveLength(master.layers.length);
  expect(duplicated.layers.some((layer) => layer.id === mapping.get(rootId))).toBe(true);
  expect(duplicated.controllers?.[0]?.id).toBe(mapping.get("controller:look"));
  expect(duplicated.controllers?.[0]?.targets[0]?.layerId).toBe(
    mapping.get(master.controllers![0]!.targets[0]!.layerId),
  );
  expect(duplicated.meshes?.[0]?.layerId).toBe(mapping.get(master.meshes![0]!.layerId));
  expect(project.shotAnimation(master.id)).toEqual(master);
});

it("preserves tracked prop origins, local corrections and palette bindings through insertion and source upgrade", () => {
  const { project, panel, instance, component, source, element, child, local } = componentFixture();
  project.putPalette({
    id: "palette:prop",
    name: "Prop",
    swatches: [{ id: "swatch:prop", name: "Paint", color: "#e07020" }],
  });
  project.setColorBinding(local.id, "fill", { swatchId: "swatch:prop", override: "#397783" });
  const capture = project.capturePanelAnimation(panel.id, { id: "animation:prop-master" });
  const mapped = (id: string) =>
    capture.identities.find((entry) => entry.sourceId === id)!.capturedId;
  const shot = project.addScene("Shots").addShot("Prop destination");
  project.putShotAnimation({
    id: "animation:prop-shot",
    shotId: shot.id,
    name: "Destination",
    frameRate: { numerator: 24, denominator: 1 },
    durationFrames: project.shotAnimation(capture.animationId).durationFrames,
    canvas: { width: 64, height: 48, background: "white" },
    layers: [],
    cameraKeyframes: [],
  });
  const copied = project.instantiateShotCharacter(capture.animationId, {
    id: "character:prop",
    rootLayerId: mapped(instance),
    targetAnimationId: "animation:prop-shot",
  });
  const copyId = (id: string) =>
    copied.identities.find((entry) => entry.sourceId === mapped(id))!.copyId;
  const origin = project.componentOriginData(copyId(instance));
  expect(origin.baselineVersion).toBe(1);
  project.production.replaceComponentElement(
    component,
    source.id,
    { ...element, matrix: [1, 0, 0, 1, 4, 0] },
    { expectedComponentVersion: 1 },
  );
  const preview = project.previewComponentUpgrade(copyId(instance));
  expect(preview.conflictsResolved).toBe(true);
  project.production.upgradeComponentInstance(copyId(instance), {
    expectedInputHash: preview.inputHash,
  });
  const revised = project.production.element(copyId(local.id));
  expect(revised.kind === "vector-path" && revised.fill).toBe("#397783");
  expect(revised.matrix).toEqual([1, 0, 0, 1, 4, 0]);
  expect(revised.colorBindings?.fill).toEqual({ swatchId: "swatch:prop", override: "#397783" });
  expect(project.componentOriginData(mapped(instance)).baselineVersion).toBe(1);
  expect(project.componentOriginData(copyId(instance)).baselineVersion).toBe(2);
  expect(project.production.layer(copyId(child.id)).id).not.toBe(child.id);
});

it("remaps weighted skin joints and shifts curve/envelope keys while preserving rendered deformation", async () => {
  const { project, options, rootId, faceId, bankId } = fixture();
  const mesh = [
    { x: 0, y: 0 },
    { x: 8, y: 0 },
    { x: 0, y: 8 },
  ];
  const master = project.shotAnimation("animation:master");
  master.meshes = [
    {
      layerId: faceId,
      skin: {
        source: mesh,
        triangles: [[0, 1, 2]],
        joints: [{ id: "joint:eye", bind: [1, 0, 0, 1, 0, 0] }],
        weights: mesh.map(() => [{ jointId: "joint:eye", weight: 1 }]),
        jointLayers: [{ jointId: "joint:eye", layerId: bankId }],
      },
    },
  ];
  project.putShotAnimation(master);
  const result = project.instantiateShotCharacter(master.id, options);
  const copyId = (id: string) => result.identities.find((entry) => entry.sourceId === id)!.copyId;
  const target = project.shotAnimation(options.targetAnimationId);
  expect(target.meshes?.[0]?.skin?.jointLayers).toEqual([
    { jointId: "joint:eye", layerId: copyId(bankId) },
  ]);
  for (const frame of [0, 12, 23])
    expect(
      await renderShotFramePNG(target, frame + 12, {
        layerIds: [options.id],
        background: "transparent",
      }),
    ).toEqual(
      await renderShotFramePNG(master, frame, { layerIds: [rootId], background: "transparent" }),
    );
  const curve = [
    { x: 0, y: 0 },
    { x: 3, y: 0 },
    { x: 6, y: 0 },
    { x: 9, y: 0 },
  ] as const;
  const bottom = curve.map((point) => ({ ...point, y: 8 }));
  const envelope = {
    top: curve,
    bottom: [bottom[0]!, bottom[1]!, bottom[2]!, bottom[3]!] as const,
    left: [
      { x: 0, y: 0 },
      { x: 0, y: 3 },
      { x: 0, y: 5 },
      { x: 0, y: 8 },
    ] as const,
    right: [
      { x: 9, y: 0 },
      { x: 9, y: 3 },
      { x: 9, y: 5 },
      { x: 9, y: 8 },
    ] as const,
  };
  for (const kind of ["curve", "envelope"] as const) {
    const source = structuredClone(master);
    source.meshes =
      kind === "curve"
        ? [
            {
              layerId: faceId,
              curve: {
                rest: { curve, width: 8 },
                segments: 2,
                keyframes: [
                  { frame: 0, curve, width: 8, easing: "linear" },
                  { frame: 23, curve, width: 9, easing: "linear" },
                ],
              },
            },
          ]
        : [
            {
              layerId: faceId,
              envelope: {
                rest: envelope,
                columns: 2,
                rows: 2,
                keyframes: [
                  { frame: 0, pose: envelope, easing: "linear" },
                  { frame: 23, pose: envelope, easing: "linear" },
                ],
              },
            },
          ];
    project.putShotAnimation(source);
    const id = `character:${kind}`;
    project.instantiateShotCharacter(master.id, { ...options, id });
    const animation = project.shotAnimation(options.targetAnimationId);
    const binding = animation.meshes!.at(-1)!;
    expect(
      (binding.curve?.keyframes ?? binding.envelope?.keyframes)?.map((key) => key.frame),
    ).toEqual([12, 35]);
    expect(
      await renderShotFramePNG(animation, 24, { layerIds: [id], background: "transparent" }),
    ).toEqual(
      await renderShotFramePNG(source, 12, { layerIds: [rootId], background: "transparent" }),
    );
  }
});
