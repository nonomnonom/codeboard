import { capabilityCatalog, type CapabilityEntry } from "./capability-catalog.js";
export type { CapabilityEntry } from "./capability-catalog.js";
import { z } from "zod";
import { CodeboardError } from "../model/errors.js";
import { storyboardSchema } from "../model/schema/project.js";
import { commandSchema } from "../core/edit-plan/schema.js";
import { FORMAT_VERSION } from "../storage/container.js";
import { inspectFFmpeg, inspectFFprobe, type DependencyAvailability } from "./dependencies.js";
import { runtimeIdentity } from "./version.js";

export interface CapabilityReport {
  format: "codeboard-capabilities/1";
  runtime: { package: string; version: string; node: string; platform: string };
  projectSchemaVersion: number;
  containerFormatVersion: number;
  features: CapabilityEntry[];
  editCommands: string[];
  dependencies: { ffmpeg: DependencyAvailability; ffprobe: DependencyAvailability };
  formats: { project: string[]; image: string[]; delivery: string[] };
}

const optionsSchema = z
  .object({
    probeDependencies: z.boolean().optional(),
    ffmpegPath: z.string().min(1).max(4096).optional(),
    ffprobePath: z.string().min(1).max(4096).optional(),
  })
  .strict();

/** Implementation inventory, not a production qualification or codec guarantee. */
export async function capabilities(
  options: { probeDependencies?: boolean; ffmpegPath?: string; ffprobePath?: string } = {},
): Promise<CapabilityReport> {
  const parsed = optionsSchema.safeParse(options);
  if (!parsed.success)
    throw new CodeboardError("INVALID_ARGUMENT", "Invalid capability options", {
      details: { issues: parsed.error.issues },
    });
  const [ffmpeg, ffprobe] = await Promise.all([
    parsed.data.probeDependencies
      ? inspectFFmpeg(parsed.data.ffmpegPath)
      : { status: "unchecked" as const },
    parsed.data.probeDependencies
      ? inspectFFprobe(parsed.data.ffprobePath)
      : { status: "unchecked" as const },
  ]);
  return {
    format: "codeboard-capabilities/1",
    runtime: runtimeIdentity(),
    projectSchemaVersion: storyboardSchema.shape.schemaVersion.value,
    containerFormatVersion: FORMAT_VERSION,
    features: capabilityCatalog(),
    editCommands: commandSchema.options.map((schema) => schema.shape.op.value),
    dependencies: { ffmpeg, ffprobe },
    formats: {
      project: ["cboard"],
      image: ["PNG"],
      delivery: ["storyboard PDF", "animatic package", "H.264 movie via FFmpeg"],
    },
  };
}
