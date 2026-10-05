import type { MetadataRoute } from "next";
import { source } from "@/lib/source";
import { siteUrl } from "@/lib/shared";
export const dynamic = "force-static";
export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/download", "/examples", ...source.getPages().map((page) => page.url)].map(
    (path) => ({ url: `${siteUrl}${path}/` }),
  );
}
