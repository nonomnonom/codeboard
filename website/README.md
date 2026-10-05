# Codeboard website

Official site and Fumadocs documentation for `codeboard.nonom.xyz`. The site is a static Next.js export; search runs in the browser. No model account or application server is required.

From the repository root, with Node.js 22.22 or later:

```sh
npm ci
npm run build
npm run website:dev
npm run website:build
npm run start --workspace codeboard-website
```

The website is an npm workspace. Its `file:..` dependency resolves the engine from this checkout, using the root lockfile. Run `npm run dev` in another terminal when changing engine source.

The build produces `website/out`. Documentation comes directly from [the canonical docs](../docs/index.md), with navigation in [docs/meta.json](../docs/meta.json) and each task folder's `meta.json`. Edit those files instead of maintaining a second documentation copy. Release links use `releaseVersion` in `lib/shared.ts`.

The website build checks internal links and anchors in the exported HTML. Relative Markdown links such as `../start/installation.md` are resolved from each page's source location by `lib/doc-links.ts`; their source stays usable on GitHub. Links to public assets and repository source retain their existing destinations.

Creator attribution and Nonom Library links come from `creator` in `lib/shared.ts`. The Fumadocs shadcn preset maps the local Nonom design tokens onto navigation, search, page actions, tables, and code blocks. There is no runtime or build dependency on the portfolio repository.

The GitHub Pages workflow builds pull requests and deploys `main`. The domain requires a DNS CNAME named `codeboard` pointing to `nonomnonom.github.io`, and the matching custom domain in GitHub Pages settings. Enable HTTPS when GitHub finishes issuing its certificate.

`NEXT_PUBLIC_SITE_URL` overrides canonical URLs; `NEXT_PUBLIC_BASE_PATH` supports a subpath deployment. Production defaults to the custom domain at its root.

The public artwork and videos are renders of Codeboard's Last Light and LENGKAP examples, distributed under CC0 as recorded in [NOTICE](../NOTICE). Website code is MIT. The visual direction is recorded in [DESIGN.md](DESIGN.md).
