import { Image, type CanvasRenderingContext2D } from "skia-canvas";
import {
  AmbientLight,
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  FrontSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshNormalMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
  type Material,
  type Object3D,
} from "three";
import type { Scene3DElement, Scene3DNode } from "../model/types/scene3d.js";
import { evaluateVector3D } from "../animation/scene3d.js";
import { renderThreeSVG } from "../interchange/three/render.js";

function geometry(kind: Extract<Scene3DNode, { kind: "mesh" }>["geometry"]): BufferGeometry {
  switch (kind) {
    case "box":
      return new BoxGeometry(1, 1, 1);
    case "sphere":
      return new SphereGeometry(0.5, 24, 16);
    case "cylinder":
      return new CylinderGeometry(0.5, 0.5, 1, 24);
    case "cone":
      return new ConeGeometry(0.5, 1, 24);
    case "plane":
      return new PlaneGeometry(1, 1);
    case "torus":
      return new TorusGeometry(0.5, 0.15, 12, 32);
  }
}

/** Projects the retained scene at the requested owner-frame, then composites its viewport. */
export function drawScene3D(
  ctx: CanvasRenderingContext2D,
  element: Scene3DElement,
  frame: number,
): void {
  const spec = element.scene;
  const scene = new Scene();
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  try {
    if (spec.background) scene.background = new Color(spec.background);
    const objects = new Map<string, Object3D>();
    for (const node of spec.nodes) {
      let object: Object3D;
      if (node.kind === "group") object = new Group();
      else {
        const shape = geometry(node.geometry);
        geometries.push(shape);
        const options = {
          color: node.material.color ?? "#ffffff",
          opacity: node.material.opacity ?? 1,
          transparent: (node.material.opacity ?? 1) < 1,
          side: node.material.doubleSided ? DoubleSide : FrontSide,
        };
        const material =
          node.material.kind === "basic"
            ? new MeshBasicMaterial(options)
            : node.material.kind === "lambert"
              ? new MeshLambertMaterial(options)
              : new MeshNormalMaterial({
                  opacity: options.opacity,
                  transparent: options.transparent,
                  side: options.side,
                });
        materials.push(material);
        object = new Mesh(shape, material);
      }
      object.name = node.id;
      object.visible = node.visible ?? true;
      const keys = node.keyframes ?? [];
      object.position.fromArray(
        evaluateVector3D(keys, frame, (key) => key.position, node.position ?? [0, 0, 0]),
      );
      object.scale.fromArray(
        evaluateVector3D(keys, frame, (key) => key.scale, node.scale ?? [1, 1, 1]),
      );
      const [x, y, z] = evaluateVector3D(
        keys,
        frame,
        (key) => key.rotation,
        node.rotation ?? [0, 0, 0],
      );
      object.rotation.set(x, y, z, "XYZ");
      objects.set(node.id, object);
    }
    for (const node of spec.nodes) {
      const parent = node.parentId === undefined ? scene : objects.get(node.parentId)!;
      parent.add(objects.get(node.id)!);
    }
    for (const light of spec.lights ?? []) {
      if (light.kind === "ambient") scene.add(new AmbientLight(light.color, light.intensity));
      else {
        const source = new DirectionalLight(light.color, light.intensity);
        source.position.fromArray(light.position);
        source.target.position.fromArray(light.target);
        scene.add(source, source.target);
      }
    }
    const cameraSpec = spec.camera;
    const aspect = spec.width / spec.height;
    const near = cameraSpec.near ?? 0.1;
    const far = cameraSpec.far ?? 1000;
    const camera =
      cameraSpec.kind === "perspective"
        ? new PerspectiveCamera(cameraSpec.fov, aspect, near, far)
        : new OrthographicCamera(
            (-cameraSpec.height * aspect) / 2,
            (cameraSpec.height * aspect) / 2,
            cameraSpec.height / 2,
            -cameraSpec.height / 2,
            near,
            far,
          );
    const keys = cameraSpec.keyframes ?? [];
    const position = evaluateVector3D(keys, frame, (key) => key.position, cameraSpec.position);
    const target = evaluateVector3D(keys, frame, (key) => key.target, cameraSpec.target);
    if (position.every((value, i) => value === target[i]))
      throw new Error(`3D camera position equals its target at frame ${frame} in ${element.id}`);
    camera.position.fromArray(position);
    camera.lookAt(...target);
    const image = new Image(Buffer.from(renderThreeSVG(scene, camera, spec)));
    ctx.globalAlpha = element.opacity;
    ctx.drawImage(image, 0, 0, spec.width, spec.height);
  } finally {
    for (const shape of geometries) shape.dispose();
    for (const material of materials) material.dispose();
  }
}
