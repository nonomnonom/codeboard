import { execFile } from "node:child_process";
import { CodeboardError } from "../model/errors.js";

/** Translate only executable lookup failures; media, permission and codec errors remain distinct. */
export function dependencyStartupError(
  dependency: "ffmpeg" | "ffprobe",
  executable: string,
  cause: Error,
): Error {
  const code = (cause as NodeJS.ErrnoException).code;
  if (code !== "ENOENT" && code !== "ENOTDIR") return cause;
  return new CodeboardError("MISSING_DEPENDENCY", `${dependency} executable is unavailable`, {
    cause,
    details: { dependency, executable, reason: code },
  });
}

export interface DependencyAvailability {
  status: "unchecked" | "available" | "unavailable";
  version?: string;
  reason?: string;
}

export function ffmpegExecutable(path?: string): string {
  return path ?? process.env.FFMPEG_PATH ?? "ffmpeg";
}

export function ffprobeExecutable(path?: string): string {
  return path ?? process.env.FFPROBE_PATH ?? "ffprobe";
}

/** Checks executable startup only; export still checks media and encoder compatibility. */
export async function inspectFFmpeg(path?: string): Promise<DependencyAvailability> {
  return inspectExecutable(ffmpegExecutable(path), "ffmpeg");
}

export async function inspectFFprobe(path?: string): Promise<DependencyAvailability> {
  return inspectExecutable(ffprobeExecutable(path), "ffprobe");
}

function inspectExecutable(
  executable: string,
  dependency: "ffmpeg" | "ffprobe",
): Promise<DependencyAvailability> {
  return new Promise((resolve) => {
    execFile(
      executable,
      ["-version"],
      { windowsHide: true, timeout: 2000, maxBuffer: 32768, encoding: "utf8" },
      (error, stdout) => {
        if (error) {
          resolve({
            status: "unavailable",
            reason: error.killed
              ? "Probe exceeded time/output limit"
              : String(error.code ?? "EXECUTION_FAILED"),
          });
          return;
        }
        const version = stdout.split(/\r?\n/, 1)[0]?.trim() ?? "";
        if (!version.startsWith(`${dependency} version `)) {
          resolve({
            status: "unavailable",
            reason: `Executable did not identify itself as ${dependency === "ffmpeg" ? "FFmpeg" : "ffprobe"}`,
          });
          return;
        }
        resolve({ status: "available", version: version.slice(0, 256) });
      },
    );
  });
}
