# Codeboard website

Official site and Fumadocs documentation for `codeboard.nonom.xyz`. The site is a static Next.js export; search runs in the browser. No model account or application server is required.

From the repository root, with Node.js 22.22 or later:

```sh
npm ci --prefix website
npm run dev --prefix website
npm run build --prefix website
npm run start --prefix website
```

The build produces `website/out`. Documentation comes directly from [the canonical docs](../docs/index.md), with navigation in [docs/meta.json](../docs/meta.json). Edit those files instead of maintaining a second documentation copy. Release links use `releaseVersion` in `lib/shared.ts`.

The GitHub Pages workflow builds pull requests and deploys `main`. The domain requires a DNS CNAME named `codeboard` pointing to `nonomnonom.github.io`, and the matching custom domain in GitHub Pages settings. Enable HTTPS when GitHub finishes issuing its certificate.

`NEXT_PUBLIC_SITE_URL` overrides canonical URLs; `NEXT_PUBLIC_BASE_PATH` supports a subpath deployment. Production defaults to the custom domain at its root.

The public artwork and videos are renders of Codeboard's Last Light and LENGKAP examples, distributed under CC0 as recorded in [NOTICE](../NOTICE). Website code is MIT. The visual direction is recorded in [DESIGN.md](DESIGN.md).
