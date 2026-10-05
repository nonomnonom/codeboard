import type { Exposure, Pose } from "./types.ts";
// Coordinates are drawing-space pixels. The ground is y=0; four soles are explicit.
export const hips = [-57, 77, -84, 43];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
export function walk(phase: number) {
  const feet = hips.map((hip, i) => {
    const p = (phase + (i === 0 || i === 3 ? 12 : 0)) % 24;
    const stance = p <= 14;
    const u = (p - 14) / 10;
    return {
      x: hip + (stance ? 49 - 7 * p : lerp(-49, 49, smooth(u))),
      y: stance ? 0 : -36 * Math.sin(Math.PI * u),
      planted: stance,
    };
  });
  return {
    w: 206,
    h: 132,
    bottom: -48 + 4 * Math.cos((phase * Math.PI) / 6),
    lean: 2 * Math.sin((phase * Math.PI) / 12),
    feet,
    eye: 1,
    gaze: 0,
  };
}
function standing(changes: Partial<Pose> = {}) {
  return {
    w: 206,
    h: 132,
    bottom: -48,
    lean: 0,
    feet: hips.map((x) => ({ x, y: 0, planted: true })),
    eye: 1,
    gaze: 0,
    ...changes,
  };
}
function blend(a: Pose, b: Pose, t: number) {
  const p: Pose = { ...a, feet: [] };
  for (const k of ["w", "h", "bottom", "lean", "eye", "gaze"] as const) p[k] = lerp(a[k], b[k], t);
  p.feet = a.feet.map((f, i) => {
    const next = b.feet[i];
    if (!next) throw new Error(`Missing target foot ${i}`);
    return { x: lerp(f.x, next.x, t), y: lerp(f.y, next.y, t), planted: f.planted && next.planted };
  });
  return p;
}
export function performance() {
  const drawings = new Map<string, Pose>(),
    exposures: Exposure[] = [],
    canonical = new Map<string, string>();
  function put(frame: number, id: string, pose: Pose, x: number, y = 0) {
    const geometry = {
      w: pose.w,
      h: pose.h,
      bottom: pose.bottom,
      lean: pose.lean,
      eye: pose.eye,
      gaze: pose.gaze,
      feet: pose.feet.map((f) => ({ x: f.x, y: f.y })),
    };
    const round = (_: string, v: unknown) =>
      typeof v === "number" ? Math.round(v * 1e4) / 1e4 : v;
    const signature = JSON.stringify(geometry, round);
    if (canonical.has(signature)) id = canonical.get(signature)!;
    else {
      canonical.set(signature, id);
      drawings.set(id, JSON.parse(JSON.stringify(pose, round)));
    }
    const previous = exposures.at(-1);
    if (previous?.id === id && previous.x === x && previous.y === y) return;
    exposures.push({ frame, id, x, y });
  }
  for (let f = 0; f < 72; f += 2)
    put(f, `W${String((f % 24) / 2 + 1).padStart(2, "0")}`, walk(f % 24), 300 + f * 7);
  const start = walk(0),
    stopFeet = start.feet.map((foot, i) => ({
      x: foot.x - 42 + (i === 0 || i === 3 ? 38 : 0),
      y: 0,
      planted: true,
    }));
  const rest = standing({ feet: stopFeet });
  for (let f = 72; f <= 88; f += 2) {
    const u = (f - 72) / 16,
      dx = 42 * (1 - (1 - u) ** 2),
      p = blend(start, rest, smooth(u));
    p.feet = start.feet.map((foot, i) => ({
      x: foot.x - dx + (i === 0 || i === 3 ? 38 * smooth(Math.min(1, u * 1.4)) : 0),
      y: i === 0 || i === 3 ? -20 * Math.sin(Math.PI * Math.min(1, u * 1.4)) : 0,
      planted: i === 1 || i === 2 || u >= 1 / 1.4,
    }));
    p.lean = 13 * Math.sin(Math.PI * u);
    p.bottom += 12 * Math.sin(Math.PI * u);
    p.w += 9 * Math.sin(Math.PI * u);
    p.h -= 7 * Math.sin(Math.PI * u);
    put(f, `S${f}`, p, 804 + dx);
  }
  const notice = { ...rest, lean: 10, gaze: 10, bottom: -41, eye: 0.85 };
  put(90, "N90", blend(rest, notice, 0.5), 846);
  put(92, "N92", notice, 846);
  put(108, "N108", blend(notice, rest, 0.5), 846);
  put(110, "REST", rest, 846);
  const crouch = { ...rest, w: 232, h: 108, bottom: -25, lean: 8, gaze: 5 };
  for (let f = 112; f <= 124; f += 2)
    put(f, `A${f}`, blend(rest, crouch, smooth((f - 110) / 14)), 846);
  put(126, "A124", crouch, 846);
  const push = { ...rest, w: 179, h: 158, bottom: -72, lean: 19, gaze: 4 };
  put(128, "T128", blend(crouch, push, 0.48), 846);
  put(130, "T130", push, 846);
  // Airborne contour and folded/extended feet are redrawn along a ballistic arc.
  for (let f = 132; f <= 150; f += 2) {
    const u = (f - 130) / 22,
      tuck = Math.sin(Math.PI * u),
      landing = Math.max(0, (u - 0.6) / 0.4);
    const p = standing({
      w: 192 + 22 * tuck,
      h: 148 - 25 * tuck,
      bottom: -48,
      lean: 14 * (1 - u) - 9 * landing,
      gaze: 5,
    });
    p.feet = rest.feet.map((foot, i) => ({
      x: foot.x + 12 * Math.sin(Math.PI * u) + (i < 2 ? -10 : 10) * tuck + 20 * landing,
      y: -30 * tuck + (i % 2 ? 6 : -3) * tuck,
      planted: false,
    }));
    put(f, `J${f}`, p, 846 + 390 * u, -185 * 4 * u * (1 - u));
  }
  const contact = {
    ...rest,
    w: 204,
    h: 138,
    bottom: -51,
    lean: -12,
    gaze: 5,
    feet: rest.feet.map((f) => ({ ...f, x: f.x + 20 })),
  };
  put(152, "L152", contact, 1236);
  const impact = { ...contact, w: 239, h: 105, bottom: -24, lean: 4 };
  put(154, "L154", blend(contact, impact, 0.78), 1236);
  put(156, "L156", impact, 1236);
  const rebound = { ...contact, w: 198, h: 142, bottom: -57, lean: -3 };
  for (let f = 158; f <= 164; f += 2)
    put(f, `R${f}`, blend(impact, rebound, smooth((f - 156) / 8)), 1236);
  const settled = { ...rest, feet: contact.feet };
  for (let f = 166; f <= 174; f += 2) {
    const p = blend(rebound, settled, smooth((f - 164) / 10));
    p.feet = p.feet.map((foot, i) => ({
      ...foot,
      y: i === 1 ? -5 * Math.sin((Math.PI * (f - 164)) / 10) : 0,
      planted: i !== 1 || f === 174,
    }));
    put(f, `R${f}`, p, 1236);
  }
  put(176, "CALM", settled, 1236);
  put(180, "BLINK-HALF", { ...settled, eye: 0.45 }, 1236);
  put(182, "BLINK", { ...settled, eye: 0.08 }, 1236);
  put(184, "BLINK-HALF", { ...settled, eye: 0.45 }, 1236);
  put(186, "CALM", settled, 1236);
  return { drawings, exposures };
}
export const acting = performance();
export function at(frame: number): Exposure {
  const exposure = [...acting.exposures].reverse().find((e) => e.frame <= frame);
  if (!exposure) throw new Error(`No exposure at frame ${frame}`);
  return exposure;
}
export function drawing(id: string): Pose {
  const pose = acting.drawings.get(id);
  if (!pose) throw new Error(`Unknown drawing ${id}`);
  return pose;
}
