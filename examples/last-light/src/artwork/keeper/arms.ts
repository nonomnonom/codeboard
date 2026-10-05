import type { LayerHandle, PanelHandle } from "codeboard-studio";
import { ink, paper } from "../palette.ts";
import { contour, stroke } from "../marks.ts";
import { lantern } from "../lantern.ts";
import type { KeeperPose } from "./types.ts";
export function arms(
  p: PanelHandle,
  torso: LayerHandle,
  l: LayerHandle,
  pose: KeeperPose,
  gait: number | undefined,
  lit: boolean,
) {
  if (pose === "bend") {
    contour(
      l,
      "M 169 185 C 201 190 212 224 230 243 L 285 222 L 300 245 C 268 270 244 279 225 279 C 196 267 178 245 160 218 Z",
      "#5d6867",
    );
    contour(
      l,
      "M 281 224 L 300 216 L 313 207 Q 321 207 318 217 L 308 230 L 334 226 Q 344 230 334 236 L 308 245 L 298 251 Z",
      paper,
    );
    stroke(
      l,
      [
        [183, 205],
        [206, 244],
        [229, 260],
        [278, 236],
      ],
      2,
      paper,
    );
  } else {
    contour(
      l,
      "M 165 184 C 193 183 202 218 204 251 L 239 300 L 221 317 L 174 269 L 153 218 Z",
      "#596462",
    );
    contour(
      l,
      "M 167 190 Q 188 193 193 225 L 196 253 L 223 293 L 213 285 L 183 251 Q 182 215 167 190 Z",
      "#88917e",
      "#88917e",
      0.5,
    );
    contour(l, "M 177 260 L 189 267 L 214 304 L 221 313 L 215 307 Z", ink, ink, 0.5);
    stroke(
      l,
      [
        [186, 250],
        [194, 255],
        [199, 253],
      ],
      1.2,
      ink,
    );
    stroke(
      l,
      [
        [189, 258],
        [201, 269],
        [206, 280],
      ],
      1.2,
      ink,
    );
    contour(
      l,
      "M 229 297 Q 240 302 246 314 L 252 326 Q 254 334 249 339 L 234 340 Q 226 334 226 323 L 218 317 L 215 306 Z",
      paper,
    );
    stroke(
      l,
      [
        [172, 201],
        [184, 250],
        [224, 300],
      ],
      2,
      paper,
    );
    if (pose === "walk" || pose === "step" || pose === "watch" || pose === "look-up") {
      if (gait === undefined) lantern(l, 243, 409, 0.88, lit);
      else {
        const swing = [0.02, -0.01, -0.035, -0.055, -0.06, -0.04, -0.015, 0.005][gait % 8]!,
          handleTop = 409 - 86 * 0.88;
        const suspended = p.addGroup(
          "Lantern / handle pivot",
          {
            transform: {
              x: 243 - 243 * Math.cos(swing) + handleTop * Math.sin(swing),
              y: handleTop - 243 * Math.sin(swing) - handleTop * Math.cos(swing),
              rotation: swing,
            },
          },
          torso.id,
        );
        lantern(p.addVectorLayer("Lantern / gait drawing", {}, suspended.id), 243, 409, 0.88, lit);
      }
      {
        const grip = p.addVectorLayer("Keeper / fingers around lantern handle", {}, torso.id);
        contour(
          grip,
          "M 228 323 Q 229 319 233 321 L 237 330 L 237 337 Q 235 341 232 337 Z",
          paper,
          ink,
          0.8,
        );
        contour(
          grip,
          "M 233 322 Q 236 320 239 324 L 242 333 L 241 340 Q 238 343 236 339 L 235 332 Z",
          paper,
          ink,
          0.85,
        );
        contour(
          grip,
          "M 239 323 Q 242 321 245 325 L 248 333 L 247 339 Q 244 342 242 338 L 242 332 Z",
          paper,
          ink,
          0.85,
        );
        contour(
          grip,
          "M 245 324 Q 248 323 250 328 L 252 333 Q 252 339 248 339 L 247 331 Z",
          paper,
          ink,
          0.8,
        );
        contour(
          grip,
          "M 230 316 Q 236 315 240 319 L 247 325 Q 248 329 244 330 Q 239 329 235 324 L 230 322 Z",
          paper,
          ink,
          0.85,
        );
        stroke(
          grip,
          [
            [233, 328],
            [234, 332],
            [234, 335],
          ],
          0.55,
          "#78816e",
        );
        stroke(
          grip,
          [
            [239, 332],
            [239, 336],
          ],
          0.55,
          "#78816e",
        );
        stroke(
          grip,
          [
            [245, 332],
            [245, 336],
          ],
          0.55,
          "#78816e",
        );
        stroke(
          grip,
          [
            [237, 319],
            [241, 322],
            [243, 324],
          ],
          0.55,
          "#78816e",
        );
      }
    }
  }
}
