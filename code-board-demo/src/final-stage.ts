import type { Point } from './types.ts';
import type { PanelHandle } from 'codeboard-studio';
import { colors, ground, obstacle } from './art.ts';
import { acting } from './poses.ts';
function strokes(p: PanelHandle, name: string, paths: Point[][], { color = colors.paper, width = 2, parent }: {
    color?: string;
    width?: number;
    parent?: string;
} = {}) {
    const l = p.addVectorLayer(name, {}, parent);
    for (const pts of paths)
        l.path(pts.map(([x, y], i) => ({ op: i ? 'L' as const : 'M' as const, x, y })), { stroke: color, strokeWidth: width });
    return l;
}
export function finalStage(p: PanelHandle, start = 0) {
    ground(p);
    obstacle(p, 1271);
    const sun = [];
    for (let i = 0; i <= 44; i++) {
        const a = i / 44 * Math.PI * 2, r = 43 + 1.3 * Math.sin(a * 5);
        sun.push([1568 + Math.cos(a) * r, 310 + Math.sin(a) * r]);
    }
    const rays = Array.from({ length: 9 }, (_, i) => { const a = i / 9 * Math.PI * 2; return [[1568 + Math.cos(a) * 60, 310 + Math.sin(a) * 60], [1568 + Math.cos(a) * (76 + i % 3 * 3), 310 + Math.sin(a) * (76 + i % 3 * 3)]]; });
    strokes(p, 'Sun / hand-inked disc and rays', [sun, ...rays], { width: 2.4 });
    strokes(p, 'Grass / left bank', [[[185, 799], [177, 781], [190, 791], [200, 768], [198, 795], [218, 778], [205, 800]], [[225, 801], [239, 788], [233, 801]]], { width: 2 });
    strokes(p, 'Grass / right bank', [[[1652, 800], [1649, 776], [1660, 790], [1673, 763], [1666, 796], [1692, 777], [1677, 800]], [[1700, 800], [1718, 791], [1710, 801]]], { width: 2 });
    strokes(p, 'Ground ink / sparse broken strokes', [[[203, 813], [376, 811]], [[401, 813], [454, 812]], [[1170, 814], [1340, 813]], [[1551, 814], [1705, 810]], [[599, 821], [640, 821]]], { color: '#736e60', width: 1.3 });
    strokes(p, 'Pebbles / margin props', [[[291, 800], [295, 793], [307, 793], [312, 800]], [[1601, 800], [1607, 793], [1619, 795], [1624, 800]]], { color: '#aaa08b', width: 1.5 });
    for (const e of acting.exposures) {
        const f = e.frame, next = acting.exposures.find(v => v.frame > f)?.frame ?? 192;
        if (f < 128 || f > 166)
            continue;
        const g = p.addGroup(`Action ink f${f}`, { exposure: { startFrame: start + f, endFrame: start + next } });
        const x = -120 + e.x * 1.3, y = 800 + e.y * 1.3;
        if (f <= 134)
            strokes(p, 'Push / two trailing strokes', [[[x - 163, y - 79], [x - 185, y - 69]], [[x - 177, y - 102], [x - 212, y - 92]]], { parent: g.id, width: 2.4 });
        if (f >= 152 && f <= 160) {
            const u = (f - 152) / 8, d = 16 + u * 46;
            strokes(p, 'Contact / expanding ink ticks', [[[x - 127 - d, 792 - u * 16], [x - 143 - d, 788 - u * 20]], [[x + 137 + d, 792 - u * 14], [x + 153 + d, 787 - u * 18]], [[x + 119 + d, 784 - u * 20], [x + 121 + d, 775 - u * 25]]], { parent: g.id, width: 2.4 - u });
        }
    }
}
