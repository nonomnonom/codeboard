# Releases and versioning

Codeboard uses [Semantic Versioning](https://semver.org/). `package.json` is the version source; the CLI reads it directly. `npm version` also updates the lockfile.

While on `0.x`, patch releases contain compatible fixes; minor releases contain features or breaking changes. Document every breaking API or storage change. Version `1.0.0` requires an explicit stable API decision. From 1.0 onward, incompatible changes increment major, compatible features minor, and fixes patch. Prereleases use versions such as `0.2.0-beta.1`.

## Prepare a release

1. Create a release branch from current `main`.
2. Run `npm version patch --no-git-tag-version` (or `minor`, `major`, or an explicit prerelease version).
3. Move Unreleased notes into `## [VERSION] - YYYY-MM-DD` in `CHANGELOG.md`.
4. Run `npm run check` with `FFMPEG_PATH` set, then open and merge the release PR after CI passes.
5. Tag the merged commit and push the tag:

```sh
git switch main
git pull --ff-only
git tag -a v0.2.0 -m "Codeboard v0.2.0"
git push origin v0.2.0
```

Use the actual version, not the example above. Never move a published tag; make a new patch release instead.

## Automation

CI checks Linux, macOS and Windows, Node 22.22 and Node 24, plus FFmpeg integration. Dependabot proposes dependency and GitHub Actions updates weekly. Actions are pinned to commit hashes.

A `v*` tag triggers `.github/workflows/release.yml`. It verifies tag/package/lockfile/changelog agreement, builds, runs the full suite with FFmpeg, and checks a clean SDK installation. Four native runners also create portable packages with Node and production dependencies. Each archive is extracted and tested using its bundled Node and CLI launcher before upload. Only after every job passes does the workflow publish a GitHub Release with the four OS packages, SDK `.tgz`, and SHA256SUMS.

Publishing is GitHub-only. No npm registry token, OIDC publisher or account is required. npm remains a build-time dependency manager. The SDK archive can optionally be installed in another JS project with `npm install ./codeboard-studio-VERSION.tgz`; portable users do not need npm. See [per-OS installation](install.md).

To verify packaging before tagging, manually dispatch the Release workflow on a branch. It builds and tests artifacts but does not publish a release. Tag dispatch publishes normally. Failed checks prevent publication; rerun a failed workflow from Actions after addressing the cause. Never replace an already published version.

Maintainers create version tags only from a reviewed commit with passing CI. Main branch requires the CI gate and pull requests; admins retain emergency bypass. Review the archive contents and licensing when adding assets or dependencies. Original example media has separate CC0 terms in `NOTICE`; application code is MIT.

Rendering tests allow up to two channel levels for analytical alpha-compositing expectations across Skia CPU/GPU backends. Save/open and undo replay checks remain exact within the same runtime.
