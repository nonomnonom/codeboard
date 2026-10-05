import { expect, test } from "vitest";
import { resolveDocLink } from "../../website/lib/doc-links.js";

test("nested guides resolve document, media and repository links from their own location", () => {
  expect(resolveDocLink("animation/meshes.md", "../drawing/layers.md#clip-and-mask")).toBe(
    "/docs/drawing/layers/#clip-and-mask",
  );
  expect(
    resolveDocLink(
      "start/first-drawing.md",
      "../../website/public/art/guides/quickstart.png",
      "/codeboard",
    ),
  ).toBe("/codeboard/art/guides/quickstart.png");
  expect(resolveDocLink("learn/studies.md", "../../examples/studies/README.md")).toBe(
    "https://github.com/nonomnonom/codeboard/blob/main/examples/studies/README.md",
  );
  expect(resolveDocLink("reference/api/project.md", "../index.md")).toBe("/docs/reference/");
  expect(resolveDocLink("start/first-drawing.md", "../index.md")).toBe("/docs/");
});

test("absolute URLs and same-page fragments retain their meaning", () => {
  for (const href of [
    "https://example.com/a#b",
    "#save",
    "/download/",
    "mailto:reader@example.com",
    "?view=raw",
  ])
    expect(resolveDocLink("start/first-drawing.md", href)).toBe(href);
  expect(resolveDocLink("delivery/export.md", "movies.md?view=raw#mix-studio-audio-into-mp4")).toBe(
    "/docs/delivery/movies/?view=raw#mix-studio-audio-into-mp4",
  );
});
