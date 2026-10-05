import { llms, loader } from "fumadocs-core/source";
import { docsRoute } from "./shared";
import { docs } from "../.source/server";

export const source = loader({
  baseUrl: docsRoute,
  source: docs.toFumadocsSource(),
});

export const docsLlms = llms(source, {
  renderPage: async (page) => `# ${page.data.title} (${page.url})

${await page.data.getText("processed")}`,
});
