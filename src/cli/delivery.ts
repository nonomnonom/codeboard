import type { Command } from "commander";
import { registerReviewCommand, registerFrameCommand } from "./delivery/review.js";
import { registerStoryboardCommands } from "./delivery/storyboard.js";
import { registerMovieCommand } from "./delivery/movie.js";

export function registerDeliveryCommands(program: Command): void {
  registerReviewCommand(program);
  registerStoryboardCommands(program);
  registerMovieCommand(program);
  registerFrameCommand(program);
}
