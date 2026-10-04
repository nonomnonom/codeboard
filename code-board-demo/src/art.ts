import type { Pose, Point, DrawOptions } from './types.ts';
import type { PanelHandle, LayerHandle } from 'codeboard-studio';
import { brushes } from 'codeboard-studio';
import { hips } from './poses.ts';
export const colors = { bg: '#10110e', paper: '#f5edda', orange: '#f48136', far: '#bf5728', black: '#10110e', muted: '#a69f8e' };
export function poly(layer: LayerHandle, pts: Point[], fill?: string, stroke?: string, width = 1) { layer.path([...pts.map(([x, y], i) => ({ op: i ? 'L' as const : 'M' as const, x, y })), { op: 'Z' }], { ...(fill ? { fill } : {}), ...(stroke ? { stroke, strokeWidth: width } : {}) }); }
export function line(layer: LayerHandle, pts: Point[], color = colors.paper, width = 2) { layer.vectorStroke(pts.map(([x, y]) => ({ x, y, pressure: 1 })), { color, width, pressureSize: 0, taperStart: .12, taperEnd: .2 }); }
export function inkLine(panel: PanelHandle, parent: string | undefined, pts: Point[], color = colors.paper, width = 3, seed = 13) {
    const layer = panel.addRasterLayer('Dry ink', {}, parent);
    layer.rasterStroke(pts.map(([x, y], i) => ({ x, y, pressure: .78 + (i % 3) * .1 })), { ...brushes.roughPencil, size: width, opacity: 1, flow: .8, textureStrength: .28 }, { color, seed });
    return layer;
}
export function text(panel: PanelHandle, value: string, x: number, y: number, size = 32, color = colors.paper, parent?: string, font = 'Segoe Print', align: 'left' | 'center' | 'right' = 'left') {
    const l = panel.addVectorLayer(value, {}, parent);
    l.text(value, x, y, { color, font: `${size}px "${font}"`, align });
    return l;
}
export function ground(panel: PanelHandle, x1 = 170, x2 = 1740, y = 800, parent?: string) {
    inkLine(panel, parent, [[x1, y + 1], [x1 + (x2 - x1) * .32, y - 1], [x2, y]], colors.paper, 4);
}
export function obstacle(panel: PanelHandle, x = 1070, y = 800, parent?: string) { inkLine(panel, parent, [[x - 7, y - 1], [x + 5, y - 22]], colors.paper, 5, 26); }
export function legJoints(pose: Pose, i: number) {
    const hipX = hips[i] * pose.w / 206, hipY = pose.bottom - 10 + (i < 2 ? -8 : 0), foot = pose.feet[i];
    const bend = (foot.x - hipX) * .45 + (i % 2 ? 5 : -5), kneeX = hipX + bend, kneeY = (hipY + foot.y) / 2;
    return { hipX, hipY, kneeX, kneeY, foot };
}
export function drawClawd(panel: PanelHandle, pose: Pose, { parent, x = 0, y = 0, scale = 1, rough = false, detail = true, opacity = 1, name = 'Clawd drawing', exposure }: DrawOptions = {}) {
    const g = panel.addGroup(name, { transform: { x, y, scaleX: scale, scaleY: scale }, opacity, ...(exposure ? { exposure } : {}) }, parent);
    const l = panel.addVectorLayer(rough ? 'Construction contours' : 'Selected ink contours', {}, g.id);
    const { w, h, bottom, lean, feet } = pose, top = bottom - h;
    const bodyPoint = (u: number, v: number) => [u * w / 2 + lean * (-v), bottom + v * h];
    const contour = [[-1, -.06], [-1, -.79], [-.94, -.79], [-.94, -.96], [-.45, -.96], [-.45, -1], [.75, -1], [.75, -.975], [.97, -.975], [1, -.1], [.90, -.1], [.90, 0], [-.87, 0], [-.87, -.055]].map(([u, v]) => bodyPoint(u, v));
    // All four legs are separate contours. Far legs paint first and are naturally occluded.
    for (const i of [0, 1, 2, 3] as const) {
        const { hipX, hipY, kneeX, kneeY, foot } = legJoints(pose, i);
        const leg = [[hipX - 12, hipY], [hipX + 15, hipY], [kneeX + 13, kneeY], [foot.x + 16, foot.y - 8], [foot.x + 13, foot.y], [foot.x - 13, foot.y], [foot.x - 18, foot.y - 7], [kneeX - 12, kneeY - 1]];
        poly(l, leg, rough ? undefined : i < 2 ? colors.far : colors.orange, rough ? colors.paper : undefined, rough ? 1.8 : 0);
        if (rough)
            line(l, [[hipX, hipY], [kneeX, kneeY], [foot.x, foot.y]], colors.muted, 1);
    }
    poly(l, contour, rough ? undefined : colors.orange, rough ? colors.paper : undefined, rough ? 2 : 0);
    if (rough) {
        line(l, [[-w * .48, top + h * .48], [w * .48, top + h * .48]], colors.muted, 1);
        line(l, [[lean, top - 8], [0, bottom + 8]], colors.muted, 1);
        poly(l, contour.map(([x, y], i) => [x + (i % 2 ? 3 : -2), y + 3]), undefined, colors.muted, 1);
    }
    else {
        // Reproducible little chips follow the contour; no frame-random texture.
        for (let e = 0; e < contour.length; e++) {
            const a = contour[e], b = contour[(e + 1) % contour.length], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
            if (len < 18)
                continue;
            for (let k = 0; k < Math.floor(len / 23); k++) {
                const t = (k + .35) / (Math.floor(len / 23) + .2), px = a[0] + dx * t, py = a[1] + dy * t;
                const nx = -dy / len, ny = dx / len;
                poly(l, [[px - dx / len * 2.5, py - dy / len * 2.5], [px + dx / len * 3, py + dy / len * 3], [px + nx * 1.6, py + ny * 1.6]], colors.bg);
            }
        }
        line(l, [[contour[3][0] + 8, contour[3][1] + 4], [contour[5][0] - 5, contour[5][1] + 4]], colors.far, 1.4);
    }
    if (!rough && detail) {
        const ink = panel.addVectorLayer('Body ink / stable surface hatching', {}, g.id);
        const stroke = (pts: Point[], color: string, width: number) => ink.path(pts.map(([x, y], i) => ({ op: i ? 'L' as const : 'M' as const, x, y })), { stroke: color, strokeWidth: width });
        for (const [u, v, length] of [[-.85, -.79, .16], [-.81, -.48, .11], [-.65, -.9, .09], [-.60, -.37, .07], [-.38, -.84, .05], [-.2, -.18, .08], [.04, -.89, .07], [.65, -.16, .05]] as const) {
            stroke([bodyPoint(u, v), bodyPoint(u - .045, v + length)], '#bb5627', 1.25);
        }
        stroke([bodyPoint(-.85, -.93), bodyPoint(-.4, -.945), bodyPoint(.55, -.93)], '#ffc078', 1.7);
        stroke([bodyPoint(-.81, -.11), bodyPoint(-.57, -.09)], '#bd5829', 1.8);
        for (const i of [2, 3] as const) {
            const f = feet[i];
            stroke([[f.x - 9, f.y - 6], [f.x + 8, f.y - 5]], '#bd5829', 1.5);
        }
    }
    const eh = 26 * pose.eye, ey = top + h * .40 + (26 - eh) / 2;
    for (const ex of [w * .22, w * .39] as const) {
        const xx = ex + lean * .6 + pose.gaze;
        if (eh < 4)
            line(l, [[xx - 5, ey], [xx + 5, ey]], rough ? colors.paper : colors.black, 2.2);
        else
            poly(l, [[xx - 4, ey], [xx + 3, ey - 1], [xx + 5, ey + eh - 3], [xx + 2, ey + eh], [xx - 4, ey + eh - 1], [xx - 5, ey + 3]], rough ? colors.paper : colors.black);
    }
    return g;
}
