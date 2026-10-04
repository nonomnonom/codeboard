import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile, rename, rm } from "node:fs/promises";
import { dirname, basename, join } from "node:path";
import { homedir, tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";

const repository = "https://github.com/nonomnonom/codeboard";
const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function newerRelease(latest: string, current: string): boolean {
  if (!stableVersion.test(latest)) throw new Error("GitHub returned an invalid stable release version.");
  const base = current.split("-")[0]!;
  if (!stableVersion.test(base)) return false;
  const a = latest.split(".").map(BigInt), b = base.split(".").map(BigInt);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i]! > b[i]!;
  return current.includes("-");
}

async function download(url: string, timeout: number): Promise<Response> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeout), headers: { "User-Agent": "Codeboard CLI", Accept: "application/vnd.github+json" } });
  if (!response.ok) throw new Error(`Update request failed (HTTP ${response.status}). Try again later.`);
  return response;
}

export async function latestRelease(timeout = 10000): Promise<string> {
  const response = await download("https://api.github.com/repos/nonomnonom/codeboard/releases/latest", timeout);
  const release = await response.json() as { tag_name?: unknown; draft?: boolean; prerelease?: boolean };
  if (typeof release.tag_name !== "string" || !release.tag_name.startsWith("v") || !stableVersion.test(release.tag_name.slice(1)) || release.draft || release.prerelease) {
    throw new Error("GitHub did not return a stable Codeboard release.");
  }
  return release.tag_name.slice(1);
}

export function updateCachePath(): string {
  const root = process.platform === "win32" ? process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local") : process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache");
  return join(root, "codeboard", "update-check.json");
}

export async function cachedRelease(cachePath: string): Promise<string | undefined> {
  const now = Date.now();
  try {
    const cache = JSON.parse(await readFile(cachePath, "utf8")) as { checkedAt: number; latest?: string };
    if (Number.isFinite(cache.checkedAt) && now >= cache.checkedAt && now - cache.checkedAt < 86400000) {
      return typeof cache.latest === "string" && stableVersion.test(cache.latest) ? cache.latest : undefined;
    }
  } catch { /* A missing or damaged cache is safe to rebuild. */ }
  let latest: string | undefined;
  try { latest = await latestRelease(1500); } catch { /* Offline commands still run; retry tomorrow. */ }
  const temporary = `${cachePath}.${process.pid}.tmp`;
  try {
    await mkdir(dirname(cachePath), { recursive: true });
    await writeFile(temporary, JSON.stringify({ checkedAt: now, latest }));
    await rename(temporary, cachePath);
  } catch { /* Update checks do not require a writable cache. */ }
  finally { await rm(temporary, { force: true }).catch(() => {}); }
  return latest;
}

export async function confirmUpdate(): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stderr.isTTY || process.env.CI) {
    throw new Error("Update needs confirmation in an interactive terminal. To install from a script, use codeboard update --yes.");
  }
  const terminal = createInterface({ input: process.stdin, output: process.stderr });
  try { return /^(y|yes)$/i.test((await terminal.question("Install update? [y/N] ")).trim()); }
  finally { terminal.close(); }
}

export async function notifyUpdate(packagePath: string, version: string): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY || !process.stderr.isTTY || process.env.CI || process.env.CODEBOARD_NO_UPDATE_CHECK === "1") return;
  const latest = await cachedRelease(updateCachePath());
  if (!latest || !newerRelease(latest, version)) return;
  process.stderr.write(`Codeboard ${latest} is available (installed: ${version}).\n`);
  try { await installationArguments(packagePath, version, latest); }
  catch { process.stderr.write("Update this copy using https://codeboard.nonom.xyz/docs/install/\n"); return; }
  try {
    if (await confirmUpdate()) {
      await installUpdate(packagePath, version, latest);
      process.stderr.write(`Update installed. This command continues with ${version}; new commands use ${latest}.\n`);
    }
  } catch (error) { process.stderr.write(`Could not update: ${error instanceof Error ? error.message : String(error)}\n`); }
}

export async function installationArguments(packagePath: string, current: string, latest: string): Promise<string[]> {
  const directory = dirname(packagePath);
  if (basename(dirname(directory)) !== "versions" || basename(directory) !== current || (await readFile(join(directory, ".codeboard-install"), "utf8").catch(() => "")).trim() !== current) {
    throw new Error("This copy is not managed by the Codeboard installer. Install or update it using https://codeboard.nonom.xyz/docs/install/");
  }
  const root = dirname(dirname(directory));
  if (process.platform === "win32") return ["-Version", latest, "-InstallDir", root, "-NoModifyPath"];
  return ["--version", latest, "--no-modify-path", ...(root === join(homedir(), ".local", "share", "codeboard") ? [] : ["--prefix", root])];
}

export function verifyInstaller(bytes: Uint8Array, checksums: string, name: string): void {
  const matches = checksums.split(/\r?\n/).map(line => /^([a-fA-F0-9]{64})\s+\*?(.+)$/.exec(line)).filter(match => match?.[2] === name);
  if (matches.length !== 1 || createHash("sha256").update(bytes).digest("hex") !== matches[0]![1]!.toLowerCase()) {
    throw new Error("Installer checksum mismatch. Nothing was installed.");
  }
}

export async function installUpdate(packagePath: string, current: string, latest: string): Promise<void> {
  if (!stableVersion.test(latest)) throw new Error("Invalid release version.");
  const args = await installationArguments(packagePath, current, latest);
  const name = process.platform === "win32" ? "install.ps1" : "install.sh";
  const base = `${repository}/releases/download/v${latest}`;
  const bytes = new Uint8Array(await (await download(`${base}/${name}`, 30000)).arrayBuffer());
  const checksums = await (await download(`${base}/SHA256SUMS`, 30000)).text();
  verifyInstaller(bytes, checksums, name);
  const directory = await mkdtemp(join(tmpdir(), "codeboard-update-"));
  try {
    const script = join(directory, name);
    await writeFile(script, bytes);
    const windows = process.platform === "win32";
    const child = spawn(windows ? "powershell.exe" : "sh", windows ? ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, ...args] : [script, ...args], { stdio: "inherit", windowsHide: true });
    const code = await new Promise<number | null>((accept, reject) => { child.once("error", reject); child.once("exit", accept); });
    if (code !== 0) throw new Error("Update did not complete. Retry codeboard update; your previous version is retained.");
  } finally { await rm(directory, { recursive: true, force: true }); }
}
