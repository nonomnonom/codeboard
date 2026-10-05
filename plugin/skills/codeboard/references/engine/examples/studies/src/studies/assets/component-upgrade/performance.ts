import type { StoryboardProject } from "codeboard-studio";

export function capturePerformance(
  project: StoryboardProject,
  panelId: string,
  instanceId: string,
  layerId: string,
) {
  const captured = project.capturePanelAnimation(panelId, { id: "animation:component-upgrade" });
  const mapped = (id: string) =>
    captured.identities.find((entry) => entry.sourceId === id)!.capturedId;
  const target = mapped(layerId);
  project.editShotAnimation(captured.animationId, [
    ...[0, 12, 23].map((frame, index) => ({
      op: "layer.key.put" as const,
      layerId: target,
      key: {
        id: `key:kite-${frame}`,
        frame,
        transform: { y: index === 1 ? -10 : 0 },
        easing: "ease-in-out" as const,
      },
    })),
    {
      op: "controller.put",
      controller: {
        id: "controller:kite-sway",
        name: "Kite sway",
        mode: "additive",
        weight: 0,
        targets: [{ layerId: target, values: { rotation: 0.12 } }],
        keyframes: [
          { frame: 0, weight: 0, easing: "ease-in-out" },
          { frame: 12, weight: 1, easing: "ease-in-out" },
          { frame: 23, weight: 0, easing: "linear" },
        ],
      },
    },
  ]);
  return {
    animationId: captured.animationId,
    instanceId: mapped(instanceId),
    before: project.shotAnimation(captured.animationId),
  };
}
