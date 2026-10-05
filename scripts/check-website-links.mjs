import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const output = fileURLToPath(new URL("../website/out/", import.meta.url));
const origin = "https://codeboard.invalid";
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");
const pages = new Map();

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === "_next") continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collect(path);
    else if (entry.name.endsWith(".html")) pages.set(path, await readFile(path, "utf8"));
  }
}

function decodeAttribute(value) {
  return value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, (entity) => {
    const named = { "&amp;": "&", "&quot;": '"', "&apos;": "'", "&lt;": "<", "&gt;": ">" };
    if (entity in named) return named[entity];
    return String.fromCodePoint(
      entity.startsWith("&#x")
        ? Number.parseInt(entity.slice(3, -1), 16)
        : Number(entity.slice(2, -1)),
    );
  });
}

await collect(output);
const errors = new Set();
const checkedTargets = new Map();
let checked = 0;
for (const [file, html] of pages) {
  const route = relative(output, file)
    .replaceAll("\\", "/")
    .replace(/index\.html$/, "");
  for (const match of html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/gi)) {
    const href = decodeAttribute(match[1]);
    const url = new URL(href, `${origin}${basePath}/${route}`);
    if (url.origin !== origin) continue;
    checked++;
    const pathname = decodeURIComponent(url.pathname);
    if (basePath && pathname !== basePath && !pathname.startsWith(`${basePath}/`)) {
      errors.add(`${route}: outside deployment base path: ${href}`);
      continue;
    }
    const path = join(output, pathname.slice(basePath.length));
    const target = pathname.endsWith("/") ? join(path, "index.html") : path;
    const candidates = [target, `${target}.html`, join(target, "index.html")];
    let found = checkedTargets.get(pathname);
    if (found === undefined) {
      found = null;
      for (const candidate of candidates) {
        if (pages.has(candidate)) {
          found = candidate;
          break;
        }
        try {
          if ((await stat(candidate)).isFile()) {
            found = candidate;
            break;
          }
        } catch {
          /* Try the next static export form. */
        }
      }
      checkedTargets.set(pathname, found);
    }
    if (!found) errors.add(`${route}: missing target ${href}`);
    else if (url.hash && pages.has(found)) {
      const id = decodeURIComponent(url.hash.slice(1));
      const ids = new Set(
        [...pages.get(found).matchAll(/\bid="([^"]*)"/g)].map((m) => decodeAttribute(m[1])),
      );
      if (!ids.has(id)) errors.add(`${route}: missing anchor ${href}`);
    }
  }
}
if (errors.size) {
  console.error([...errors].join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Verified ${checked} internal links and anchors across ${pages.size} exported HTML pages.`,
  );
}
