import type { ComponentUpgradeOptions } from "../model/component-upgrade.js";
import type {
  CameraKeyframeInput,
  CameraKeyframeChanges,
  LayerKeyframeInput,
  LayerKeyframeChanges,
  AudioTrackChanges,
  AudioClipInput,
  AudioClipChanges,
} from "../model/types.js";
import type { TwoBoneSolution } from "../animation/ik.js";
import type { CoordinateOptions } from "./coordinates.js";
import type { ObjectPageQuery, ObjectPage } from "../model/types.js";
import type {
  Asset,
  AudioClip,
  AudioClipQuery,
  AudioTrackSummary,
  BrushPreset,
  DrawingElement,
  Id,
  Layer,
  Panel,
  ProjectLock,
  ReviewComment,
  Transform,
  Transition,
  ObjectQuery,
  PageOptions,
  DrawingExposure,
  DrawingNeighbors,
  LayerChannel,
  CameraChannel,
  TwoBoneRig,
  Easing,
} from "../model/types.js";
import type { ProductionHost, MutationOptions } from "./production/host.js";
import * as components from "./production/components.js";
import * as layers from "./production/layers.js";
import * as inspection from "./production/inspection.js";
import * as rigging from "./production/rigging.js";
import * as drawings from "./production/drawings.js";
import * as brushes from "./production/brushes.js";
import * as timeline from "./production/timeline.js";
import * as camera from "./production/camera.js";
import * as keyframes from "./production/keyframes.js";
import * as assets from "./production/assets.js";
import * as audio from "./production/audio.js";
import * as review from "./production/review.js";
import * as locks from "./production/locks.js";

export class ProductionTools {
  constructor(private host: ProductionHost) {}

  captureComponent(layerId: Id, name: string, options: MutationOptions & { id?: Id } = {}): Id {
    return components.captureComponent(this.host, layerId, name, options);
  }

  reviseComponent(id: Id, sourceLayerId: Id, options: MutationOptions = {}) {
    return components.reviseComponent(this.host, id, sourceLayerId, options);
  }

  replaceComponentSource(
    componentId: Id,
    layers: readonly Layer[],
    options: MutationOptions & { expectedComponentVersion: number },
  ) {
    return components.replaceComponentSource(this.host, componentId, layers, options);
  }

  replaceComponentElement(
    componentId: Id,
    layerId: Id,
    element: DrawingElement,
    options: MutationOptions & { expectedComponentVersion: number },
  ) {
    return components.replaceComponentElement(this.host, componentId, layerId, element, options);
  }

  instantiateComponent(
    componentId: Id,
    panelId: Id,
    transform: Partial<Transform> = {},
    options: MutationOptions & { id?: Id } = {},
  ): Id {
    return components.instantiateComponent(this.host, componentId, panelId, transform, options);
  }

  upgradeComponentInstance(
    instanceId: Id,
    options: ComponentUpgradeOptions & MutationOptions & { expectedInputHash: string },
  ) {
    return components.upgradeComponentInstance(this.host, instanceId, options);
  }

  refreshComponentInstance(
    layerId: Id,
    options: MutationOptions & { comments?: "reject" | "anchor-to-instance" } = {},
  ) {
    return components.refreshComponentInstance(this.host, layerId, options);
  }

  moveLayer(layerId: Id, beforeLayerId?: Id, options: MutationOptions = {}) {
    return layers.moveLayer(this.host, layerId, beforeLayerId, options);
  }

  reparentLayer(
    layerId: Id,
    parentId: Id | null,
    options: MutationOptions & { beforeLayerId?: Id } = {},
  ): void {
    layers.reparentLayer(this.host, layerId, parentId, options);
  }

  removeLayer(layerId: Id, options: MutationOptions = {}) {
    return layers.removeLayer(this.host, layerId, options);
  }

  find(query: ObjectQuery = {}) {
    return inspection.find(this.host, query);
  }

  query(query: ObjectPageQuery = {}): ObjectPage {
    return inspection.query(this.host, query);
  }

  summary() {
    return inspection.summary(this.host);
  }

  coordinates(targetId: Id, options: CoordinateOptions = {}) {
    return inspection.coordinates(this.host, targetId, options);
  }

  layer(id: Id): Layer {
    return layers.layer(this.host, id);
  }

  layerKeyframes(id: Id, options: PageOptions = {}) {
    return keyframes.layerKeyframes(this.host, id, options);
  }

  cameraKeyframes(shotId: Id, options: PageOptions = {}) {
    return camera.cameraKeyframes(this.host, shotId, options);
  }

  element(id: Id): DrawingElement {
    return layers.element(this.host, id);
  }

  drawingSequence(groupId: Id) {
    return drawings.drawingSequence(this.host, groupId);
  }

  drawingExposures(groupId: Id, options: PageOptions = {}) {
    return drawings.drawingExposures(this.host, groupId, options);
  }

  drawingAlternatives(groupId: Id, options: PageOptions = {}) {
    return drawings.drawingAlternatives(this.host, groupId, options);
  }

  setPlaneDepth(layerId: Id, depth: number, options: MutationOptions = {}): void {
    layers.setPlaneDepth(this.host, layerId, depth, options);
  }

  drawingNeighbors(
    groupId: Id,
    frame: number,
    options: { skipBlank?: boolean } = {},
  ): DrawingNeighbors {
    return drawings.drawingNeighbors(this.host, groupId, frame, options);
  }

  twoBoneRig(rootId: Id) {
    return rigging.twoBoneRig(this.host, rootId);
  }

  setTwoBoneRig(rootId: Id, definition: TwoBoneRig | null, options: MutationOptions = {}): void {
    rigging.setTwoBoneRig(this.host, rootId, definition, options);
  }

  poseTwoBoneRig(
    rootId: Id,
    frame: number,
    target: { x: number; y: number },
    options: MutationOptions & {
      bend?: 1 | -1;
      easing?: Easing;
      unreachable?: "reject" | "clamp";
    } = {},
  ): TwoBoneSolution {
    return rigging.poseTwoBoneRig(this.host, rootId, frame, target, options);
  }

  setDrawingSequence(
    groupId: Id,
    keys: readonly DrawingExposure[] | null,
    options: MutationOptions = {},
  ) {
    return drawings.setDrawingSequence(this.host, groupId, keys, options);
  }

  duplicateDrawing(groupId: Id, drawingId: Id, name: string, options: MutationOptions = {}): Id {
    return drawings.duplicateDrawing(this.host, groupId, drawingId, name, options);
  }

  setDrawingRange(
    groupId: Id,
    startFrame: number,
    endFrame: number,
    drawingId: Id | null,
    options: MutationOptions = {},
  ): void {
    drawings.setDrawingRange(this.host, groupId, startFrame, endFrame, drawingId, options);
  }

  setExposure(layerId: Id, exposure: Layer["exposure"], options: MutationOptions = {}) {
    return drawings.setExposure(this.host, layerId, exposure, options);
  }

  inspect() {
    return inspection.inspect(this.host);
  }

  audioTracks(options: PageOptions = {}): AudioTrackSummary[] {
    return audio.audioTracks(this.host, options);
  }

  audioClips(trackId: Id, options: AudioClipQuery = {}): AudioClip[] {
    return audio.audioClips(this.host, trackId, options);
  }

  audioClip(id: Id): AudioClip & { trackId: Id } {
    return audio.audioClip(this.host, id);
  }

  changesSince(version: number, options: PageOptions = {}) {
    return inspection.changesSince(this.host, version, options);
  }

  brush(id: Id): BrushPreset {
    return brushes.brush(this.host, id);
  }

  createBrush(
    definition: Omit<BrushPreset, "id" | "version"> & { id?: Id },
    options: MutationOptions = {},
  ): Id {
    return brushes.createBrush(this.host, definition, options);
  }

  reviseBrush(
    id: Id,
    changes: Partial<Omit<BrushPreset, "id" | "version">>,
    options: MutationOptions = {},
  ): number {
    return brushes.reviseBrush(this.host, id, changes, options);
  }

  duplicateBrush(id: Id, name: string, options: MutationOptions = {}): Id {
    return brushes.duplicateBrush(this.host, id, name, options);
  }

  setPanelDuration(
    panelId: Id,
    durationFrames: number,
    mode: "ripple" | "preserve" = "ripple",
    options: MutationOptions = {},
  ): void {
    timeline.setPanelDuration(this.host, panelId, durationFrames, mode, options);
  }

  setTransition(panelId: Id, transition: Transition, options: MutationOptions = {}): void {
    timeline.setTransition(this.host, panelId, transition, options);
  }

  movePanel(panelId: Id, beforePanelId?: Id, options: MutationOptions = {}): void {
    timeline.movePanel(this.host, panelId, beforePanelId, options);
  }

  duplicatePanel(panelId: Id, options: MutationOptions = {}): Id {
    return timeline.duplicatePanel(this.host, panelId, options);
  }

  deletePanel(panelId: Id, options: MutationOptions = {}): void {
    timeline.deletePanel(this.host, panelId, options);
  }

  setPanelStatus(panelId: Id, status: Panel["status"], options: MutationOptions = {}): void {
    timeline.setPanelStatus(this.host, panelId, status, options);
  }

  setPanelNumber(panelId: Id, number: string, options: MutationOptions = {}) {
    return timeline.setPanelNumber(this.host, panelId, number, options);
  }

  addCameraKeyframe(
    shotId: Id,
    frame: number,
    value: CameraKeyframeInput,
    options: MutationOptions = {},
  ): Id {
    return camera.addCameraKeyframe(this.host, shotId, frame, value, options);
  }

  updateCameraKeyframe(
    shotId: Id,
    keyframeId: Id,
    changes: CameraKeyframeChanges,
    options: MutationOptions = {},
  ): void {
    camera.updateCameraKeyframe(this.host, shotId, keyframeId, changes, options);
  }

  removeCameraKeyframe(shotId: Id, keyframeId: Id, options: MutationOptions = {}): void {
    camera.removeCameraKeyframe(this.host, shotId, keyframeId, options);
  }

  removeCameraKeyframeChannels(
    shotId: Id,
    keyframeId: Id,
    channels: readonly CameraChannel[],
    options: MutationOptions = {},
  ): void {
    camera.removeCameraKeyframeChannels(this.host, shotId, keyframeId, channels, options);
  }

  addLayerKeyframe(
    layerId: Id,
    frame: number,
    value: LayerKeyframeInput,
    options: MutationOptions = {},
  ): Id {
    return keyframes.addLayerKeyframe(this.host, layerId, frame, value, options);
  }

  updateLayerKeyframe(
    layerId: Id,
    keyframeId: Id,
    changes: LayerKeyframeChanges,
    options: MutationOptions = {},
  ): void {
    keyframes.updateLayerKeyframe(this.host, layerId, keyframeId, changes, options);
  }

  removeLayerKeyframe(layerId: Id, keyframeId: Id, options: MutationOptions = {}): void {
    keyframes.removeLayerKeyframe(this.host, layerId, keyframeId, options);
  }

  removeLayerKeyframeChannels(
    layerId: Id,
    keyframeId: Id,
    channels: readonly LayerChannel[],
    options: MutationOptions = {},
  ) {
    return keyframes.removeLayerKeyframeChannels(this.host, layerId, keyframeId, channels, options);
  }

  addAsset(asset: Omit<Asset, "id"> & { id?: Id }, options: MutationOptions = {}): Id {
    return assets.addAsset(this.host, asset, options);
  }

  updateAsset(id: Id, changes: Partial<Omit<Asset, "id">>, options: MutationOptions = {}): void {
    assets.updateAsset(this.host, id, changes, options);
  }

  addAudioTrack(name: string, options: MutationOptions & { id?: Id } = {}): Id {
    return audio.addAudioTrack(this.host, name, options);
  }

  updateAudioTrack(trackId: Id, changes: AudioTrackChanges, options: MutationOptions = {}): void {
    audio.updateAudioTrack(this.host, trackId, changes, options);
  }

  removeAudioTrack(trackId: Id, options: MutationOptions = {}): void {
    audio.removeAudioTrack(this.host, trackId, options);
  }

  addAudioClip(trackId: Id, clip: AudioClipInput, options: MutationOptions = {}): Id {
    return audio.addAudioClip(this.host, trackId, clip, options);
  }

  updateAudioClip(
    trackId: Id,
    clipId: Id,
    changes: AudioClipChanges,
    options: MutationOptions = {},
  ): void {
    audio.updateAudioClip(this.host, trackId, clipId, changes, options);
  }

  removeAudioClip(trackId: Id, clipId: Id, options: MutationOptions = {}) {
    return audio.removeAudioClip(this.host, trackId, clipId, options);
  }

  moveAudioClip(
    clipId: Id,
    targetTrackId: Id,
    options: MutationOptions & { startFrame?: number } = {},
  ): void {
    audio.moveAudioClip(this.host, clipId, targetTrackId, options);
  }

  splitAudioClip(clipId: Id, frame: number, options: MutationOptions = {}): Id {
    return audio.splitAudioClip(this.host, clipId, frame, options);
  }

  comment(
    body: string,
    anchor: ReviewComment["anchor"],
    options: MutationOptions & { author?: string } = {},
  ): Id {
    return review.comment(this.host, body, anchor, options);
  }

  resolveComment(commentId: Id, options: MutationOptions = {}): void {
    review.resolveComment(this.host, commentId, options);
  }

  lock(
    targetType: ProjectLock["targetType"],
    targetId: Id,
    reason: string,
    options: MutationOptions = {},
  ): Id {
    return locks.lock(this.host, targetType, targetId, reason, options);
  }

  unlock(lockId: Id, options: MutationOptions = {}): void {
    locks.unlock(this.host, lockId, options);
  }
}
