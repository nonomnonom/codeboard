import { readFile, writeFile } from "node:fs/promises";
import { chapters, lessons } from "../examples/studies/src/learning/index.ts";
import { studies } from "../examples/studies/src/catalog.ts";
import { studyDocs } from "./studies-docs.ts";

const lines = [
  "# See what changes",
  "",
  "Small visual lessons in drawing, motion and delivery. Start with a question, compare the pictures, then try one change yourself.",
  "",
  "Asset index for maintainers. The rendered comparisons appear directly in the relevant Fumadocs feature guides.",
  "",
  "The chapters below follow a learning order. Source links below reproduce each rendered comparison.",
  "",
];
for (const chapter of chapters) {
  lines.push(`## ${chapter.title}`, "", chapter.introduction, "");
  for (const lesson of chapter.lessons) {
    const study = studies.find((study) => study.id === lesson.id);
    if (!study) throw new Error(`Unknown lesson: ${lesson.id}`);
    lines.push(
      `### ${lesson.title}`,
      "",
      lesson.question,
      "",
      `![${lesson.observe}](../../website/public/art/guides/${lesson.id}.png)`,
      "",
      `**Look for:** ${lesson.observe}`,
      "",
      lesson.takeaway,
      "",
      `**Try:** ${lesson.experiment}`,
      "",
      `[Read the source](src/studies/${lesson.source})` +
        (study.video || study.media
          ? ` · [Play the clip](../../website/public/art/guides/${lesson.id}.mp4)`
          : ""),
      "",
    );
  }
}
await writeFile(
  new URL("../examples/studies/GALLERY.md", import.meta.url),
  `${lines.join("\n")}\n`,
);

const guides = new Map<string, typeof lessons>();
for (const lesson of lessons) {
  const pages = studyDocs[lesson.id];
  if (!pages?.length) throw new Error(`Missing documentation association: ${lesson.id}`);
  for (const page of pages) guides.set(page, [...(guides.get(page) ?? []), lesson]);
}
for (const id of Object.keys(studyDocs))
  if (!lessons.some((lesson) => lesson.id === id)) throw new Error(`Unknown mapped study: ${id}`);

const sections: Record<string, Record<string, string>> = {
  "animation/camera": {
    "perspective-guides": "Framing guides and isolated artwork",
    "camera-framing": "Revise the framing",
    "camera-depth": "Build depth",
  },
  "drawing/marks": {
    representations: "Paint a curved stroke",
    "stroke-outline": "Draw an editable contour",
    "gradient-fills": "Gradient fills, text, and contour tools",
    "vector-booleans": "Gradient fills, text, and contour tools",
  },
  "drawing/pixels": {
    "color-import": "Import an image as editable pixels",
    selections: "Fill a polygon selection",
    "psd-import": "Import editable PSD pixels",
    representations: "Edit a bounded region",
  },
  "drawing/layers": {
    clipping: "Clip and mask",
    masks: "Clip and mask",
    "blend-modes": "Move, rotate, or hide a layer",
  },
  "delivery/passes": {
    "render-passes": "Render selected shot layers as a pass",
    "output-profiles": "Separate master and review profiles",
  },
  "workflow/review": {
    "perspective-guides": "Render a useful view",
    "saved-revision": "Apply a reversible change",
    "review-tools": "Compare layers with onion skin",
  },
};
for (const [page, related] of guides) {
  const path = new URL(`../docs/${page}.md`, import.meta.url);
  let content = (await readFile(path, "utf8"))
    .replaceAll("\r\n", "\n")
    .replace(/\n<!-- visual-studies:start -->[\s\S]*?<!-- visual-studies:end -->\n?/g, "")
    .replace(/\n<!-- study:[\w-]+:start -->[\s\S]*?<!-- study:[\w-]+:end -->\n?/g, "");
  const groups = new Map<string, typeof lessons>();
  for (const lesson of related) {
    if (content.includes(`/guides/${lesson.id}.png`)) {
      content = content.replace(
        new RegExp(`(?<!\\[)(!\\[[^\\]]*\\]\\(([^)]+/guides/${lesson.id}\\.png)\\))`, "g"),
        "[$1]($2)",
      );
      continue;
    }
    const heading = sections[page]?.[lesson.id] ?? "";
    groups.set(heading, [...(groups.get(heading) ?? []), lesson]);
  }
  for (const [heading, entries] of groups) {
    const block = entries
      .map((lesson) =>
        [
          `<!-- study:${lesson.id}:start -->`,
          `**${lesson.title}.** ${lesson.question}`,
          "",
          `[![${lesson.observe}](../../website/public/art/guides/${lesson.id}.png)](../../website/public/art/guides/${lesson.id}.png)`,
          "",
          `${lesson.observe} ${lesson.takeaway}`,
          "",
          `<!-- study:${lesson.id}:end -->`,
        ].join("\n"),
      )
      .join("\n\n");
    const marker = heading ? `## ${heading}\n` : null;
    if (marker && !content.includes(marker))
      throw new Error(`Missing section in ${page}: ${heading}`);
    const position = marker ? content.indexOf(marker) + marker.length : content.indexOf("\n## ");
    const at = position < 0 ? content.length : position;
    content = `${content.slice(0, at).trimEnd()}\n\n${block}\n\n${content.slice(at).trimStart()}`;
  }
  await writeFile(path, `${content.trimEnd()}\n`);
}
