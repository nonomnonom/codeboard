import { posix } from "node:path";

/** Resolve links from nested Markdown while preserving their fragments and query strings. */
export function resolveDocLink(pagePath: string, href: string, basePath = ""): string {
  if (/^(?:[a-z][a-z\d+.-]*:|\/|#|\?)/i.test(href)) return href;
  const suffixAt = href.search(/[?#]/);
  const file = suffixAt < 0 ? href : href.slice(0, suffixAt);
  const suffix = suffixAt < 0 ? "" : href.slice(suffixAt);
  const target = posix.normalize(posix.join("docs", posix.dirname(pagePath), file));
  if (target.startsWith("website/public/"))
    return `${basePath}/${target.slice("website/public/".length)}${suffix}`;
  if (target.startsWith("docs/") && target.endsWith(".md")) {
    const route = target.slice(0, -3).replace(/\/index$/, "");
    return `${basePath}/${route}/${suffix}`;
  }
  return `https://github.com/nonomnonom/codeboard/blob/main/${target}${suffix}`;
}
