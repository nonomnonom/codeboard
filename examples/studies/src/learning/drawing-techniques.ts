import type { Chapter } from "./types.ts";

export const drawingTechniques: Chapter = {
  id: "drawing-techniques",
  title: "Color, construction and surface",
  introduction: "Keep the drawing fixed while changing one rendering choice.",
  lessons: [
    {
      id: "layer-order",
      title: "Change overlap and parent space",
      question: "Why does moving a layer in the hierarchy change its picture?",
      observe: "Blue first covers amber, then goes behind it, then shifts with an offset parent.",
      takeaway: "Stack order controls overlap. Reparenting also changes the coordinate space.",
      experiment: "Move the parent without editing the blue card coordinates.",
      source: "drawing/layer-order.ts",
    },
    {
      id: "stroke-outline",
      title: "Turn a stroke into editable geometry",
      question: "When should a stroke become a contour?",
      observe: "The first two silhouettes match; the final one has a rectangle cut out.",
      takeaway:
        "Outlining preserves the shape but replaces stroke-width editing with contour editing.",
      experiment: "Change the rectangular cutting path after outlining.",
      source: "drawing/stroke-outline.ts",
    },
    {
      id: "brush-import",
      title: "Use an imported shape as a brush tip",
      question: "How does a PNG become a repeating mark?",
      observe: "Compare close and wide spacing with the same diamond-shaped tip.",
      takeaway:
        "This study authors a PNG locally, imports its alpha, then uses Codeboard brush settings. It does not emulate a foreign brush engine.",
      experiment: "Edit the diamond PNG construction and reimport the resource.",
      source: "drawing/brush-import.ts",
    },
    {
      id: "masks",
      title: "Reveal artwork through a mask",
      question: "How can you move a boundary without moving the paint?",
      observe: "The arch moves right while the stripes stay in their original positions.",
      takeaway: "A mask supplies alpha coverage from another layer, including a hidden layer.",
      experiment: "Change the mask shape and keep the striped layer unchanged.",
      source: "drawing/masks.ts",
    },
    {
      id: "perspective-guides",
      title: "Draw toward a vanishing point",
      question: "Where should the floor lines meet?",
      observe: "Compare the authored floor with the horizon and vanishing-point overlays.",
      takeaway:
        "The guides help inspect a drawing. They do not generate perspective geometry or turn the scene into 3D.",
      experiment: "Move the vanishing point and redraw the floor lines to match.",
      source: "drawing/perspective-guides.ts",
    },
    {
      id: "gradient-fills",
      title: "Shape a fill with color",
      question: "How can a flat contour suggest volume?",
      observe: "The contour stays fixed while the color becomes directional, then radial.",
      takeaway: "A gradient changes the fill inside an existing shape.",
      experiment: "Move the radial center toward the lower right.",
      source: "drawing/gradient-fills.ts",
    },
    {
      id: "vector-booleans",
      title: "Build a shape from two shapes",
      question: "What remains when two shapes overlap?",
      observe: "Compare the overlap with union, intersection, difference and exclusive-or.",
      takeaway: "Boolean operations create new path geometry from the same two inputs.",
      experiment: "Move the triangle and compare the intersection again.",
      source: "drawing/vector-booleans.ts",
    },
    {
      id: "brush-dynamics",
      title: "Let pressure shape the stroke",
      question: "What does pen pressure change?",
      observe: "Compare the width at the ends and middle, then look for separate brush stamps.",
      takeaway: "Pressure response and stamp spacing affect the same recorded gesture differently.",
      experiment: "Reduce stamp spacing while keeping the pressure samples unchanged.",
      source: "drawing/brush-dynamics.ts",
    },
    {
      id: "layer-effects",
      title: "Change the appearance of a layer",
      question: "What happens when you apply one effect at a time?",
      observe: "Compare the original colors and edges with each labeled effect.",
      takeaway: "Effects change rendered appearance while preserving source artwork.",
      experiment: "Apply blur before shadow, then reverse their order.",
      source: "drawing/layer-effects.ts",
    },
    {
      id: "blend-modes",
      title: "Mix overlapping colors",
      question: "How does the upper layer combine with the lower one?",
      observe:
        "Compare the central overlap and the exposed blue area against the paper background. The geometry stays fixed.",
      takeaway:
        "A blend mode combines source and destination colors, including the scene background. Its result depends on both.",
      experiment: "Swap the blue and amber layer order.",
      source: "drawing/blend-modes.ts",
    },
  ],
};
