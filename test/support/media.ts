import { execFileSync } from "node:child_process";

for (const [variable, executable] of [
  ["FFMPEG_PATH", "ffmpeg"],
  ["FFPROBE_PATH", "ffprobe"],
] as const) {
  const path = process.env[variable] ?? executable;
  const version = execFileSync(path, ["-version"], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 5_000,
  });
  if (!version.startsWith(`${executable} version `))
    throw new Error(`${variable} must point to a working ${executable} executable`);
  process.env[variable] = path;
}
