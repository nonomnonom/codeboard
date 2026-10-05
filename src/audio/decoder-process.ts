import { spawn } from "node:child_process";
import { CodeboardError } from "../model/errors.js";
import { dependencyStartupError } from "../runtime/dependencies.js";

export async function runMedia(
  dependency: "ffmpeg" | "ffprobe",
  command: string,
  args: string[],
  input: Buffer,
  limit: number,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<Buffer> {
  if (signal?.aborted) throw new CodeboardError("CANCELLED", "Audio decode cancelled");
  const child = spawn(command, args, { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  let failure: Error | undefined,
    total = 0,
    stderr = "";
  const chunks: Buffer[] = [];
  const fail = (error: Error) => {
    failure ??= error;
    child.kill();
  };
  const abort = () => fail(new CodeboardError("CANCELLED", "Audio decode cancelled"));
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  const timer = setTimeout(
    () => fail(new CodeboardError("RESOURCE_LIMIT", "Audio decoder process timed out")),
    timeoutMs,
  );
  child.on("error", (error) => fail(dependencyStartupError(dependency, command, error)));
  child.stdout.on("error", fail);
  child.stderr.on("error", fail);
  child.stdin.on("error", (error) => {
    if ((error as NodeJS.ErrnoException).code !== "EPIPE") fail(error);
  });
  child.stdout.on("data", (chunk: Buffer) => {
    total += chunk.length;
    if (total > limit)
      fail(new CodeboardError("RESOURCE_LIMIT", "Audio decoder output exceeds its byte budget"));
    else chunks.push(chunk);
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(-12000);
  });
  const finished = new Promise<number | null>((ready) => child.once("close", ready));
  try {
    child.stdin.end(input);
    const code = await finished;
    if (failure) throw failure;
    if (code !== 0) throw new Error(`Audio decoder failed (${code}): ${stderr}`);
    return Buffer.concat(chunks, total);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await finished;
  }
}
