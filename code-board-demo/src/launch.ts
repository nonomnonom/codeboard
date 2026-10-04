import { renderFrameSheet } from 'codeboard-studio';
const ffmpegPath = process.env.FFMPEG_PATH ?? 'ffmpeg';
import type { PanelHandle } from 'codeboard-studio';
import { paths } from './paths.ts';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StoryboardProject, createRenderSession, exportMovie } from 'codeboard-studio';
import { acting, at, drawing } from './poses.ts';
import { sequence, attachSound } from './author.ts';
import { colors, text, line, inkLine, ground, obstacle, drawClawd, poly } from './art.ts';
import { welcomeTerminal } from './claude-terminal.ts';
import { celStack, fileProp, registration, penNib } from './studio-props.ts';
import { turnaround, rigging, inkAction } from './studio-scenes.ts';
import { finalStage } from './final-stage.ts';
export const launchOut = paths.launch;
export const stages: [
    string,
    number
][] = [
    ['THE QUESTION', 3], ['THE PROMPT', 4], ['TURNAROUND', 4], ['RIGGING', 4], ['STORYBOARD', 3], ['THE REVISION', 6],
    ['TIMELINE', 4], ['BEZIER & IN-BETWEEN', 3], ['ROUGH TO DETAIL', 4], ['DELIVERY', 2],
    ['THE ANIMATION', 8], ['CODEBOARD', 3],
];
export const durationSeconds = stages.reduce((n, [, s]) => n + s, 0);
export const finalStartFrame = stages.slice(0, stages.findIndex(([name]) => name === 'THE ANIMATION')).reduce((n, [, s]) => n + s * 24, 0);
const prompt = 'Animate Clawd walking, stopping,\nand hopping over a line.';
const typingFrames: number[] = [];
const mono = (p: PanelHandle, s: string, x: number, y: number, size = 28, color = colors.paper, parent?: string, align: 'left' | 'center' | 'right' = 'left') => text(p, s, x, y, size, color, parent, 'Consolas', align);
function box(p: PanelHandle, x: number, y: number, w: number, h: number, parent?: string, fill?: string) { const l = p.addVectorLayer('Window contour', {}, parent); poly(l, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], fill, colors.muted, 1.4); return l; }
function group(p: PanelHandle, name: string, start: number, end: number) { return p.addGroup(name, { exposure: { startFrame: start, endFrame: end } }); }
function enter(b: StoryboardProject, p: PanelHandle, name: string, start: number, end: number, { dy = 18 } = {}) {
    const g = group(p, name, start, end);
    b.production.addLayerKeyframe(g.id, start, { opacity: 0, transform: { y: dy }, easing: 'ease-in-out' });
    b.production.addLayerKeyframe(g.id, start + 8, { opacity: 1, transform: { y: 0 }, easing: 'hold' });
    return g;
}
function popup(b: StoryboardProject, p: PanelHandle, title: string, detail: string, start: number, end: number, x = 1230, y = 190, w = 570) {
    const g = enter(b, p, title, start, end);
    box(p, x, y, w, 114, g.id, colors.bg);
    const l = p.addVectorLayer('Tool accent', {}, g.id);
    line(l, [[x, y + 2], [x, y + 112]], colors.orange, 5);
    mono(p, title, x + 24, y + 42, 28, colors.orange, g.id);
    mono(p, detail, x + 24, y + 82, 23, colors.paper, g.id);
    return g;
}
function header(p: PanelHandle, index: number, title: string) {
    text(p, 'Codeboard', 92, 100, 42);
    mono(p, 'Claude Code / agent workflow demo', 1828, 90, 23, colors.muted, undefined, 'right');
    text(p, title, 92, 188, 45);
    mono(p, String(index).padStart(2, '0'), 1828, 180, 28, colors.orange, undefined, 'right');
}
function workspace(p: PanelHandle, file: string) {
    box(p, 92, 266, 708, 630);
    box(p, 840, 266, 988, 630);
    mono(p, file, 116, 314, 25, colors.orange);
    mono(p, 'Codeboard / canvas', 868, 314, 25);
    const l = p.addVectorLayer('Window dividers');
    line(l, [[92, 338], [800, 338]], colors.muted, 1);
    line(l, [[840, 338], [1828, 338]], colors.muted, 1);
}
function type(_b: StoryboardProject, p: PanelHandle, value: string, x: number, y: number, start: number, end: number, size = 38) {
    let row = 0, col = 0, index = 0;
    for (const char of value) {
        if (char === '\n') {
            row++;
            col = 0;
            continue;
        }
        const frame = start + Math.floor(index * .9), g = group(p, `Typed character ${index}`, frame, end);
        mono(p, char, x + col * size * .6, y + row * size * 1.55, size, colors.paper, g.id);
        if (char !== ' ')
            typingFrames.push(frame);
        const next = start + Math.floor((index + 1) * .9), cursor = group(p, 'Typing caret', frame, Math.max(frame + 1, next));
        const l = p.addVectorLayer('Caret', {}, cursor.id);
        poly(l, [[x + (col + 1) * size * .6, y + row * size * 1.55 - size * .8], [x + (col + 1) * size * .6 + 3, y + row * size * 1.55 - size * .8], [x + (col + 1) * size * .6 + 3, y + row * size * 1.55 + 6], [x + (col + 1) * size * .6, y + row * size * 1.55 + 6]], colors.orange);
        col++;
        index++;
    }
}
function code(p: PanelHandle, lines: string[], start: number, end: number, { x = 118, y = 393, size = 29, step = 7 }: {
    x?: number;
    y?: number;
    size?: number;
    step?: number;
    parent?: string;
} = {}) {
    lines.forEach((s, i) => { const g = group(p, `Source line ${i + 1}`, start + i * step, end); mono(p, s, x, y + i * 43, size, /^(const |export |for\(|return |\}|\];)/.test(s.trim()) ? colors.orange : colors.paper, g.id); });
}
function still(p: PanelHandle, f: number, x: number, y: number, s = 1, parent?: string, opacity = 1, rough = false) { const e = at(f); return drawClawd(p, drawing(e.id), { x, y: y + e.y * s, scale: s, parent, opacity, rough, name: `${e.id} / action f${f}` }); }
function focusCel(b: StoryboardProject, p: PanelHandle, sourceFrames: number[], start: number, hold: number, { x = 1350, y = 784, scale = 1.65, rough = false } = {}) {
    const track = p.addGroup('Drawing close-up');
    const ids = new Map<string, string>();
    for (const f of sourceFrames) {
        const e = at(f);
        if (!ids.has(e.id))
            ids.set(e.id, still(p, f, x, y, scale, track.id, 1, rough).id);
    }
    b.production.setDrawingSequence(track.id, sourceFrames.map((f, i) => ({ frame: start + i * hold, drawingId: ids.get(at(f).id)! })));
    return track;
}
function sourceExcerpt(source: string, begin: string, end: string) { const a = source.indexOf(begin), b = source.indexOf(end, a); if (a < 0 || b < a)
    throw new Error(`Source excerpt missing: ${begin}`); return source.slice(a, b).trim(); }
function wrapCode(s: string, width = 39) {
    const out = [];
    for (const line of s.split('\n')) {
        let rest = line.trim();
        while (rest.length > width) {
            let n = rest.lastIndexOf(',', width);
            if (n < 8)
                n = rest.lastIndexOf(' ', width);
            if (n < 8)
                n = width;
            else
                n++;
            out.push(rest.slice(0, n));
            rest = '  ' + rest.slice(n).trimStart();
        }
        out.push(rest);
    }
    return out;
}
export async function authorLaunch() {
    const poseSource = await readFile(new URL('./poses.ts', import.meta.url), 'utf8');
    const verification = JSON.parse(await readFile(join(paths.performance, 'verification.json'), 'utf8'));
    const b = StoryboardProject.create({ title: 'Codeboard / From prompt to performance', width: 1920, height: 1080, frameRate: 24, background: colors.bg, seed: 72 });
    let start = 0;
    b.transaction('Stage an agent workflow using real source and real drawings', () => {
        for (let ordinal = 0; ordinal < stages.length; ordinal++) {
            const index = ordinal >= 4 ? ordinal - 2 : ordinal;
            const [name, seconds] = stages[ordinal], duration = seconds * 24, end = start + duration;
            const p = b.addScene(name).addShot(name).addPanel({ id: `launch:${ordinal + 1}`, title: name, durationFrames: duration });
            if (name === 'TURNAROUND') {
                turnaround(b, p, start, end);
                start = end;
                continue;
            }
            if (name === 'RIGGING') {
                rigging(b, p, start, end);
                start = end;
                continue;
            }
            if (index === 0) {
                text(p, 'Codeboard', 100, 105, 44);
                text(p, 'A small line.', 100, 415, 76);
                text(p, 'A big decision.', 100, 510, 76);
                const g = p.addGroup('Notice / before the leap'), keys = [];
                for (const [i, f] of [88, 90, 92, 108, 110, 118, 124].entries()) {
                    const cel = still(p, f, 1320, 825, 1.8, g.id);
                    keys.push({ frame: start + [0, 6, 12, 36, 42, 50, 60][i], drawingId: cel.id });
                }
                b.production.setDrawingSequence(g.id, keys);
                ground(p, 982, 1770, 825);
                obstacle(p, 1630, 825);
                inkAction(b, p, [[994, 825], [1400, 825], [1623, 825], [1635, 803]], start, start + 24, { width: 3 });
                const q = group(p, 'Opening question', start + 28, end);
                mono(p, 'How do you make a drawing feel alive?', 106, 623, 29, colors.muted, q.id);
            }
            if (index === 1) {
                text(p, 'Direct the idea.', 132, 235, 86);
                text(p, 'Codeboard + Claude Code', 140, 326, 34);
                celStack(b, p, { x: 1390, y: 146, start, end });
                inkAction(b, p, [[998, 286], [1100, 286], [1220, 220], [1358, 220]], start + 30, start + 64, { pen: false });
                welcomeTerminal(p);
                type(b, p, prompt, 218, 737, start + 3, end, 32);
                popup(b, p, 'The direction', 'One obstacle. A moment of hesitation.', start + 70, end, 960, 886, 828);
            }
            if (index === 2) {
                header(p, ordinal + 1, 'Give Clawd a reason to stop.');
                for (const [i, f, title] of [[0, 8, 'WALK'], [1, 94, 'NOTICE'], [2, 124, 'DECIDE TO HOP']] as const) {
                    const x = 104 + i * 606, g = enter(b, p, `Storyboard ${title}`, start + 8 + i * 12, end);
                    box(p, x, 334, 498, 465, g.id);
                    ground(p, x + 30, x + 468, 716, g.id);
                    const track = p.addGroup('Storyboard action', {}, g.id), sk = [];
                    const moments = [[4, 8, 12], [88, 90, 92], [110, 118, 124]][i];
                    for (const [j, m] of moments.entries()) {
                        const cel = p.addGroup(`Storyboard f${m}`, {}, track.id);
                        still(p, m, x + 246, 716, .93, cel.id);
                        mono(p, `action f${m} / ${at(m).id}`, x + 249, 920, 24, colors.muted, cel.id, 'center');
                        sk.push({ frame: start + 8 + i * 12 + j * 6, drawingId: cel.id });
                    }
                    b.production.setDrawingSequence(track.id, sk);
                    if (i > 0)
                        obstacle(p, x + (i === 1 ? 410 : 265), 716, g.id);
                    text(p, title, x + 249, 863, 30, colors.paper, g.id, 'Segoe Print', 'center');
                }
            }
            if (index === 3) {
                header(p, ordinal + 1, 'Movement needs weight.');
                workspace(p, 'Claude Code / directed revision');
                const first = group(p, 'Timing study / intentionally abrupt', start, start + 48);
                mono(p, 'TIMING STUDY', 894, 389, 25, colors.muted, first.id);
                const track = p.addGroup('Sparse study exposures', {}, first.id), keys = [];
                for (const [i, f] of [110, 130, 140, 152, 174].entries()) {
                    const cel = still(p, f, 1330, 800, 1.55, track.id);
                    keys.push({ frame: start + [0, 6, 12, 18, 24][i], drawingId: cel.id });
                }
                b.production.setDrawingSequence(track.id, keys);
                ground(p, 916, 1750, 800);
                const read = group(p, 'Read source', start + 4, end);
                mono(p, 'Read / poses.ts', 118, 359, 23, colors.muted, read.id);
                const observation = group(p, 'Visible diagnosis', start + 26, end);
                mono(p, 'The landing feels abrupt.', 118, 411, 29, colors.paper, observation.id);
                mono(p, 'Let the body take the weight.', 118, 464, 29, colors.paper, observation.id);
                const impact = sourceExcerpt(poseSource, 'const impact=', 'put(154');
                code(p, wrapCode(impact), start + 58, end, { y: 568, size: 26, step: 6 });
                code(p, wrapCode(sourceExcerpt(poseSource, 'put(154', 'const rebound'), 42), start + 88, end, { y: 722, size: 24, step: 8 });
                const revision = group(p, 'Corrected contact drawings', start + 48, end);
                mono(p, 'REDRAW THE CONTACT', 894, 389, 25, colors.orange, revision.id);
                const correction = p.addGroup('Contact revision cels', {}, revision.id), ck = [];
                for (const [i, f] of [152, 154, 156, 158, 162, 166, 174].entries()) {
                    const cel = still(p, f, 1330, 800, 1.75, correction.id);
                    ck.push({ frame: start + 48 + i * 12, drawingId: cel.id });
                }
                b.production.setDrawingSequence(correction.id, ck);
                inkAction(b, p, [[120, 635], [450, 635], [570, 611]], start + 62, start + 86, { pen: true });
                popup(b, p, 'A decision, made visible.', 'Contact → compression → recovery', start + 106, end, 943, 850, 825);
            }
            if (index === 4) {
                header(p, ordinal + 1, 'Hold the thought. Then push.');
                mono(p, 'PREVIEW / 0.25x', 110, 305, 26, colors.muted);
                mono(p, 'TIMELINE / LOCAL FRAMES', 813, 305, 26, colors.orange);
                ground(p, 118, 701, 850);
                focusCel(b, p, Array.from({ length: 12 }, (_, i) => 122 + i * 2), start, 8, { x: 413, y: 850, scale: 1.45 });
                mono(p, 'API / setDrawingSequence', 116, 919, 25, colors.paper);
                mono(p, 'Hold A124. Build the push.', 116, 967, 24, colors.muted);
                inkAction(b, p, [[893, 524], [893, 534], [1056, 534], [1056, 524]], start + 8, start + 28, { pen: false, width: 3 });
                const tx = 812, tw = 982, px = (f: number) => tx + (f - 122) / 24 * tw;
                const ruler = p.addVectorLayer('Actual source-frame ruler');
                line(ruler, [[tx, 381], [tx + tw, 381]], colors.muted, 1);
                for (let f = 122; f <= 146; f += 2) {
                    line(ruler, [[px(f), 371], [px(f), 389]], colors.muted, 1);
                    if (f % 4 === 2)
                        mono(p, String(f), px(f), 356, 24, colors.paper, undefined, 'center');
                }
                mono(p, 'CEL', tx, 427, 24, colors.muted);
                mono(p, 'ROOT Y', tx, 582, 24, colors.muted);
                mono(p, 'SOUND', tx, 714, 24, colors.muted);
                const entries = acting.exposures.filter(e => e.frame >= 122 && e.frame < 146);
                for (const [i, e] of entries.entries()) {
                    const next = Math.min(146, entries[i + 1]?.frame ?? 146), x = px(e.frame), w = px(next) - x;
                    box(p, x, 447, w - 2, 65, undefined, '#211e17');
                    mono(p, e.id, x + w / 2, 487, 20, colors.paper, undefined, 'center');
                }
                const curve = p.addVectorLayer('Root height samples');
                line(curve, Array.from({ length: 13 }, (_, i) => { const f = 122 + i * 2; return [px(f), 665 + at(f).y * .32]; }), colors.paper, 2.5);
                const sfx = p.addVectorLayer('Push sound event');
                line(sfx, [[px(128), 739], [px(128), 777]], colors.orange, 4);
                mono(p, 'push', px(128) + 15, 766, 23, colors.paper);
                const playhead = p.addGroup('Timeline playhead'), playInk = p.addVectorLayer('Playhead', {}, playhead.id);
                line(playInk, [[tx, 373], [tx, 794]], colors.orange, 2.6);
                poly(playInk, [[tx - 7, 367], [tx + 7, 367], [tx, 380]], colors.orange);
                b.production.addLayerKeyframe(playhead.id, start, { transform: { x: 0 }, easing: 'linear' });
                b.production.addLayerKeyframe(playhead.id, end - 1, { transform: { x: tw }, easing: 'hold' });
                for (let i = 0; i < 6; i++) {
                    const f = 124 + i * 4, x = 893 + i * 163;
                    ground(p, x - 68, x + 68, 957);
                    still(p, f, x, 957, .43);
                    mono(p, `f${f}`, x, 1003, 21, colors.muted, undefined, 'center');
                }
            }
            if (index === 5) {
                header(p, ordinal + 1, 'Draw through the change.');
                workspace(p, 'Edit / Bezier trajectory');
                mono(p, 'x(u) = 846 + 390u', 120, 398, 29, colors.paper);
                mono(p, 'y(u) = -185 x 4u(1-u)', 120, 445, 29, colors.orange);
                mono(p, 'Same parabola, cubic Bezier form.', 120, 502, 25, colors.muted);
                const x0 = 151, x3 = 742, y0 = 806, height = 178, x1 = x0 + (x3 - x0) / 3, x2 = x0 + 2 * (x3 - x0) / 3, cy = y0 - height * 4 / 3;
                const curve = p.addVectorLayer('Exact cubic representation of hop');
                line(curve, [[x0, y0], [x1, cy]], colors.muted, 1.6);
                line(curve, [[x3, y0], [x2, cy]], colors.muted, 1.6);
                line(curve, [[x0, y0], [x3, y0]], colors.muted, 1);
                curve.path([{ op: 'M', x: x0, y: y0 }, { op: 'C', x1, y1: cy, x2, y2: cy, x: x3, y: y0 }], { stroke: colors.orange, strokeWidth: 3.5 });
                for (const [i, x, y] of [[0, x0, y0], [1, x1, cy], [2, x2, cy], [3, x3, y0]] as const) {
                    poly(curve, [[x - 5, y - 5], [x + 5, y - 5], [x + 5, y + 5], [x - 5, y + 5]], colors.paper);
                    mono(p, `P${i}`, x, y + (i === 1 || i === 2 ? -20 : 35), 21, colors.paper, undefined, 'center');
                }
                ground(p, 920, 1755, 788);
                obstacle(p, 1402, 788);
                const track = p.addGroup('Onion-skin trajectory review'), keys = [];
                for (let i = 0; i < 9; i++) {
                    const f = 130 + i * 2, g = p.addGroup(`Review f${f}`, {}, track.id);
                    for (const [neighbor, opacity] of [[f - 2, .16], [Math.min(154, f + 2), .16], [f, 1]] as const) {
                        const e = at(neighbor);
                        still(p, neighbor, 1200 + (e.x - 846) * .9, 788, .9, g.id, opacity);
                    }
                    keys.push({ frame: start + i * 8, drawingId: g.id });
                    const marker = group(p, `Curve position f${f}`, start + i * 8, start + (i + 1) * 8), u = (f - 130) / 22, x = x0 + (x3 - x0) * u, y = y0 - 4 * height * u * (1 - u);
                    const dot = p.addVectorLayer('Selected curve point', {}, marker.id);
                    poly(dot, [[x - 6, y - 6], [x + 6, y - 6], [x + 6, y + 6], [x - 6, y + 6]], colors.orange);
                    mono(p, `f${f} / ${at(f).id}`, 1335, 851, 27, colors.paper, marker.id, 'center');
                }
                b.production.setDrawingSequence(track.id, keys);
                mono(p, 'Onion skin / previous + active + next', 1335, 964, 25, colors.muted, undefined, 'center');
            }
            if (index === 6) {
                header(p, ordinal + 1, 'Choose every line.');
                const labels = ['ROUGH', 'CLEAN', 'DETAIL'];
                for (let i = 0; i < 3; i++) {
                    const section = group(p, labels[i], start + i * 32, start + (i + 1) * 32);
                    for (let j = 0; j < 3; j++) {
                        mono(p, String(j + 1).padStart(2, '0'), 120, 407 + j * 96, 25, j === i ? colors.orange : colors.muted, section.id);
                        text(p, labels[j], 187, 410 + j * 96, 41, j === i ? colors.paper : colors.muted, section.id);
                    }
                    mono(p, ['Find the weight.', 'Select the silhouette.', 'Leave the ink alive.'][i], 120, 792, 28, colors.paper, section.id);
                    const track = p.addGroup('Same contact / selected finish', {}, section.id), keys = [];
                    for (let j = 0; j < 12; j++) {
                        const f = 152 + j * 2, e = at(f), cel = drawClawd(p, drawing(e.id), { x: 1260, y: 819, scale: 2.5, parent: track.id, rough: i === 0, detail: i === 2, name: e.id });
                        if (i === 2 && j < 8) {
                            const pose = drawing(e.id), u = [-.85, -.81, -.65, -.60, -.38, -.2, .04, .65][j], v = [-.79, -.48, -.9, -.37, -.84, -.18, -.89, -.16][j];
                            const nib = penNib(p, cel.id);
                            b.production.addLayerKeyframe(nib.id, start + i * 32 + j * 2, { transform: { x: 1260 + 2.5 * (u * pose.w / 2 - pose.lean * v), y: 819 + 2.5 * (pose.bottom + v * pose.h) }, easing: 'hold' });
                        }
                        keys.push({ frame: start + i * 32 + j * 2, drawingId: cel.id });
                    }
                    b.production.setDrawingSequence(track.id, keys);
                }
                ground(p, 859, 1680, 819);
                registration(p, 895, 1630, 330);
                mono(p, 'SAME CONTACT / SAME EXPOSURE', 1250, 948, 25, colors.muted, undefined, 'center');
            }
            if (index === 7) {
                text(p, 'Yours to keep.', 130, 274, 79);
                mono(p, 'EDITABLE DRAWINGS. FINISHED FILM.', 135, 353, 28, colors.orange);
                const files = enter(b, p, 'Delivery files settle', start + 3, end, { dy: 56 });
                fileProp(p, { x: 1140, y: 400, name: '.cboard', scale: 1.8, parent: files.id });
                fileProp(p, { x: 1460, y: 400, name: '.mp4', scale: 1.8, parent: files.id });
                inkAction(b, p, [[1150, 730], [1540, 730], [1635, 684]], start + 12, start + 32, { pen: false });
                mono(p, '$ codeboard movie clawd-final.cboard', 135, 591, 31, colors.paper);
                mono(p, '  --output clawd-final.mp4', 135, 648, 31, colors.paper);
                mono(p, '1920 x 1080 / 24 fps', 135, 837, 28, colors.muted);
            }
            if (index === 8) {
                finalStage(p, start);
                sequence(b, p, start, 0, 192, { x: -120, y: 800, scaleX: 1.3, scaleY: 1.3 });
            }
            if (index === 9) {
                text(p, 'Codeboard', 295, 514, 140);
                text(p, 'Animate your idea with code.', 311, 648, 45);
                inkLine(p, undefined, [[310, 565], [790, 552], [1184, 560]], colors.orange, 9);
                const endAction = sequence(b, p, start, 120, 72, { x: 400, y: 560, scaleX: 1, scaleY: 1 });
                for (const [a, z, dip] of [[0, 32, 0], [32, 34, 4], [34, 36, 13], [36, 38, 18], [38, 40, 10], [40, 42, 3], [42, 44, -5], [44, 48, -2], [48, 72, 0]] as const) {
                    b.production.addLayerKeyframe(endAction.stage.id, start + a, { transform: { y: 560 + dip }, easing: 'hold' });
                    const g = group(p, 'Wordmark underline / landing response', start + a, start + z);
                    inkLine(p, g.id, [[1184, 560], [1450, 559], [1624, 560 + dip], [1766, 556]], colors.orange, 5, 91);
                }
            }
            start = end;
        }
        b.setMetadata('presentation', 'Scripted visualization of an agent workflow, not a screen recording. Claude Code is depicted as the agent; Codeboard is the product. No endorsement claim.');
        b.setMetadata('source', 'Displayed source is extracted from actual poses.ts. Turnaround has 32 additional model-sheet drawings; rig controls visualize the same procedural leg/body geometry used by art.ts. Public API names and verification figures refer to the saved project and its authoring scripts.');
        b.setMetadata('verification', JSON.stringify(verification));
    });
    if (verification.uniqueRenderedDrawings !== 55 || verification.exposureKeys !== 84 || verification.pairedFramesCompared !== 192)
        throw new Error('Update displayed verification figures to match the actual project.');
    return b;
}
export async function main(movie = process.argv.includes('--movie')) {
    await mkdir(join(launchOut, 'review'), { recursive: true });
    typingFrames.length = 0;
    const b = await authorLaunch();
    await attachSound(b, 'launch-foley.wav', durationSeconds, finalStartFrame / 24, false, launchOut);
    const path = join(launchOut, 'codeboard-launch.cboard');
    await b.save(path, { overwrite: true });
    const saved = await StoryboardProject.open(path), s = createRenderSession(saved);
    let offset = 0;
    const fs = stages.map(([, seconds]) => { const f = offset + Math.floor(seconds * 24 * .72); offset += seconds * 24; return f; });
    for (const [i, f] of fs.entries()) {
        const c = s.frame(f);
        await writeFile(join(launchOut, 'review', `stage-${i + 1}.png`), await c.toBuffer('png'));
        c.getContext('2d').reset();
    }
    await writeFile(join(launchOut, 'launch-overview.png'), await renderFrameSheet(saved, fs, {columns:3,thumbnailWidth:640}));
    await writeFile(join(launchOut, 'timeline.json'), JSON.stringify(stages.reduce((r, [name, seconds]) => { const start = r.at(-1)?.endSeconds ?? 0; r.push({ name, startSeconds: start, endSeconds: start + seconds }); return r; }, [] as {
        name: string;
        startSeconds: number;
        endSeconds: number;
    }[]), null, 2));
    console.log(`Launch authoring: ${durationSeconds} seconds; final begins at ${finalStartFrame / 24}s.`);
    if (movie) {
        const stats = await exportMovie(saved, join(launchOut, 'codeboard-launch.mp4'), { ffmpegPath, onProgress: (n, total) => { if (n % 96 === 0)
                console.log(`Launch ${n}/${total}`); } });
        await writeFile(join(launchOut, 'render.json'), JSON.stringify(stats, null, 2));
    }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
    await main();
