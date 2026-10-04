import { renderFrameSheet } from 'codeboard-studio';
import type { DrawOptions } from './types.ts';
import type { PanelHandle, Transform } from 'codeboard-studio';
import { paths } from './paths.ts';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { StoryboardProject, createRenderSession, exportMovie, encodeWav } from 'codeboard-studio';
import { acting, at, drawing } from './poses.ts';
import { colors, text, line, inkLine, ground, obstacle, drawClawd, poly } from './art.ts';
import { finalStage } from './final-stage.ts';
export const out = paths.performance;
const FF = process.env.FFMPEG_PATH;
function project(title: string) { return StoryboardProject.create({ title, width: 1920, height: 1080, frameRate: 24, background: colors.bg, seed: 72 }); }
function panel(p: StoryboardProject, title: string, duration: number) { return p.addScene(title).addShot(title).addPanel({ title, durationFrames: duration }); }
function heading(p: PanelHandle, number: string, title: string, subtitle?: string) { text(p, 'Codeboard', 100, 110, 40); text(p, `${number} / ${title}`, 1820, 105, 25, colors.paper, undefined, 'Segoe Print', 'right'); if (subtitle)
    text(p, subtitle, 100, 200, 36); }
function sample(p: PanelHandle, f: number, x: number, y: number, s = 1, opts: DrawOptions = {}) { const e = at(f); return drawClawd(p, drawing(e.id), { x, y: y + e.y * s, scale: s, name: `${e.id} / final local frame ${f}`, ...opts }); }
function label(p: PanelHandle, f: number, x: number, y: number) { const e = at(f); text(p, `${e.id}  /  f${String(f).padStart(3, '0')}`, x, y, 23, colors.muted, undefined, 'Consolas', 'center'); }
export function sequence(board: StoryboardProject, p: PanelHandle, start: number, sourceStart: number, length: number, placement: Partial<Transform>, rough = false, detail = true) {
    const stage = p.addGroup(rough ? 'Rough action staging' : 'Action staging', { transform: placement });
    const track = p.addGroup(rough ? 'Rough cel substitutions' : 'Clean cel substitutions', {}, stage.id);
    const entries = [{ ...at(sourceStart), frame: sourceStart }, ...acting.exposures.filter(e => e.frame > sourceStart && e.frame < sourceStart + length)];
    const ids = new Map<string, string>();
    for (const e of entries)
        if (!ids.has(e.id))
            ids.set(e.id, drawClawd(p, drawing(e.id), { parent: track.id, rough, detail, name: e.id }).id);
    board.production.setDrawingSequence(track.id, entries.map(e => ({ frame: start + e.frame - sourceStart, drawingId: ids.get(e.id)! })));
    for (const e of entries)
        board.production.addLayerKeyframe(track.id, start + e.frame - sourceStart, { transform: { x: e.x, y: e.y }, easing: 'hold' });
    return { stage, track };
}
export function authorFinal() {
    const b = project('Codeboard / Clawd performance');
    b.transaction('Author four-legged performance with cel exposure', () => {
        const p = panel(b, 'Walk, notice, hop, land, settle', 192);
        finalStage(p);
        sequence(b, p, 0, 0, 192, { x: -120, y: 800, scaleX: 1.3, scaleY: 1.3 });
        b.setMetadata('artwork', 'Original code-authored Clawd contours; reference image is not a render asset.');
        b.setMetadata('timing', '24 fps; mostly twos; 12 walk drawings repeated three times; notice and settle holds.');
    });
    return b;
}
export function authorReel() {
    const b = project('Codeboard / Animate your idea with code.');
    b.transaction('Author eight-part showreel from the performance drawings', () => {
        let p = panel(b, 'IDEA', 48);
        text(p, 'Codeboard', 150, 280, 124);
        text(p, 'Animate your idea with code.', 160, 370, 42);
        inkLine(p, undefined, [[158, 304], [514, 306], [910, 298]], colors.orange, 8);
        const terminal = p.addVectorLayer('Prompt terminal');
        poly(terminal, [[155, 485], [1770, 485], [1770, 820], [155, 820]], undefined, colors.muted, 2);
        text(p, 'Claude Code  /  agent', 192, 542, 27, colors.muted, undefined, 'Consolas');
        text(p, '> Animate Clawd walking, stopping,', 192, 640, 42, colors.paper, undefined, 'Consolas');
        text(p, '  and hopping over a line.', 192, 704, 42, colors.paper, undefined, 'Consolas');
        p = panel(b, 'STORYBOARD', 48);
        heading(p, '02', 'STORYBOARD', 'One small obstacle. One considered hop.');
        for (const [i, f, name] of [[0, 8, 'WALK'], [1, 94, 'NOTICE'], [2, 142, 'HOP & LAND']] as const) {
            const x = 100 + i * 590, y = 300, l = p.addVectorLayer(`${name} panel`);
            poly(l, [[x, y], [x + 550, y + 2], [x + 550, y + 510], [x, y + 508]], undefined, colors.paper, 2);
            ground(p, x + 30, x + 520, 705);
            if (i < 2)
                sample(p, f, x + 250, 705, 1.04);
            else {
                sample(p, 140, x + 180, 705, 1.04, { exposure: { startFrame: 48, endFrame: 72 } });
                sample(p, 156, x + 385, 705, 1.04, { exposure: { startFrame: 72, endFrame: 96 } });
            }
            if (i > 0)
                obstacle(p, x + (i === 2 ? 230 : 433), 705);
            text(p, name, x + 275, 883, 32, colors.paper, undefined, 'Segoe Print', 'center');
        }
        p = panel(b, 'KEY DRAWINGS', 72);
        heading(p, '03', 'KEY DRAWINGS', 'Weight changes the drawing.');
        for (const [i, f, name] of [[0, 4, 'SUPPORT'], [1, 124, 'ANTICIPATION'], [2, 142, 'AIRBORNE'], [3, 156, 'CONTACT / WEIGHT']] as const) {
            const x = 265 + i * 465;
            ground(p, x - 195, x + 195, 705);
            sample(p, f, x, 705, 1.35);
            text(p, name, x, 820, 26, colors.paper, undefined, 'Segoe Print', 'center');
            label(p, f, x, 872);
        }
        p = panel(b, 'DRAWING SEQUENCE', 48);
        heading(p, '04', 'DRAWING SEQUENCE', 'From compression to release.');
        for (let i = 0; i < 8; i++) {
            const f = 122 + i * 2, x = 170 + i * 226;
            ground(p, x - 95, x + 95, 690);
            sample(p, f, x, 690, .82);
            label(p, f, x, 778);
        }
        text(p, 'Consecutive exposures from the final action  /  24 fps, mostly on twos', 960, 931, 27, colors.muted, undefined, 'Segoe Print', 'center');
        p = panel(b, 'IN-BETWEEN', 48);
        heading(p, '05', 'IN-BETWEEN', 'The push leaves the feet last.');
        // Exact preceding and following cels, with their original action-space displacement.
        for (const [f, opacity] of [[126, .19], [130, .22]] as const)
            sample(p, f, 980, 805, 2.4, { opacity });
        sample(p, 128, 980, 805, 2.4);
        ground(p, 500, 1440, 805);
        text(p, 'f126', 600, 910, 25, colors.muted, undefined, 'Consolas');
        text(p, 'f128 / active', 980, 910, 27, colors.paper, undefined, 'Consolas', 'center');
        text(p, 'f130', 1350, 910, 25, colors.muted, undefined, 'Consolas');
        p = panel(b, 'ROUGH TO CLEAN', 72);
        heading(p, '06', 'ROUGH TO CLEAN', 'Same action. Same exposure.');
        text(p, 'ROUGH', 485, 315, 30, colors.paper, undefined, 'Segoe Print', 'center');
        text(p, 'CLEAN', 1435, 315, 30, colors.paper, undefined, 'Segoe Print', 'center');
        const divider = p.addVectorLayer('Comparison divider');
        line(divider, [[960, 360], [960, 882]], colors.muted, 1);
        for (const [base, rough] of [[-625, true], [325, false]] as const) {
            ground(p, base + 790, base + 1470, 810);
            obstacle(p, base + 1177, 810);
            sequence(b, p, 264, 112, 72, { x: base, y: 810, scaleX: 1.1, scaleY: 1.1 }, rough);
        }
        p = panel(b, 'FINAL ANIMATION', 192);
        finalStage(p, 336);
        sequence(b, p, 336, 0, 192, { x: -120, y: 800, scaleX: 1.3, scaleY: 1.3 });
        p = panel(b, 'END CARD', 48);
        text(p, 'Codeboard', 310, 523, 138);
        text(p, 'Animate your idea with code.', 325, 654, 44);
        inkLine(p, undefined, [[323, 567], [720, 555], [1170, 558]], colors.orange, 9);
        sample(p, 190, 1510, 650, 1.5);
        b.setMetadata('credit', 'Claude Code is the agent shown in the demo concept. Codeboard is the product; no endorsement is claimed.');
        b.setMetadata('artwork', 'Editable vector cels and procedural ink via Codeboard public APIs. No bitmap character or camera animation.');
    });
    return b;
}
export function sound(seconds: number, actionOffset = 0, process = false) {
    const sr = 48000, data = new Float32Array(seconds * sr);
    let seed = 314159;
    const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2147483648 - 1; };
    function tap(t: number, duration: number, amp: number, freq: number, type = 'tap') {
        const start = Math.round(t * sr), n = Math.round(duration * sr);
        for (let i = 0; i < n && start + i < data.length; i++) {
            const s = i / sr, u = i / n, env = Math.min(1, i / 180) * Math.exp(-u * (type === 'scrape' ? 2 : 7));
            const wave = type === 'scrape' ? noise() * .35 : Math.sin(2 * Math.PI * (freq * s - freq * .25 * s * s / duration)) * .78 + noise() * .14;
            data[start + i] += amp * env * wave;
        }
    }
    if (process)
        for (const t of [0, 2, 4, 7, 9, 11] as const)
            tap(t + .07, .24, .10, 400, 'scrape');
    const performanceAudio = (offset: number) => {
        for (const f of [0, 12, 24, 36, 48, 60, 72, 84] as const)
            tap(offset + f / 24, .095, .15, 180);
        tap(offset + 128 / 24, .18, .12, 530);
        tap(offset + 152 / 24, .20, .24, 100);
        tap(offset + 174 / 24, .07, .055, 240);
    };
    performanceAudio(actionOffset);
    if (process) {
        tap(11 + (128 - 112) / 24, .18, .08, 530);
        tap(11 + (152 - 112) / 24, .18, .13, 100);
    }
    return encodeWav([data], sr);
}
export async function attachSound(b: StoryboardProject, name: string, seconds: number, offset: number, process: boolean, directory = out) {
    const bytes = sound(seconds, offset, process);
    await writeFile(join(directory, name), bytes);
    b.transaction('Attach original synthesized Foley', () => {
        const id = b.production.addAsset({ name, kind: 'audio', path: name, mimeType: 'audio/wav', source: 'managed', checksum: createHash('sha256').update(bytes).digest('hex') });
        const track = b.production.addAudioTrack('Original drawing, footfalls, hop and landing / CC0');
        b.production.addAudioClip(track, { assetId: id, name: 'Original Foley', startFrame: 0, sourceInFrame: 0, durationFrames: seconds * 24, volume: 1, fadeInFrames: 0, fadeOutFrames: 0 });
    });
}
async function sheets(final: StoryboardProject, reel: StoryboardProject) {
    const b = StoryboardProject.create({ title: 'Codeboard / actual performance contact sheet', width: 1920, height: 1440, frameRate: 24, background: colors.bg });
    b.transaction('Arrange actual cels for inspection', () => {
        const p = panel(b, 'Key drawings and in-betweens', 1);
        text(p, 'Codeboard / performance drawings', 70, 86, 38);
        const fs = [0, 4, 8, 12, 88, 94, 118, 124, 128, 130, 134, 140, 146, 152, 156, 162, 170, 186];
        fs.forEach((f, i) => { const x = 180 + (i % 6) * 312, y = 430 + Math.floor(i / 6) * 440; ground(p, x - 130, x + 130, y); sample(p, f, x, y, .86); label(p, f, x, y + 45); });
    });
    await writeFile(join(out, 'contact-sheet.png'), await createRenderSession(b).frame(0).toBuffer('png'));
    await b.save(join(out, 'contact-sheet.cboard'), { overwrite: true });
    await writeFile(join(out, 'reel-overview.png'), await renderFrameSheet(reel, [24,60,132,192,240,300,478,552], {columns:4,thumbnailWidth:480}));
    const fs = createRenderSession(final);
    for (const f of [8, 94, 124, 130, 140, 152, 156, 186] as const)
        await writeFile(join(out, `frame-${f}.png`), await fs.frame(f).toBuffer('png'));
}
export async function main() {
    await mkdir(out, { recursive: true });
    const final = authorFinal(), reel = authorReel();
    await attachSound(final, 'clawd-foley.wav', 8, 0, false);
    await attachSound(reel, 'showreel-foley.wav', 24, 14, true);
    await final.save(join(out, 'clawd-final.cboard'), { overwrite: true });
    await reel.save(join(out, 'codeboard-showreel.cboard'), { overwrite: true });
    await sheets(final, reel);
    await writeFile(join(out, 'exposures.json'), JSON.stringify({ fps: 24, durationFrames: 192, uniqueDrawings: acting.drawings.size, exposures: acting.exposures }, null, 2));
    console.log(`Authored ${acting.drawings.size} unique drawings, ${acting.exposures.length} exposures.`);
    if (process.argv.includes('--movie'))
        for (const [_b, name] of [[final, 'clawd-final'], [reel, 'codeboard-showreel']] as const) {
            const reopened = await StoryboardProject.open(join(out, `${name}.cboard`));
            const stats = await exportMovie(reopened, join(out, `${name}.mp4`), { ...(FF ? { ffmpegPath: FF } : {}), onProgress: (n, total) => { if (n % 48 === 0)
                    console.log(`${name}: ${n}/${total}`); } });
            await writeFile(join(out, `${name}-render.json`), JSON.stringify(stats, null, 2));
        }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
    await main();
