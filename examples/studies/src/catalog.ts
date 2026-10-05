import { render as weightedPose } from "./studies/animation/weighted-pose.ts";
import { render as rigRest } from "./studies/animation/rig-rest.ts";
import { render as meshWarp } from "./studies/animation/mesh-warp.ts";
import { render as meshAlpha } from "./studies/animation/mesh-alpha.ts";
import { render as controllerExchange } from "./studies/animation/controller-exchange/render.ts";
import { render as deformerResolution } from "./studies/animation/deformer-resolution/render.ts";
import { render as representations } from "./studies/drawing/representations.ts";
import { render as clipping } from "./studies/drawing/clipping.ts";
import { render as selections } from "./studies/drawing/selections.ts";
import { render as palettes } from "./studies/drawing/palettes.ts";
import { render as colorImport } from "./studies/drawing/color-import.ts";
import { render as components } from "./studies/assets/components.ts";
import { render as psdImport } from "./studies/assets/psd-import.ts";
import { render as componentUpgrade } from "./studies/assets/component-upgrade/render.ts";
import { render as drawingTiming } from "./studies/animation/drawing-timing.ts";
import { render as ikReach } from "./studies/animation/ik-reach.ts";
import { render as lipSync } from "./studies/animation/lip-sync.ts";
import { render as editorialCuts } from "./studies/animation/editorial-cuts.ts";
import { render as cameraDepth } from "./studies/animation/camera-depth.ts";
import { render as audioPlacement } from "./studies/audio/audio-placement.ts";
import { render as audioDelivery } from "./studies/audio/audio-delivery.ts";
import { render as assetReplacement } from "./studies/audio/asset-replacement.ts";
import { render as hierarchy } from "./studies/story/hierarchy.ts";
import { render as scriptBoard } from "./studies/story/script-board.ts";
import { render as savedRevision } from "./studies/workflow/saved-revision.ts";
import { render as reviewTools } from "./studies/workflow/review-tools.ts";
import { render as frameJobs } from "./studies/workflow/frame-jobs.ts";
import { render as migration } from "./studies/workflow/migration.ts";
import { render as otioConform } from "./studies/workflow/otio-conform.ts";
import { render as shotMerge } from "./studies/workflow/shot-merge.ts";
import { render as projectPublish } from "./studies/workflow/project-publish.ts";
import { render as fontPreflight } from "./studies/workflow/font-preflight.ts";

export interface Study {
  id: string;
  features: string[];
  kind: "artwork" | "inspection" | "diagram";
  media?: boolean;
  video?: { kind: "board" } | { kind: "shot"; id: string } | { kind: "editorial"; id: string };
  render(output: string): Promise<void>;
}

export const studies: Study[] = [
  {
    id: "component-upgrade",
    features: ["assets.components"],
    kind: "artwork",
    video: { kind: "shot", id: "animation:component-upgrade" },
    render: componentUpgrade,
  },
  {
    id: "deformer-resolution",
    features: ["animation.coordinates", "compositing.effects"],
    kind: "artwork",
    video: { kind: "shot", id: "animation:deformer-resolution" },
    render: deformerResolution,
  },
  {
    id: "controller-exchange",
    features: ["animation.curves", "editorial.shot-local"],
    kind: "artwork",
    video: { kind: "editorial", id: "edit:exchange" },
    render: controllerExchange,
  },
  {
    id: "mesh-alpha",
    features: ["compositing.effects"],
    kind: "artwork",
    video: { kind: "shot", id: "animation:mesh-alpha" },
    render: meshAlpha,
  },
  {
    id: "mesh-warp",
    features: ["animation.coordinates", "compositing.effects"],
    kind: "artwork",
    video: { kind: "shot", id: "animation:mesh-warp" },
    render: meshWarp,
  },
  {
    id: "rig-rest",
    features: ["animation.rigging"],
    kind: "artwork",
    video: { kind: "shot", id: "animation:rig-rest" },
    render: rigRest,
  },
  {
    id: "weighted-pose",
    features: ["animation.curves"],
    kind: "artwork",
    video: { kind: "shot", id: "animation:pose" },
    render: weightedPose,
  },
  { id: "representations", features: ["drawing"], kind: "artwork", render: representations },
  { id: "color-import", features: ["drawing"], kind: "artwork", render: colorImport },
  { id: "clipping", features: ["compositing.effects"], kind: "artwork", render: clipping },
  { id: "selections", features: ["drawing"], kind: "artwork", render: selections },
  { id: "components", features: ["assets.components"], kind: "artwork", render: components },
  { id: "psd-import", features: ["interchange.psd"], kind: "artwork", render: psdImport },
  {
    id: "drawing-timing",
    features: ["drawing", "animation.curves"],
    kind: "artwork",
    video: { kind: "board" },
    render: drawingTiming,
  },
  { id: "ik-reach", features: ["animation.rigging"], kind: "artwork", render: ikReach },
  { id: "audio-placement", features: [], kind: "diagram", render: audioPlacement },
  { id: "hierarchy", features: [], kind: "diagram", render: hierarchy },
  { id: "palettes", features: ["palettes"], kind: "artwork", render: palettes },
  {
    id: "lip-sync",
    features: ["animation.lip-sync"],
    kind: "artwork",
    video: { kind: "shot", id: "animation:mouth" },
    render: lipSync,
  },
  {
    id: "editorial-cuts",
    features: ["editorial.shot-local", "timing.rational"],
    kind: "artwork",
    video: { kind: "editorial", id: "edit:study" },
    render: editorialCuts,
  },
  {
    id: "camera-depth",
    features: ["camera", "animation.coordinates"],
    kind: "artwork",
    video: { kind: "board" },
    render: cameraDepth,
  },
  {
    id: "script-board",
    features: ["storyboard", "story.script", "story.caption-import"],
    kind: "inspection",
    render: scriptBoard,
  },
  {
    id: "saved-revision",
    features: ["project.configuration", "agent.discovery", "agent.edit-plans", "persistence"],
    kind: "artwork",
    render: savedRevision,
  },
  { id: "review-tools", features: ["review"], kind: "artwork", render: reviewTools },
  {
    id: "frame-jobs",
    features: ["render.jobs", "compositing.graph", "animation.shot-retime"],
    kind: "artwork",
    render: frameJobs,
  },
  { id: "migration", features: ["project.migration"], kind: "artwork", render: migration },
  { id: "project-publish", features: ["persistence"], kind: "artwork", render: projectPublish },
  {
    id: "font-preflight",
    features: ["render.jobs", "delivery.movie"],
    kind: "artwork",
    video: { kind: "shot", id: "animation:fonts" },
    render: fontPreflight,
  },
  {
    id: "asset-replacement",
    features: ["persistence", "audio.studio"],
    kind: "inspection",
    media: true,
    render: assetReplacement,
  },
  {
    id: "shot-merge",
    features: ["editorial.shot-local", "agent.edit-plans"],
    kind: "artwork",
    video: { kind: "shot", id: "animation:study" },
    render: shotMerge,
  },
  {
    id: "otio-conform",
    features: ["interchange.otio"],
    kind: "artwork",
    video: { kind: "editorial", id: "edit:otio" },
    render: otioConform,
  },
  {
    id: "audio-delivery",
    features: ["audio", "audio.studio", "delivery.movie"],
    kind: "inspection",
    media: true,
    render: audioDelivery,
  },
];
