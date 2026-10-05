import { generate as brushImport } from "./studies/drawing/brush-import.ts";
import { generate as strokeOutline } from "./studies/drawing/stroke-outline.ts";
import { generate as layerOrder } from "./studies/drawing/layer-order.ts";
import { generate as masks } from "./studies/drawing/masks.ts";
import { generate as transitions } from "./studies/animation/transitions.ts";
import { generate as envelope } from "./studies/animation/envelope.ts";
import { generate as skinWeights } from "./studies/animation/skin-weights.ts";
import { generate as motionNotes } from "./studies/story/motion-notes.ts";
import { generate as renderPasses } from "./studies/workflow/render-passes.ts";
import { generate as outputProfiles } from "./studies/workflow/output-profiles.ts";
import { generate as perspectiveGuides } from "./studies/drawing/perspective-guides.ts";
import { generate as gradientFills } from "./studies/drawing/gradient-fills.ts";
import { generate as vectorBooleans } from "./studies/drawing/vector-booleans.ts";
import { generate as brushDynamics } from "./studies/drawing/brush-dynamics.ts";
import { generate as layerEffects } from "./studies/drawing/layer-effects.ts";
import { generate as blendModes } from "./studies/drawing/blend-modes.ts";
import { generate as onionSkin } from "./studies/animation/onion-skin.ts";
import { generate as easing } from "./studies/animation/easing.ts";
import { generate as pivots } from "./studies/animation/pivots.ts";
import { generate as strokeReveal } from "./studies/animation/stroke-reveal.ts";
import { generate as drawingHolds } from "./studies/animation/drawing-holds.ts";
import { generate as cameraFraming } from "./studies/animation/camera-framing.ts";
import { generate as retiming } from "./studies/animation/retiming.ts";
import { generate as weightedPose } from "./studies/animation/weighted-pose.ts";
import { generate as rigRest } from "./studies/animation/rig-rest.ts";
import { generate as meshWarp } from "./studies/animation/mesh-warp.ts";
import { generate as meshAlpha } from "./studies/animation/mesh-alpha.ts";
import { generate as controllerExchange } from "./studies/animation/controller-exchange/render.ts";
import { generate as deformerResolution } from "./studies/animation/deformer-resolution/render.ts";
import { generate as representations } from "./studies/drawing/representations.ts";
import { generate as clipping } from "./studies/drawing/clipping.ts";
import { generate as selections } from "./studies/drawing/selections.ts";
import { generate as palettes } from "./studies/drawing/palettes.ts";
import { generate as colorImport } from "./studies/drawing/color-import.ts";
import { generate as components } from "./studies/assets/components.ts";
import { generate as psdImport } from "./studies/assets/psd-import.ts";
import { generate as componentUpgrade } from "./studies/assets/component-upgrade/render.ts";
import { generate as drawingTiming } from "./studies/animation/drawing-timing.ts";
import { generate as ikReach } from "./studies/animation/ik-reach.ts";
import { generate as lipSync } from "./studies/animation/lip-sync.ts";
import { generate as editorialCuts } from "./studies/animation/editorial-cuts.ts";
import { generate as cameraDepth } from "./studies/animation/camera-depth.ts";
import { generate as audioPlacement } from "./studies/audio/audio-placement.ts";
import { generate as audioDelivery } from "./studies/audio/audio-delivery.ts";
import { generate as assetReplacement } from "./studies/audio/asset-replacement.ts";
import { generate as hierarchy } from "./studies/story/hierarchy.ts";
import { generate as scriptBoard } from "./studies/story/script-board.ts";
import { generate as savedRevision } from "./studies/workflow/saved-revision.ts";
import { generate as reviewTools } from "./studies/workflow/review-tools.ts";
import { generate as frameJobs } from "./studies/workflow/frame-jobs.ts";
import { generate as migration } from "./studies/workflow/migration.ts";
import { generate as otioConform } from "./studies/workflow/otio-conform.ts";
import { generate as shotMerge } from "./studies/workflow/shot-merge.ts";
import { generate as projectPublish } from "./studies/workflow/project-publish.ts";
import { generate as fontPreflight } from "./studies/workflow/font-preflight.ts";

export interface Study {
  id: string;
  features: string[];
  kind: "artwork" | "inspection" | "diagram";
  media?: boolean;
  video?: { kind: "board" } | { kind: "shot"; id: string } | { kind: "editorial"; id: string };
  generate(output: string): Promise<void>;
}

export const studies: Study[] = [
  { id: "brush-import", features: ["drawing"], kind: "artwork", generate: brushImport },
  { id: "stroke-outline", features: ["drawing"], kind: "artwork", generate: strokeOutline },
  { id: "layer-order", features: ["drawing"], kind: "artwork", generate: layerOrder },
  { id: "masks", features: ["compositing.effects"], kind: "artwork", generate: masks },
  {
    id: "transitions",
    features: ["editorial.shot-local"],
    kind: "artwork",
    video: { kind: "board" },
    generate: transitions,
  },
  {
    id: "envelope",
    features: ["animation.coordinates"],
    kind: "artwork",
    video: { kind: "shot", id: "animation:envelope" },
    generate: envelope,
  },
  {
    id: "skin-weights",
    features: ["animation.coordinates"],
    kind: "artwork",
    video: { kind: "shot", id: "animation:skin-weights" },
    generate: skinWeights,
  },
  { id: "motion-notes", features: ["storyboard"], kind: "artwork", generate: motionNotes },
  { id: "render-passes", features: ["compositing.graph"], kind: "artwork", generate: renderPasses },
  { id: "output-profiles", features: ["render.jobs"], kind: "artwork", generate: outputProfiles },
  { id: "perspective-guides", features: ["review"], kind: "artwork", generate: perspectiveGuides },
  { id: "gradient-fills", features: ["drawing"], kind: "artwork", generate: gradientFills },
  { id: "vector-booleans", features: ["drawing"], kind: "artwork", generate: vectorBooleans },
  { id: "brush-dynamics", features: ["drawing"], kind: "artwork", generate: brushDynamics },
  { id: "layer-effects", features: ["drawing"], kind: "artwork", generate: layerEffects },
  { id: "blend-modes", features: ["drawing"], kind: "artwork", generate: blendModes },
  {
    id: "onion-skin",
    features: ["review"],
    kind: "artwork",
    video: { kind: "board" },
    generate: onionSkin,
  },
  {
    id: "easing",
    features: ["animation.curves"],
    kind: "artwork",
    video: { kind: "board" },
    generate: easing,
  },
  { id: "pivots", features: ["animation.curves"], kind: "artwork", generate: pivots },
  {
    id: "stroke-reveal",
    features: ["animation.curves"],
    kind: "artwork",
    video: { kind: "board" },
    generate: strokeReveal,
  },
  {
    id: "drawing-holds",
    features: ["animation.curves"],
    kind: "artwork",
    video: { kind: "board" },
    generate: drawingHolds,
  },
  {
    id: "camera-framing",
    features: ["camera"],
    kind: "artwork",
    video: { kind: "board" },
    generate: cameraFraming,
  },
  {
    id: "retiming",
    features: ["animation.shot-retime"],
    kind: "artwork",
    video: { kind: "shot", id: "animation:study" },
    generate: retiming,
  },
  {
    id: "component-upgrade",
    features: ["assets.components"],
    kind: "artwork",
    video: { kind: "shot", id: "animation:component-upgrade" },
    generate: componentUpgrade,
  },
  {
    id: "deformer-resolution",
    features: ["animation.coordinates", "compositing.effects"],
    kind: "artwork",
    video: { kind: "shot", id: "animation:deformer-resolution" },
    generate: deformerResolution,
  },
  {
    id: "controller-exchange",
    features: ["animation.curves", "editorial.shot-local"],
    kind: "artwork",
    video: { kind: "editorial", id: "edit:exchange" },
    generate: controllerExchange,
  },
  {
    id: "mesh-alpha",
    features: ["compositing.effects"],
    kind: "artwork",
    video: { kind: "shot", id: "animation:mesh-alpha" },
    generate: meshAlpha,
  },
  {
    id: "mesh-warp",
    features: ["animation.coordinates", "compositing.effects"],
    kind: "artwork",
    video: { kind: "shot", id: "animation:mesh-warp" },
    generate: meshWarp,
  },
  {
    id: "rig-rest",
    features: ["animation.rigging"],
    kind: "artwork",
    video: { kind: "shot", id: "animation:rig-rest" },
    generate: rigRest,
  },
  {
    id: "weighted-pose",
    features: ["animation.curves"],
    kind: "artwork",
    video: { kind: "shot", id: "animation:pose" },
    generate: weightedPose,
  },
  { id: "representations", features: ["drawing"], kind: "artwork", generate: representations },
  { id: "color-import", features: ["drawing"], kind: "artwork", generate: colorImport },
  { id: "clipping", features: ["compositing.effects"], kind: "artwork", generate: clipping },
  { id: "selections", features: ["drawing"], kind: "artwork", generate: selections },
  { id: "components", features: ["assets.components"], kind: "artwork", generate: components },
  { id: "psd-import", features: ["interchange.psd"], kind: "artwork", generate: psdImport },
  {
    id: "drawing-timing",
    features: ["drawing", "animation.curves"],
    kind: "artwork",
    video: { kind: "board" },
    generate: drawingTiming,
  },
  { id: "ik-reach", features: ["animation.rigging"], kind: "artwork", generate: ikReach },
  { id: "audio-placement", features: [], kind: "diagram", generate: audioPlacement },
  { id: "hierarchy", features: [], kind: "diagram", generate: hierarchy },
  { id: "palettes", features: ["palettes"], kind: "artwork", generate: palettes },
  {
    id: "lip-sync",
    features: ["animation.lip-sync"],
    kind: "artwork",
    video: { kind: "shot", id: "animation:mouth" },
    generate: lipSync,
  },
  {
    id: "editorial-cuts",
    features: ["editorial.shot-local", "timing.rational"],
    kind: "artwork",
    video: { kind: "editorial", id: "edit:study" },
    generate: editorialCuts,
  },
  {
    id: "camera-depth",
    features: ["camera", "animation.coordinates"],
    kind: "artwork",
    video: { kind: "board" },
    generate: cameraDepth,
  },
  {
    id: "script-board",
    features: ["storyboard", "story.script", "story.caption-import"],
    kind: "inspection",
    generate: scriptBoard,
  },
  {
    id: "saved-revision",
    features: ["project.configuration", "agent.discovery", "agent.edit-plans", "persistence"],
    kind: "artwork",
    generate: savedRevision,
  },
  { id: "review-tools", features: ["review"], kind: "artwork", generate: reviewTools },
  {
    id: "frame-jobs",
    features: ["render.jobs", "compositing.graph", "animation.shot-retime"],
    kind: "artwork",
    generate: frameJobs,
  },
  { id: "migration", features: ["project.migration"], kind: "artwork", generate: migration },
  { id: "project-publish", features: ["persistence"], kind: "artwork", generate: projectPublish },
  {
    id: "font-preflight",
    features: ["render.jobs", "delivery.movie"],
    kind: "artwork",
    video: { kind: "shot", id: "animation:fonts" },
    generate: fontPreflight,
  },
  {
    id: "asset-replacement",
    features: ["persistence", "audio.studio"],
    kind: "inspection",
    media: true,
    generate: assetReplacement,
  },
  {
    id: "shot-merge",
    features: ["editorial.shot-local", "agent.edit-plans"],
    kind: "artwork",
    video: { kind: "shot", id: "animation:study" },
    generate: shotMerge,
  },
  {
    id: "otio-conform",
    features: ["interchange.otio"],
    kind: "artwork",
    video: { kind: "editorial", id: "edit:otio" },
    generate: otioConform,
  },
  {
    id: "audio-delivery",
    features: ["audio", "audio.studio", "delivery.movie"],
    kind: "inspection",
    media: true,
    generate: audioDelivery,
  },
];
