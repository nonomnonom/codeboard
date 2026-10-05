export { renderPanelCanvas, renderPanelPNG } from "./render/panel.js";
export { StoryboardProject } from "./core/project.js";
export type {
  Palette,
  PaletteSwatch,
  ColorBinding,
  ColorChannel,
  PaletteBindingUsage,
} from "./model/types/palettes.js";
export type {
  ProductionScript,
  ScriptInput,
  ScriptEntry,
  ScriptChangeReport,
} from "./model/types/script.js";
export { parseCaptionCSV } from "./story/caption-csv.js";
export type { CaptionField, CaptionImportRow } from "./story/caption-csv.js";
export { planCaptionImport } from "./core/story/captions.js";
export { planScriptBoard } from "./core/story/board.js";
export { planBoardCapture } from "./core/story/board-capture.js";
export type { BoardCaptureOptions } from "./core/story/board-capture.js";
export { compileLipSync, rescaleLipSync } from "./animation/lip-sync.js";
export type { MouthCue, LipSyncOptions, LipSyncTimingOptions } from "./animation/lip-sync.js";
export { planShotLipSync } from "./core/story/lip-sync.js";
export type { ScriptBoardPanel, ScriptBoardReport } from "./core/story/board.js";
export type { CaptionImportReport } from "./core/story/captions.js";
export { migrateProject } from "./core/migrate.js";
export type { ProjectMigrationReport } from "./core/migrate.js";
export { defineShotAnimation } from "./animation/shot.js";
export { retimeShotAnimation } from "./animation/shot-retime.js";
export type { ShotRetimeReport } from "./animation/shot-retime.js";
export type { ShotRetimeOptions } from "./model/types/shot-timing.js";
export { importScriptCSV, exportScriptCSV } from "./interchange/script-csv.js";
export type { ScriptCSVOptions } from "./interchange/script-csv.js";
export { inspectScriptFDX, importScriptFDX } from "./interchange/script-fdx.js";
export type {
  FDXLoss,
  FDXParagraph,
  FDXInspection,
  FDXImportOptions,
} from "./interchange/script-fdx.js";
export {
  defineEditorialSequence,
  resolveEditorialFrame,
  createEditorialResolver,
} from "./animation/editorial.js";
export { renderShotFramePNG, createShotRenderSession } from "./render/shot.js";
export type { ShotCompositeGraph, ShotCompositeNode } from "./model/types/compositing.js";
export { inspectProjectFonts, inspectShotFonts } from "./render/fonts.js";
export type { FontDependency, FontInspection, FontPolicy } from "./render/fonts.js";
export { renderEditorialFramePNG, createEditorialRenderSession } from "./render/editorial.js";
export type { ShotAnimation, ShotRenderOptions } from "./model/types/shot.js";
export type { MeshAnimation } from "./model/types/deformation.js";
export type { ShotController } from "./model/types/controllers.js";
export type { ShotMeshBinding } from "./model/types/deformation.js";
export type { StudioContent } from "./model/types/studio.js";
export type {
  EditorialClip,
  EditorialSequence,
  ResolvedEditorialFrame,
} from "./model/types/editorial.js";
export { normalizeRate, rescaleTime } from "./animation/rational-time.js";
export type { RationalRate, TimeRounding, TimeConversion } from "./animation/rational-time.js";
export { capabilities } from "./runtime/capabilities.js";
export type { CapabilityReport, CapabilityEntry } from "./runtime/capabilities.js";
export type { DependencyAvailability } from "./runtime/dependencies.js";
export { CodeboardError } from "./model/errors.js";
export type { ErrorCode } from "./model/errors.js";
export type { EditCommand, EditPlan, CommitReceipt, CommitResult } from "./core/edit-plan/types.js";
export { planDrawingElement, planShotElement } from "./core/edit-plan/artwork.js";
export { planShotAnimation } from "./core/edit-plan/studio.js";
export { planComponentSource } from "./core/edit-plan/component-source.js";
export type { ShotDuplicateOptions, ShotDuplicateResult } from "./core/project/duplicate-shot.js";
export type { ShotDependency } from "./model/shot-dependencies.js";
export { mergePalette, type PaletteMergeOptions } from "./model/palette-merge.js";
export { planPaletteMerge } from "./core/production/palette-merge.js";
export { exportShotProject } from "./export/shot-project.js";
export type { ShotSubsetOptions } from "./model/shot-subset.js";
export type { PlanShotAnimation, PlanStudioLayer } from "./core/edit-plan/studio.js";
export type { PlanDrawingElement } from "./core/edit-plan/artwork.js";
export {
  LayerHandle,
  PanelHandle,
  SceneHandle,
  Selection,
  ShotHandle,
  SequenceHandle,
} from "./core/handles.js";
export { brushes, customizeBrush } from "./drawing/brushes.js";
export { pathCommands } from "./drawing/path.js";
export { samplePath } from "./drawing/path-sampling.js";
export type { PathSamplingOptions } from "./drawing/path-sampling.js";
export {
  combinePaths,
  pathBounds,
  pathContains,
  splitPathSegment,
} from "./drawing/path-geometry.js";
export type { PathBooleanOperation } from "./drawing/path-geometry.js";
export {
  renderContactSheet,
  renderFrameSheet,
  renderDetail,
  renderOnionSkin,
  renderCompositionGuides,
} from "./render/review.js";
export type { CompositionGuides, OnionSkinSample } from "./render/review.js";
export { evaluateLayer, evaluateCamera, evaluateDrawing } from "./animation/evaluate.js";
export { brushTipFromFunction } from "./drawing/brush-authoring.js";
export { brushParameterSchema } from "./model/schema/brushes.js";
export { renderBrushSwatch } from "./drawing/swatch.js";
export {
  importBrushResource,
  importBrushResourceBuffer,
  brushFromResource,
} from "./drawing/resources.js";
export type {
  BrushResource,
  BrushImportReport,
  ImportedPreset,
  ResourceOrigin,
  ImportOptions,
} from "./drawing/resources.js";
export * as curves from "./drawing/curves.js";
export {
  catmullRom,
  cubic,
  ellipse,
  hatchPolygon,
  line,
  mirrored,
  scale,
  translate,
  withPressure,
} from "./drawing/curves.js";
export {
  createRenderSession,
  renderFrameCanvas,
  renderFramePNG,
} from "./render/panel-renderer.js";
export { exportStoryboard } from "./export/storyboard-export.js";
export { exportReview } from "./export/review-export.js";
export { readReviewManifest } from "./export/review-manifest.js";
export { verifyReviewExport } from "./export/verify-review.js";
export {
  createReviewDecision,
  readReviewDecision,
  verifyReviewDecision,
} from "./export/review-decision.js";
export type {
  ReviewDecisionInput,
  ReviewDecision,
  ReviewDecisionVerifyOptions,
} from "./export/review-decision.js";
export type {
  ReviewExportOptions,
  ReviewManifest,
  ReviewTarget,
  ReviewFrameSource,
} from "./export/review-export.js";
export { exportAnimaticPackage } from "./export/animatic-export.js";
export { exportMovie } from "./export/movie-export.js";
export { createToneWav, encodeWav } from "./audio/wav.js";
export type { WavEncodingOptions } from "./audio/wav.js";
export { startPreview } from "./preview/server.js";
export type * from "./model/types.js";
export { ProjectStore } from "./storage/store.js";
export {
  createPixels,
  readPixelRegion,
  writePixelRegion,
  decodePixels,
  encodePixels,
} from "./drawing/pixels.js";
export {
  polygonPixelSelection,
  colorPixelSelection,
  combinePixelSelections,
  invertPixelSelection,
  featherPixelSelection,
} from "./drawing/pixel-selection.js";
export type { PixelSelection } from "./drawing/pixel-selection.js";
export { fillPixels } from "./drawing/pixel-fill.js";
export type { PixelColor } from "./drawing/pixel-fill.js";

export {
  multiplyMatrices,
  invertMatrix,
  matrixFromTransform,
  transformPoint,
} from "./drawing/math.js";
export type { CoordinateOptions, CoordinateSpace } from "./core/coordinates.js";
export { shotCoordinates } from "./animation/coordinates.js";
export { shotPointCoordinates } from "./animation/shot-points.js";
export { shotMeshData } from "./animation/mesh-inspection.js";
export { bakeCurveMesh, createCurveMeshEvaluator } from "./animation/curve-mesh.js";
export { bakeEnvelopeMesh } from "./animation/envelope-mesh.js";
export { createSkinMeshEvaluator } from "./animation/skin-mesh.js";
export type { SkinMeshInput, LayerSkinInput, SkinJointPose } from "./model/types/deformation.js";
export type { EnvelopeMeshInput, EnvelopeMeshPose } from "./model/types/deformation.js";
export type { CurveMeshPose, CurveMeshInput } from "./animation/curve-mesh.js";
export type { ShotMeshQuery } from "./animation/mesh-inspection.js";
export type { ShotPointOptions, ShotPointCandidate } from "./animation/shot-points.js";
export type { ArtworkCoordinateSpace, ShotCoordinateSpace } from "./animation/coordinates.js";

export { comparePixels } from "./drawing/pixels.js";
export type { PixelComparison } from "./drawing/pixels.js";

export { solveTwoBoneIK } from "./animation/ik.js";
export type { TwoBoneSolution } from "./animation/ik.js";

export type { PanelCaptureOptions, PanelCaptureResult } from "./core/project/capture.js";

export { reviseEditorialSequence } from "./animation/editorial-edit.js";
export type { EditorialEdit } from "./model/types/editorial.js";

export { exportShotMovie, exportEditorialMovie } from "./export/studio-movie.js";
export type { MovieEncodingOptions } from "./export/movie-encoder.js";
export type { MovieOptions } from "./export/movie-export.js";

export { defineStudioAudio, compileStudioAudio } from "./audio/studio.js";
export type { CompiledAudioClip } from "./audio/studio.js";
export type { StudioAudioClip, StudioAudioTrack } from "./model/types/studio-audio.js";

export type { StudioMovieOptions } from "./export/studio-movie.js";

export { conformShotAudio, conformEditorialAudio } from "./audio/conform.js";
export type { AudioConform, ConformedAudioSegment, AudioGainRamp } from "./audio/conform.js";

export { mixShotAudio, mixEditorialAudio } from "./audio/mix.js";
export type { AudioTrackRef } from "./audio/selection.js";
export type {
  AudioDecodeRequest,
  StudioAudioDecoder,
  AudioMixOptions,
  AudioMixResult,
} from "./audio/mix.js";

export { createFFmpegAudioDecoder } from "./audio/ffmpeg-decoder.js";
export type { FFmpegAudioDecoderOptions } from "./audio/ffmpeg-decoder.js";

export { reviseStudioAudio } from "./audio/edit.js";
export type { StudioAudioEdit } from "./model/types/studio-audio.js";

export { reviseShotAnimation } from "./animation/shot-edit.js";
export type { ShotAnimationEdit } from "./model/types/shot.js";
export { exportAudioStems } from "./export/audio-stems.js";
export {
  createFrameJob,
  runFrameJob,
} from "./export/frame-job.js";
export { inspectFrameJob, readFrameJobFrame } from "./export/frame-job-read.js";
export type { FrameJobOptions, RunFrameJobOptions } from "./export/frame-job.js";
export type {
  FrameJobManifest,
  FrameOutputProfile,
  FrameJobFontFile,
} from "./export/frame-job-contract.js";
export { exportFrameJobMovie } from "./export/frame-job-movie.js";
export { exportFrameJobSequence } from "./export/frame-job-sequence.js";
export { verifyFrameSequence } from "./export/verify-frame-sequence.js";
export type { VerifyFrameSequenceOptions } from "./export/verify-frame-sequence.js";
export type { FrameJobSequenceOptions } from "./export/frame-job-sequence.js";
export type { FrameJobMovieOptions } from "./export/frame-job-movie.js";
export { verifyFrameJob } from "./export/verify-frame-job.js";
export type { VerifyFrameJobOptions } from "./export/verify-frame-job.js";
export { verifyAudioStems } from "./export/verify-audio-stems.js";
export { parseAudioStemManifest } from "./export/audio-stems-manifest.js";
export { publishProject, verifyProjectPublish } from "./export/project-publish.js";
export type { PublishProjectOptions } from "./export/project-publish.js";
export type { FontFileDependency } from "./model/schema/font-files.js";
export { parseProjectPublishManifest } from "./export/project-publish-manifest.js";
export type { ProjectPublishManifest } from "./export/project-publish-manifest.js";
export type { CopyProjectOptions } from "./storage/copy.js";
export { mergeShotAnimation } from "./animation/shot-merge.js";
export type {
  ShotMergeOptions,
  ShotMergeConflict,
  ShotMergeReport,
} from "./animation/shot-merge.js";
export { planShotMerge } from "./core/production/shot-merge.js";
export { planShotHandoffMerge } from "./core/production/shot-handoff.js";
export { importOTIO } from "./interchange/otio/import.js";
export { exportOTIO } from "./interchange/otio/export.js";
export type {
  OTIOMediaBinding,
  OTIOOptions,
  OTIOImportOptions,
  OTIOLoss,
} from "./interchange/otio/contract.js";
export type {
  AudioStemTarget,
  AudioStemExportOptions,
  AudioStemManifest,
} from "./export/audio-stems.js";

export type { AudioSampleRounding } from "./audio/sample-clock.js";

export { shotControllerData, type ShotControllerQuery } from "./animation/controller-inspection.js";

export {
  compileControllerTransfer,
  type ControllerTransferOptions,
} from "./animation/controller-transfer.js";

export {
  captureShotController,
  type ControllerCaptureOptions,
} from "./animation/controller-capture.js";

export {
  createControllerPerformance,
  readControllerPerformance,
  compileControllerPerformance,
  type ControllerPerformance,
} from "./animation/controller-performance.js";

export type { ComponentOrigin } from "./model/types/component-origins.js";

export type { ComponentUpgradeOptions } from "./model/component-upgrade.js";
export { importPSD } from "./interchange/psd/import.js";
export type {
  PSDImportOptions,
  PSDImportResult,
  PSDImportLoss,
} from "./interchange/psd/contract.js";
