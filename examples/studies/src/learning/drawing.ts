import type { Chapter } from "./types.ts";

export const drawing: Chapter = {
  id: "drawing",
  title: "Marks, edges and color",
  introduction:
    "Start with a still image. Compare the edge, the fill and the way a change spreads.",
  lessons: [
    {
      id: "representations",
      title: "One gesture, different materials",
      question: "What changes when you draw with a brush, a vector or pixels?",
      observe:
        "Compare the grain of the first stroke with the smooth edge of the second. The third picture enlarges a tiny pixel triangle; scaling softens its low-resolution edge.",
      takeaway:
        "The brush and vector use the same pen path. The pixel triangle is a separate drawing that shows a different editing material.",
      experiment:
        "Change the brush size from 34 to 60. Then change only the vector width and compare their edges.",
      source: "drawing/representations.ts",
    },
    {
      id: "clipping",
      title: "Keep the paint inside",
      question: "How do you stop a highlight spilling outside a shape?",
      observe:
        "Follow the pale stripes across the outer edge. In the last image, the overflow disappears while the coat stays the same.",
      takeaway:
        "Clipping uses the layer below as the boundary. You can keep moving the highlight without redrawing that boundary.",
      experiment: "Move one stripe upward. Compare it with clipping off and on.",
      source: "drawing/clipping.ts",
    },
    {
      id: "selections",
      title: "A sharp edge or a soft edge",
      question: "What does feathering change?",
      observe:
        "Look at the triangle's outline. The second fill fades out around the same selection boundary.",
      takeaway:
        "Feathering changes how much paint reaches the edge; it does not replace the triangle with a new shape.",
      experiment: "Change the feather amount from 8 to 16 source pixels and compare the edge.",
      source: "drawing/selections.ts",
    },
    {
      id: "palettes",
      title: "Recolor a group, keep one exception",
      question: "Can one color change update several objects?",
      observe:
        "The two shared coats turn blue together. The dark coat keeps its own color. In the final step, the trim changes separately.",
      takeaway:
        "A shared swatch connects colors. A local override lets one object remain different.",
      experiment: "Change the cloth swatch to red. Leave the third coat's override alone.",
      source: "drawing/palettes.ts",
    },
    {
      id: "color-import",
      title: "Bring colors into the same workspace",
      question: "Why inspect color when importing an image?",
      observe:
        "Each row shows an imported swatch against light and dark backgrounds. Compare the color and the transparent portions, not the row names alone.",
      takeaway:
        "Source profiles and bit depth describe input pixels. Import converts these examples to editable sRGB pixels.",
      experiment:
        "Open the two PNG fixtures beside the generated image. Compare the translucent edges on both backgrounds.",
      source: "drawing/color-import.ts",
    },
  ],
};
