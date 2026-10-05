import type { Id, StoryboardDocument } from "../../model/types.js";

export type MutationScope = { panelId: Id } | { shotId: Id } | "audio" | "metadata" | "document";

const clone = <T>(value: T): T => structuredClone(value);

/** Tracks detached branches within one synchronous authoring transaction. */
export class DocumentCopyState {
  #writablePanels = new Set<Id>();
  #writableMetadata = false;
  #writableAudio = false;
  #writableShots = new Set<Id>();
  #writableDocument = false;

  reset(): void {
    this.#writablePanels.clear();
    this.#writableShots.clear();
    this.#writableMetadata = false;
    this.#writableAudio = false;
    this.#writableDocument = false;
  }

  prepare(document: StoryboardDocument, scope: MutationScope): void {
    if (this.#writableDocument) return;
    if (scope === "audio") {
      if (!this.#writableAudio) document.audioTracks = clone(document.audioTracks);
      this.#writableAudio = true;
    } else if (scope === "metadata") {
      if (!this.#writableMetadata) document.metadata = clone(document.metadata);
      this.#writableMetadata = true;
    } else if (scope === "document") {
      const { panels, metadata, ...rest } = document;
      Object.assign(document, clone(rest));
      document.panels = panels.map((panel) =>
        this.#writablePanels.has(panel.id) ? panel : clone(panel),
      );
      if (!this.#writableMetadata) document.metadata = clone(metadata);
      this.#writableDocument = true;
    } else if ("shotId" in scope) {
      if (!this.#writableShots.has(scope.shotId)) {
        const index = document.shots.findIndex((shot) => shot.id === scope.shotId);
        if (index < 0) throw new Error(`Shot not found: ${scope.shotId}`);
        if (!this.#writableShots.size) document.shots = document.shots.slice();
        document.shots[index] = clone(document.shots[index]!);
        this.#writableShots.add(scope.shotId);
      }
    } else if (!this.#writablePanels.has(scope.panelId)) {
      const index = document.panels.findIndex((p) => p.id === scope.panelId);
      if (index < 0) throw new Error(`Panel not found: ${scope.panelId}`);
      document.panels[index] = clone(document.panels[index]!);
      this.#writablePanels.add(scope.panelId);
    }
  }
}
