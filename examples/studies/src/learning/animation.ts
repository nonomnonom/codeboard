import type { Chapter } from "./types.ts";

export const animation: Chapter = {
  id: "animation",
  title: "Make a change over time",
  introduction:
    "Read the pictures in order. For motion, play the clip and watch the same part of the drawing throughout.",
  lessons: [
    {
      id: "skin-weights",
      title: "Share a bend between two joints",
      question: "Which part of the strip follows each joint?",
      observe: "The left edge stays fixed, the right edge rises, and the middle moves halfway.",
      takeaway:
        "Explicit weights combine joint motion at each mesh vertex. No weights are generated automatically.",
      experiment: "Change the middle vertices from equal weights to 75 percent tip influence.",
      source: "animation/skin-weights.ts",
    },
    {
      id: "envelope",
      title: "Bend a surface from its boundary",
      question: "Can the border control the shape inside?",
      observe:
        "The woven grid follows the curved upper and lower edges. The side endpoints stay fixed.",
      takeaway: "An authored envelope generates a mesh that deforms the interior artwork.",
      experiment: "Change one boundary control point and inspect the grid.",
      source: "animation/envelope.ts",
    },
    {
      id: "drawing-timing",
      title: "Swap the drawing while it moves",
      question: "Does a drawing change have to interrupt movement?",
      observe:
        "Compare frames 11 and 12. The triangle becomes a diamond immediately, while its travel to the right continues.",
      takeaway:
        "Drawing holds choose the silhouette. Position keys move the whole drawing independently.",
      experiment:
        "Move the drawing switch from frame 12 to frame 18. Keep the movement keys unchanged.",
      source: "animation/drawing-timing.ts",
    },
    {
      id: "weighted-pose",
      title: "Move partway toward a pose",
      question: "What does half of a position change look like?",
      observe:
        "The marker starts at x = 60 and moves halfway toward x = 300, reaching x = 180. The final pose adds another 90.",
      takeaway:
        "A replacement weight blends toward a target. An additive pose applies an extra change to the current pose.",
      experiment: "Change the replacement weight from 0.5 to 1 and compare the middle position.",
      source: "animation/weighted-pose.ts",
    },
    {
      id: "ik-reach",
      title: "Can the hand reach the target?",
      question: "What happens when a target is too far away?",
      observe:
        "The cross marks the requested hand position. Compare the gap between the hand and cross in the last picture.",
      takeaway: "The arm can turn at its joints, but its two segment lengths limit its reach.",
      experiment: "Move the farthest target closer to the shoulder until the hand can reach it.",
      source: "animation/ik-reach.ts",
    },
    {
      id: "rig-rest",
      title: "Reach, then return to rest",
      question: "How do you get back to the original arm pose?",
      observe:
        "Compare the first and last arm positions. The middle picture shows the reach; the last restores the saved rest pose.",
      takeaway: "A stored rest pose provides a repeatable starting position for the rig.",
      experiment:
        "Change the reach target while keeping the captured rest pose. The return should stay the same.",
      source: "animation/rig-rest.ts",
    },
    {
      id: "mesh-warp",
      title: "Bend the artwork",
      question: "Can an image bend without redrawing its contents?",
      observe:
        "Follow the colored surface across the three poses. Its internal marks travel with the deformation.",
      takeaway:
        "A mesh moves the surface and the artwork together. The technical report also exercises copying and merging; the main comparison isolates the bend.",
      experiment:
        "Change a destination mesh vertex and render again. Watch which area of the artwork follows it.",
      source: "animation/mesh-warp.ts",
    },
    {
      id: "mesh-alpha",
      title: "Bend a transparent surface",
      question: "Will a mesh create a seam through transparent paint?",
      observe:
        "The first two squares should look the same. In the sheared square, look for an unwanted dark diagonal across the surface.",
      takeaway:
        "The shared triangle edge should not paint a transparent pixel twice. The background is included only to make transparency visible.",
      experiment:
        "Change the surface opacity and compare the center diagonal with the rest of the square.",
      source: "animation/mesh-alpha.ts",
    },
    {
      id: "deformer-resolution",
      title: "Bend the stripes and their boundary",
      question: "What happens to a mask when its artwork bends?",
      observe:
        "Follow the striped ribbon from straight to curved. The visible boundary bends with the stripes instead of cutting across them.",
      takeaway:
        "The deformation carries the artwork and mask together, even when the parent enlarges the drawing.",
      experiment:
        "Change the last curve control point and compare the outer edge with the stripes inside it.",
      source: "animation/deformer-resolution/render.ts",
    },
    {
      id: "controller-exchange",
      title: "Read a gesture across four shots",
      question: "Can you follow who offers and who receives the card?",
      observe:
        "Watch the yellow card and the two hands: notice, offer, receive, then hold. Use the stills to compare each pose.",
      takeaway:
        "The sequence combines arm bends, position controls and held mouth drawings. The card path and mouth cues are authored explicitly.",
      experiment:
        "Lengthen the hold after the receiver takes the card. Watch whether the exchange becomes easier to read.",
      source: "animation/controller-exchange/author.ts",
    },
    {
      id: "lip-sync",
      title: "Hold a mouth shape, then correct it",
      question: "How does a manual mouth correction affect the sequence?",
      observe:
        "Read the mouth shapes in frame order. At frame 10, the authored correction replaces the automatic cue.",
      takeaway:
        "Mouth drawings are held over ranges of frames. A manual correction can preserve an intentional closure.",
      experiment:
        "Extend the manual closure by two frames, then replay the sequence. This sample has no recorded dialogue to judge synchronization against.",
      source: "animation/lip-sync.ts",
    },
    {
      id: "camera-depth",
      title: "Near objects slide faster",
      question: "How can a camera pan create a sense of depth?",
      observe:
        "Track the dark foreground shapes, then the blue background shapes. The camera moves once, but the near shapes travel farther across the frame.",
      takeaway: "Depth changes apparent camera movement. The drawing coordinates remain fixed.",
      experiment: "Set every layer depth to 1. Compare that flat pan with the original.",
      source: "animation/camera-depth.ts",
    },
    {
      id: "editorial-cuts",
      title: "Change the order of two shots",
      question: "Can you reorder a sequence without redrawing either shot?",
      observe:
        "Read the first row left to right, then the second. The shot that was second now opens the sequence.",
      takeaway:
        "The edit chooses shot order and source ranges. Each shot's drawings remain its own source.",
      experiment:
        "Swap the clips back and change the trim on the first shot. Watch the cut in the exported sequence.",
      source: "animation/editorial-cuts.ts",
    },
  ],
};
