import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir, symlink, stat, rm } from "node:fs/promises";
import { join, resolve, dirname, sep } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { unzipSync } from "fflate";
import { studies } from "../examples/studies/src/catalog.js";
import { createHash } from "node:crypto";

const networkInstall = process.env.CODEBOARD_STUDIES_NETWORK_INSTALL === "1";

it(
  "runs the downloaded documentation studies against their bundled engine and emits real feature assets",
  async () => {
    const installRoot = resolve(".preview/studies-install");
    if (networkInstall) await mkdir(installRoot, { recursive: true });
    const directory = await mkdtemp(
      networkInstall ? join(installRoot, "run-") : join(tmpdir(), "codeboard-studies-download-"),
    );
    try {
      const archive = await readFile("website/public/art/examples/studies.zip");
      if (networkInstall) await writeFile(join(directory, "source.zip"), archive);
      const entries = unzipSync(archive);
      for (const [name, bytes] of Object.entries(entries)) {
        const path = resolve(directory, name);
        assert.ok(path.startsWith(directory + sep));
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, bytes);
      }
      const cwd = join(directory, "studies"),
        modules = join(cwd, "node_modules"),
        engine = join(modules, "codeboard-studio");
      const manifest = JSON.parse(await readFile(join(cwd, "package.json"), "utf8"));
      expect(manifest.dependencies["codeboard-studio"]).toBe("file:vendor/codeboard-studio.tgz");
      expect(await readFile(join(cwd, "src/fixtures/schema3.cboard"))).toEqual(
        await readFile("test/fixtures/schema3/legacy.cboard"),
      );
      expect(await readFile(join(cwd, "src/fixtures/cuts.otio"))).toEqual(
        await readFile("test/fixtures/otio/cuts.otio"),
      );
      if (networkInstall) {
        const npm =
          process.env.npm_execpath ??
          join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
        const install = spawnSync(
          process.execPath,
          [
            npm,
            "install",
            "--cache",
            join(directory, "empty-cache"),
            "--registry",
            "https://registry.npmjs.org",
            "--no-audit",
            "--no-fund",
          ],
          {
            cwd,
            encoding: "utf8",
            windowsHide: true,
            timeout: 180000,
          },
        );
        await writeFile(join(directory, "install.log"), install.stdout + install.stderr);
        assert.equal(install.status, 0, install.error?.message ?? install.stdout + install.stderr);
        const dependencies = spawnSync(process.execPath, [npm, "ls", "--all", "--json"], {
          cwd,
          encoding: "utf8",
          windowsHide: true,
          timeout: 30000,
        });
        assert.equal(dependencies.status, 0, dependencies.stderr);
        await writeFile(join(directory, "dependencies.json"), dependencies.stdout);
        const resolution = spawnSync(
          process.execPath,
          [
            "--input-type=module",
            "--eval",
            `
        import { createRequire } from 'node:module';
        import { readFileSync, realpathSync } from 'node:fs';
        import { resolve, sep } from 'node:path';
        import assert from 'node:assert/strict';
        const modules = realpathSync('node_modules');
        const manifest = resolve('node_modules/codeboard-studio/package.json');
        const require = createRequire(manifest);
        const dependencies = Object.keys(JSON.parse(readFileSync(manifest, 'utf8')).dependencies);
        const paths = Object.fromEntries(dependencies.map(name => [name, realpathSync(require.resolve(name))]));
        for (const path of Object.values(paths)) assert(path.startsWith(modules + sep));
        assert(realpathSync(resolve('node_modules/codeboard-studio')).startsWith(modules + sep));
        console.log(JSON.stringify(paths, null, 2));
      `,
          ],
          { cwd, encoding: "utf8", windowsHide: true, timeout: 10000 },
        );
        assert.equal(resolution.status, 0, resolution.stderr);
        await writeFile(join(directory, "resolution.json"), resolution.stdout);
      } else {
        await mkdir(engine, { recursive: true });
        const unpack = spawnSync(
          "tar",
          ["-xzf", join(cwd, "vendor/codeboard-studio.tgz"), "--strip-components=1", "-C", engine],
          { encoding: "utf8", windowsHide: true },
        );
        assert.equal(unpack.status, 0, unpack.stderr);
        const engineManifest = JSON.parse(await readFile(join(engine, "package.json"), "utf8"));
        for (const dependency of [...Object.keys(engineManifest.dependencies), "@types"]) {
          const target = join(modules, dependency);
          await mkdir(dirname(target), { recursive: true });
          await symlink(
            resolve("node_modules", dependency),
            target,
            process.platform === "win32" ? "junction" : "dir",
          );
        }
      }
      const typecheck = spawnSync(
        process.execPath,
        [
          networkInstall
            ? join(modules, "typescript/bin/tsc")
            : resolve("node_modules/typescript/bin/tsc"),
          "--noEmit",
          "-p",
          join(cwd, "tsconfig.json"),
        ],
        { cwd, encoding: "utf8", windowsHide: true, timeout: 30000 },
      );
      assert.equal(typecheck.status, 0, typecheck.stdout + typecheck.stderr);
      const output = join(cwd, "generated");
      const video = Boolean(process.env.FFMPEG_PATH && process.env.FFPROBE_PATH);
      const args = [
        join(engine, "dist/src/cli.js"),
        "run",
        join(cwd, "src/cli/run.ts"),
        output,
        ...(video ? ["--video"] : []),
      ];
      const run = spawnSync(process.execPath, args, {
        cwd,
        encoding: "utf8",
        windowsHide: true,
        timeout: 60000,
      });
      assert.equal(run.status, 0, run.stdout + run.stderr);
      const assets = JSON.parse(await readFile(join(output, "manifest.json"), "utf8"));
      expect(
        assets.results
          .filter((entry: { status: string }) => entry.status === "generated")
          .map((entry: { id: string }) => entry.id),
      ).toEqual(studies.filter((study) => video || !study.media).map((study) => study.id));
      for (const feature of assets.coverage)
        if (feature.status !== "unavailable") expect(feature.studies.length).toBeGreaterThan(0);
      for (const entry of assets.results) {
        if (entry.status !== "generated") continue;
        expect((await stat(join(output, entry.image))).size).toBeGreaterThan(100);
        expect((await stat(join(output, entry.id, `${entry.id}.cboard`))).size).toBeGreaterThan(
          100,
        );
      }
      if (video) {
        for (const [name, frames] of [
          ["drawing-timing", 24],
          ["lip-sync", 24],
          ["editorial-cuts", 42],
          ["otio-conform", 42],
          ["shot-merge", 24],
          ["camera-depth", 24],
          ["audio-delivery", 48],
          ["asset-replacement", 24],
          ["font-preflight", 2],
          ["mesh-alpha", 24],
          ["controller-exchange", 96],
          ["deformer-resolution", 24],
          ["component-upgrade", 24],
        ] as const) {
          const probe = spawnSync(
            process.env.FFPROBE_PATH!,
            ["-v", "error", "-show_streams", "-of", "json", join(output, name, `${name}.mp4`)],
            { encoding: "utf8", windowsHide: true },
          );
          assert.equal(probe.status, 0, probe.stderr);
          const streams = JSON.parse(probe.stdout).streams;
          expect(
            Number(
              streams.find((stream: { codec_type: string }) => stream.codec_type === "video")
                .nb_frames,
            ),
          ).toBe(frames);
          if (name === "audio-delivery" || name === "asset-replacement")
            expect(
              streams.some((stream: { codec_type: string }) => stream.codec_type === "audio"),
            ).toBe(true);
        }
      }
      const rerun = spawnSync(process.execPath, args, {
        cwd,
        encoding: "utf8",
        windowsHide: true,
        timeout: 10000,
      });
      expect(rerun.status).not.toBe(0);
      expect(rerun.stderr).toMatch(/EEXIST/);
      if (networkInstall) {
        const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
        await mkdir(".preview/studies-install", { recursive: true });
        await writeFile(
          ".preview/studies-install/latest.json",
          JSON.stringify(
            {
              directory,
              node: process.version,
              platform: process.platform,
              arch: process.arch,
              zipSha256: hash(archive),
              lockSha256: hash(await readFile(join(cwd, "package-lock.json"))),
              engineSha256: hash(await readFile(join(cwd, "vendor/codeboard-studio.tgz"))),
              video,
              assets,
            },
            null,
            2,
          ),
        );
      }
    } finally {
      if (networkInstall) console.log(`Installed study evidence: ${directory}`);
      else await rm(directory, { recursive: true, force: true });
    }
  },
  networkInstall ? 300000 : 120000,
);
