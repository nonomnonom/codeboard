import { DOMImplementation, XMLSerializer } from "@xmldom/xmldom";
import sharp from "sharp";
import {
  AmbientLight,
  Color,
  DirectionalLight,
  Light,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshNormalMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  PointLight,
  Scene,
  SkinnedMesh,
  InstancedMesh,
  Vector3,
} from "three";
import { SVGRenderer } from "three/addons/renderers/SVGRenderer.js";
import type { PixelBuffer } from "../../model/types/artwork.js";
import { isDrawingColor } from "../../drawing/color.js";

export interface ThreeFrameOptions {
  width: number;
  height: number;
  /** Overrides a solid scene background. Otherwise an empty scene background stays transparent. */
  background?: string;
}

function validate(
  scene: Scene,
  camera: PerspectiveCamera | OrthographicCamera,
  options: ThreeFrameOptions,
) {
  const { width, height, background } = options;
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 4096 ||
    height > 4096
  )
    throw new Error("Three frame dimensions must be integers from 1 to 4096");
  if (background !== undefined && !isDrawingColor(background))
    throw new Error("Invalid Three frame background color");
  if (!(scene instanceof Scene)) throw new Error("Expected a Three.js Scene");
  if (!(camera instanceof PerspectiveCamera || camera instanceof OrthographicCamera))
    throw new Error("Expected a perspective or orthographic camera");
  camera.updateProjectionMatrix();
  if (
    !camera.projectionMatrix.elements.every(Number.isFinite) ||
    camera.near < 0 ||
    camera.far <= camera.near
  )
    throw new Error("Invalid Three camera projection");
  if (scene.background !== null && !(scene.background instanceof Color))
    throw new Error("Three frame textures are not supported");
  if (scene.fog || scene.environment)
    throw new Error("Three frame fog and environment maps are not supported");
  scene.traverseVisible((object) => {
    if (
      ![
        ...object.position.toArray(),
        ...object.quaternion.toArray(),
        ...object.scale.toArray(),
      ].every(Number.isFinite)
    )
      throw new Error(`Non-finite Three object transform: ${object.name || object.type}`);
    if (object instanceof SkinnedMesh || object instanceof InstancedMesh)
      throw new Error(
        "Three frame skinning and instanced meshes are not supported; author ordinary mesh poses",
      );
    if (object.castShadow || object.receiveShadow)
      throw new Error("Three frame shadows are not supported");
    if (object instanceof Mesh || object instanceof Line) {
      if (Object.keys(object.geometry.morphAttributes).length)
        throw new Error("Three frame morph targets are not supported");
      const position = object.geometry.getAttribute("position");
      if (!position || position.count > 1_000_000)
        throw new Error("Three geometry requires at most 1,000,000 positions");
      for (let i = 0; i < position.count; i++)
        if (![position.getX(i), position.getY(i), position.getZ(i)].every(Number.isFinite))
          throw new Error("Non-finite Three geometry position");
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        const supported =
          object instanceof Mesh
            ? material instanceof MeshBasicMaterial ||
              material instanceof MeshLambertMaterial ||
              material instanceof MeshNormalMaterial
            : material instanceof LineBasicMaterial;
        if (!supported) throw new Error(`Unsupported Three frame material: ${material.type}`);
        if (
          Object.values(material).some(
            (value: unknown) =>
              value !== null &&
              typeof value === "object" &&
              "isTexture" in value &&
              value.isTexture === true,
          )
        )
          throw new Error("Three frame textures are not supported");
        if (material.clippingPlanes?.length)
          throw new Error("Three frame material clipping planes are not supported");
      }
    } else if (
      object instanceof Light &&
      !(
        object instanceof AmbientLight ||
        object instanceof DirectionalLight ||
        object instanceof PointLight
      )
    ) {
      throw new Error(`Unsupported Three frame light: ${object.type}`);
    } else if (
      !(object instanceof Light) &&
      object.type !== "Scene" &&
      object.type !== "Group" &&
      object.type !== "Object3D" &&
      !(object instanceof PerspectiveCamera || object instanceof OrthographicCamera)
    ) {
      throw new Error(`Unsupported Three frame object: ${object.type}`);
    }
  });
}

/** Headless Three.js SVG rendering. Uses painter ordering, not a per-pixel depth buffer. */
export function renderThreeSVG(
  scene: Scene,
  camera: PerspectiveCamera | OrthographicCamera,
  options: ThreeFrameOptions,
): string {
  validate(scene, camera, options);
  const namespace = "http://www.w3.org/2000/svg";
  const document = new DOMImplementation().createDocument(namespace, "svg");
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  if (previous && !previous.configurable)
    throw new Error("Headless Three rendering requires a configurable document global");
  const adapter = {
    createElementNS(ns: string, name: string) {
      const element =
        name === "svg" ? document.documentElement : document.createElementNS(ns, name);
      if (!element) throw new Error("Missing SVG document root");
      Object.defineProperty(element, "style", { value: {}, configurable: true });
      return element;
    },
  };
  // SVGRenderer requires a DOM global. Keep its entire use synchronous and restore even on failure.
  Object.defineProperty(globalThis, "document", { value: adapter, configurable: true });
  try {
    scene.updateMatrixWorld(true);
    camera.updateWorldMatrix(true, false);
    const snapshot = scene.clone(true);
    snapshot.updateMatrixWorld(true);
    const sourceLights: Light[] = [];
    const snapshotLights: Light[] = [];
    scene.traverse((object) => {
      if (object instanceof Light) sourceLights.push(object);
    });
    snapshot.traverse((object) => {
      if (object instanceof Light) snapshotLights.push(object);
    });
    for (const [index, light] of snapshotLights.entries()) {
      // SVGRenderer ignores ambient intensity and directional targets; normalize those inputs.
      if (light instanceof AmbientLight) light.color.multiplyScalar(light.intensity);
      const source = sourceLights[index];
      if (light instanceof DirectionalLight && source instanceof DirectionalLight) {
        source.target.updateWorldMatrix(true, false);
        const direction = source
          .getWorldPosition(new Vector3())
          .sub(source.target.getWorldPosition(new Vector3()));
        if (light.parent) light.parent.worldToLocal(direction);
        light.position.copy(direction);
      }
    }
    const renderer = new SVGRenderer();
    renderer.setSize(options.width, options.height);
    renderer.setPrecision(4);
    renderer.render(snapshot, camera);
    const background =
      options.background ??
      (scene.background instanceof Color ? scene.background.getStyle() : undefined);
    if (background) {
      const rect = document.createElementNS(namespace, "rect");
      rect.setAttribute("x", String(-options.width / 2));
      rect.setAttribute("y", String(-options.height / 2));
      rect.setAttribute("width", String(options.width));
      rect.setAttribute("height", String(options.height));
      rect.setAttribute("fill", background);
      document.documentElement?.insertBefore(rect, document.documentElement.firstChild);
    }
    return new XMLSerializer().serializeToString(document);
  } finally {
    if (previous) Object.defineProperty(globalThis, "document", previous);
    else Reflect.deleteProperty(globalThis, "document");
  }
}

/** Returns straight-alpha RGBA pixels suitable for LayerHandle.rasterSurface(). */
export async function renderThreeFrame(
  scene: Scene,
  camera: PerspectiveCamera | OrthographicCamera,
  options: ThreeFrameOptions,
): Promise<PixelBuffer> {
  const svg = renderThreeSVG(scene, camera, options);
  const { data, info } = await sharp(Buffer.from(svg))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, pixels: new Uint8Array(data) };
}
