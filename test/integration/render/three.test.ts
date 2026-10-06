import { describe, expect, it } from "vitest";
import {
  AmbientLight,
  DirectionalLight,
  MeshLambertMaterial,
  BoxGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  Scene,
  Texture,
} from "three";
import { renderThreeFrame, renderThreeSVG } from "../../../src/three.js";
import { StoryboardProject, createRenderSession } from "../../../src/index.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const options = { width: 96, height: 96 };
function setup() {
  const scene = new Scene();
  const mesh = new Mesh(new BoxGeometry(1.5, 1, 1), new MeshBasicMaterial({ color: "#ff0000" }));
  scene.add(mesh);
  const camera = new PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 5;
  return { scene, camera, mesh };
}
const colored = (pixels: Uint8Array) =>
  pixels.filter((value, i) => i % 4 === 3 && value > 127).length;
const center = (pixels: Uint8Array) =>
  Array.from(pixels.slice((48 * 96 + 48) * 4, (48 * 96 + 48) * 4 + 4));

describe("headless Three scene frames", () => {
  it("honors ambient intensity and directional targets without changing source light colors", async () => {
    const scene = new Scene();
    scene.add(new Mesh(new BoxGeometry(), new MeshLambertMaterial({ color: "#ffffff" })));
    const camera = new PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 5;
    const ambient = new AmbientLight("#ffffff", 0);
    scene.add(ambient);
    expect(center((await renderThreeFrame(scene, camera, options)).pixels)).toEqual([0, 0, 0, 255]);
    ambient.intensity = 0.5;
    const middle = center((await renderThreeFrame(scene, camera, options)).pixels)[0];
    expect(middle).toBeGreaterThan(150);
    expect(middle).toBeLessThan(220);
    expect(ambient.color.getHexString()).toBe("ffffff");
    ambient.intensity = 0;
    const key = new DirectionalLight("#ffffff", 1);
    key.position.set(0, 0, 5);
    scene.add(key);
    expect(center((await renderThreeFrame(scene, camera, options)).pixels)[0]).toBe(255);
    key.target.position.z = 10;
    expect(center((await renderThreeFrame(scene, camera, options)).pixels)[0]).toBe(0);
    expect(key.position.z).toBe(5);
  });
  it("projects a real mesh with transparent background and camera-dependent size", async () => {
    const { scene, camera } = setup();
    const near = await renderThreeFrame(scene, camera, options);
    expect(center(near.pixels)).toEqual([255, 0, 0, 255]);
    expect(Array.from(near.pixels.slice(0, 4))).toEqual([0, 0, 0, 0]);
    camera.position.z = 10;
    const far = await renderThreeFrame(scene, camera, options);
    expect(colored(far.pixels)).toBeLessThan(colored(near.pixels) * 0.4);
  });

  it("keeps orthographic scale constant and respects mesh depth ordering", async () => {
    const { scene, mesh } = setup();
    const camera = new OrthographicCamera(-2, 2, 2, -2, 0.1, 100);
    camera.position.z = 5;
    const back = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ color: "#0000ff" }));
    back.position.z = -1;
    scene.add(back);
    const first = await renderThreeFrame(scene, camera, options);
    expect(center(first.pixels)).toEqual([255, 0, 0, 255]);
    camera.position.z = 10;
    expect((await renderThreeFrame(scene, camera, options)).pixels).toEqual(first.pixels);
    mesh.position.z = -3;
    expect(center((await renderThreeFrame(scene, camera, options)).pixels)).toEqual([
      0, 0, 255, 255,
    ]);
  });

  it("isolates concurrent renders and restores a pre-existing document", async () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
    const sentinel = { sentinel: true };
    Object.defineProperty(globalThis, "document", { value: sentinel, configurable: true });
    try {
      const a = setup();
      const b = setup();
      a.scene.background = new Color("#00ff00");
      b.scene.background = new Color("#0000ff");
      const [green, blue] = await Promise.all([
        renderThreeFrame(a.scene, a.camera, options),
        renderThreeFrame(b.scene, b.camera, options),
      ]);
      expect(Array.from(green.pixels.slice(0, 4))).toEqual([0, 255, 0, 255]);
      expect(Array.from(blue.pixels.slice(0, 4))).toEqual([0, 0, 255, 255]);
      expect(Object.getOwnPropertyDescriptor(globalThis, "document")?.value).toBe(sentinel);
    } finally {
      if (previous) Object.defineProperty(globalThis, "document", previous);
      else Reflect.deleteProperty(globalThis, "document");
    }
  });

  it("rejects unsupported appearance and invalid output dimensions", () => {
    const { scene, camera, mesh } = setup();
    expect(() => renderThreeSVG(scene, camera, { width: -1, height: 96 })).toThrow("dimensions");
    mesh.material.map = new Texture();
    expect(() => renderThreeSVG(scene, camera, options)).toThrow("textures");
    mesh.material.map = null;
    scene.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
    expect(() => renderThreeSVG(scene, camera, options)).toThrow("material");
  });

  it("persists the rendered frame through a real Codeboard save and reopen", async () => {
    const directory = await mkdtemp(join(tmpdir(), "codeboard-three-"));
    try {
      const { scene, camera, mesh } = setup();
      mesh.rotation.set(0.3, 0.6, 0.2);
      const pixels = await renderThreeFrame(scene, camera, { ...options, background: "#ffffff" });
      const project = StoryboardProject.create({
        title: "Three composition",
        width: 96,
        height: 96,
        background: "#ffffff",
      });
      project
        .addScene("Scene")
        .addShot("Shot")
        .addPanel()
        .addRasterLayer("Three frame")
        .rasterSurface(pixels);
      const file = join(directory, "scene.cboard");
      await project.save(file);
      const reopened = await StoryboardProject.open(file);
      const canvas = createRenderSession(reopened).frame(0);
      expect(new Uint8Array(canvas.getContext("2d").getImageData(0, 0, 96, 96).data)).toEqual(
        pixels.pixels,
      );
      canvas.getContext("2d").reset();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
