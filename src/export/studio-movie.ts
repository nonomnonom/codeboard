import { createShotRenderSession } from "../render/shot.js";
import { createEditorialRenderSession } from "../render/editorial.js";
import type { ShotAnimation } from "../model/types/shot.js";
import type { EditorialSequence } from "../model/types/editorial.js";
import {
  prepareShotMovie,
  prepareEditorialMovie,
  type StudioMovieOptions,
} from "./studio-movie-source.js";
import { publishStudioMovie } from "./studio-movie-publish.js";
export type { StudioMovieOptions } from "./studio-movie-source.js";

/** Export a frozen shot with an explicit mix/omission policy when audio is authored. */
export async function exportShotMovie(
  animation: ShotAnimation,
  output: string,
  options: StudioMovieOptions = {},
) {
  const prepared = await prepareShotMovie(animation, options);
  const session = createShotRenderSession(prepared.source);
  return publishStudioMovie(
    {
      ...prepared.selected,
      png: (frame) => session.png(prepared.selected.range.startFrame + frame),
    },
    output,
    prepared.settings,
    prepared.mix,
  );
}

export async function exportEditorialMovie(
  sequence: EditorialSequence,
  animations: readonly ShotAnimation[],
  output: string,
  options: StudioMovieOptions = {},
) {
  const prepared = await prepareEditorialMovie(sequence, animations, options);
  const session = createEditorialRenderSession(prepared.sequence, prepared.animations);
  return publishStudioMovie(
    {
      ...prepared.selected,
      png: (frame) => session.png(prepared.selected.range.startFrame + frame),
    },
    output,
    prepared.settings,
    prepared.mix,
  );
}
