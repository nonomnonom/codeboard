import type { Id, StoryboardDocument, Scene, Shot } from "./types.js";

export function findScene(document: StoryboardDocument, id: Id): Scene {
  const scene = document.scenes.find((entry) => entry.id === id);
  if (!scene) throw new Error(`Scene not found: ${id}`);
  return scene;
}

export function findShot(document: StoryboardDocument, id: Id): Shot {
  const shot = document.shots.find((entry) => entry.id === id);
  if (!shot) throw new Error(`Shot not found: ${id}`);
  return shot;
}
