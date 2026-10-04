import { afterEach, expect, test, vi } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createInterface } from "node:readline/promises";
import { cachedRelease, confirmUpdate, installationArguments, latestRelease, newerRelease, notifyUpdate, verifyInstaller } from "../src/updates.js";

vi.mock("node:readline/promises", () => ({ createInterface: vi.fn() }));

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

test("interactive confirmation defaults to no and only accepts yes", async () => {
  const streams = [process.stdin, process.stderr];
  const descriptors = streams.map(stream => Object.getOwnPropertyDescriptor(stream, "isTTY"));
  const question = vi.fn(), close = vi.fn();
  vi.mocked(createInterface).mockReturnValue({ question, close } as unknown as ReturnType<typeof createInterface>);
  vi.stubEnv("CI", undefined);
  try {
    for (const stream of streams) Object.defineProperty(stream, "isTTY", { value: true, configurable: true });
    for (const [answer, accepted] of [["", false], ["n", false], ["anything", false], ["y", true], [" YES ", true]] as const) {
      question.mockResolvedValueOnce(answer);
      expect(await confirmUpdate()).toBe(accepted);
    }
    expect(close).toHaveBeenCalledTimes(5);
    Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
    await expect(confirmUpdate()).rejects.toThrow("--yes");
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await notifyUpdate("unused", "0.2.0");
    expect(fetch).not.toHaveBeenCalled();
    expect(question).toHaveBeenCalledTimes(5);
  } finally {
    streams.forEach((stream, index) => { const descriptor = descriptors[index]; if (descriptor) Object.defineProperty(stream, "isTTY", descriptor); else Reflect.deleteProperty(stream, "isTTY"); });
  }
});

test("stable versions compare numerically and do not downgrade", () => {
  expect(newerRelease("0.10.0", "0.9.12")).toBe(true);
  expect(newerRelease("0.2.0", "0.2.0-beta.1")).toBe(true);
  expect(newerRelease("0.2.0", "0.3.0-beta.1")).toBe(false);
  expect(newerRelease("0.2.0", "0.2.0")).toBe(false);
  expect(newerRelease("0.2.0", "0.2.0+build.42")).toBe(false);
  expect(newerRelease("0.2.1", "0.2.0+build.42")).toBe(true);
  expect(() => newerRelease("../../evil", "0.2.0")).toThrow();
});

test("release lookup rejects prereleases, invalid tags and HTTP errors", async () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  for (const body of [{ tag_name: "v1.0.0", prerelease: true }, { tag_name: "v1.0.0", draft: true }, { tag_name: "v1.0.0-beta" }, { tag_name: "v01.0.0" }]) {
    fetch.mockResolvedValueOnce(Response.json(body));
    await expect(latestRelease()).rejects.toThrow("stable");
  }
  fetch.mockResolvedValueOnce(new Response("", { status: 403 }));
  await expect(latestRelease()).rejects.toThrow("HTTP 403");
});

test("daily cache covers success, offline failures, expiry and damaged data", async () => {
  const directory = await mkdtemp(join(tmpdir(), "codeboard-cache-test-"));
  const path = join(directory, "nested", "check.json");
  const fetch = vi.fn().mockResolvedValue(Response.json({ tag_name: "v0.10.0" })); vi.stubGlobal("fetch", fetch);
  try {
    expect(await cachedRelease(path)).toBe("0.10.0");
    expect(await cachedRelease(path)).toBe("0.10.0");
    expect(fetch).toHaveBeenCalledTimes(1);
    await writeFile(path, JSON.stringify({ checkedAt: Date.now() - 86400001, latest: "0.10.0" }));
    fetch.mockRejectedValue(new Error("offline"));
    expect(await cachedRelease(path)).toBeUndefined();
    expect(await cachedRelease(path)).toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(await readFile(path, "utf8")).checkedAt).toBeTypeOf("number");
    await writeFile(path, "broken");
    fetch.mockResolvedValue(Response.json({ tag_name: "v1.0.0" }));
    expect(await cachedRelease(path)).toBe("1.0.0");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("updater only targets installer-owned versions, including custom paths", async () => {
  const directory = await mkdtemp(join(tmpdir(), "Codeboard artist's studio-"));
  const version = join(directory, "versions", "0.2.0");
  const packagePath = join(version, "package.json");
  try {
    await mkdir(version, { recursive: true });
    await expect(installationArguments(packagePath, "0.2.0", "0.3.0")).rejects.toThrow("not managed");
    await writeFile(join(version, ".codeboard-install"), "0.2.0\n");
    const args = await installationArguments(packagePath, "0.2.0", "0.3.0");
    expect(args).toContain(directory);
    expect(args).toContain("0.3.0");
    expect(args).toContain(process.platform === "win32" ? "-NoModifyPath" : "--no-modify-path");
    await expect(installationArguments(packagePath, "0.1.0", "0.3.0")).rejects.toThrow("not managed");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("installer verification refuses tampering, missing and duplicate checksums", () => {
  const bytes = Buffer.from("installer");
  const line = `${createHash("sha256").update(bytes).digest("hex")}  install.sh\n`;
  expect(() => verifyInstaller(bytes, line, "install.sh")).not.toThrow();
  expect(() => verifyInstaller(Buffer.from("tampered"), line, "install.sh")).toThrow();
  expect(() => verifyInstaller(bytes, line, "install.ps1")).toThrow();
  expect(() => verifyInstaller(bytes, line + line, "install.sh")).toThrow();
});
