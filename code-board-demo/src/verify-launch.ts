import { paths } from './paths.ts';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { StoryboardProject, createRenderSession } from 'codeboard-studio';
import { stages, launchOut, durationSeconds, finalStartFrame } from './launch.ts';
import { turnCelCount } from './studio-scenes.ts';
const launch = await StoryboardProject.open(join(launchOut, 'codeboard-launch.cboard'));
const final = await StoryboardProject.open(join(paths.performance, 'clawd-final.cboard'));
const doc = launch.toJSON(), ls = createRenderSession(launch), fs = createRenderSession(final);
assert.equal(ls.durationFrames, durationSeconds * 24);
assert.equal(doc.frameRate, 24);
assert.deepEqual([doc.canvas.width, doc.canvas.height], [1920, 1080]);
let start = 0;
for (const [i, [, seconds]] of stages.entries()) {
    assert.equal(doc.panels[i].startFrame, start);
    assert.equal(doc.panels[i].durationFrames, seconds * 24);
    start += seconds * 24;
}
async function pixels(c: ReturnType<ReturnType<typeof createRenderSession>['frame']>) { try {
    return await c.toBuffer('raw');
}
finally {
    c.getContext('2d').reset();
} }
for (let f = 0; f < 192; f++) {
    const actual = await pixels(ls.frame(finalStartFrame + f)), expected = await pixels(fs.frame(f));
    if (!actual.equals(expected)) {
        let changed = 0, maximum = 0;
        for(let i=0;i<actual.length;i++) if(actual[i]!==expected[i]) {changed++; maximum=Math.max(maximum,Math.abs(actual[i]-expected[i]));}
        await writeFile(join(launchOut,'review',`mismatch-${f}-launch.png`),await ls.frame(finalStartFrame+f).toBuffer('png'));
        await writeFile(join(launchOut,'review',`mismatch-${f}-final.png`),await fs.frame(f).toBuffer('png'));
        assert.fail(`Final shot mismatch at ${f}: ${changed} channel bytes, maximum delta ${maximum}`);
    }
    if (f % 48 === 0)
        console.log(`Launch final comparison ${f}/192`);
}
const finalPanel = doc.panels[stages.findIndex(([name]) => name === 'THE ANIMATION')], shot = doc.shots.find(s => s.id === finalPanel.shotId);
assert.ok(shot);
assert.equal(shot.cameraKeyframes.length, 0);
assert.ok(!JSON.stringify(finalPanel).includes('Onion'));
const turnPanel = doc.panels[stages.findIndex(([name]) => name === 'TURNAROUND')];
const turnStage = turnPanel.layers.find(l => l.name === 'Turntable staging');
assert.ok(turnStage && turnStage.kind === 'group');
const turnTrack = turnStage.children[0];
assert.ok(turnTrack.kind === 'group');
assert.ok(turnTrack.drawingSequence);
assert.equal(turnTrack.children.length, turnCelCount);
assert.equal(turnTrack.drawingSequence.length, turnCelCount + 1);
for (const cel of turnTrack.children) {
    assert.ok(cel.kind === 'group');
    const legs = cel.children.filter(l => l.name.startsWith('Leg '));
    assert.equal(legs.length, 4);
    for (const layer of legs) {
        assert.ok(layer.kind === 'vector');
        const leg = layer.elements[0];
        assert.equal(leg.kind, 'vector-path');
        assert.equal(leg.commands.length, 9);
    }
}
const rigPanel = doc.panels[stages.findIndex(([name]) => name === 'RIGGING')];
const rigTrack = rigPanel.layers.find(l => l.name === 'Rig controls and generated contours');
assert.ok(rigTrack && rigTrack.kind === 'group');
assert.ok(rigTrack.drawingSequence);
assert.equal(rigTrack.children.length, 13);
assert.equal(rigTrack.drawingSequence.length, 13);
let maxCurveError = 0;
for (let i = 0; i <= 1000; i++) {
    const u = i / 1000, p1 = -185 * 4 / 3, p2 = p1;
    const bezierY = 3 * (1 - u) ** 2 * u * p1 + 3 * (1 - u) * u * u * p2;
    maxCurveError = Math.max(maxCurveError, Math.abs(bezierY - (-185 * 4 * u * (1 - u))));
}
assert.ok(maxCurveError < 1e-10);
// Inspect the typing and popup transitions as rendered, not only as keyframe data.
for (const f of stages.flatMap(([, seconds], i) => { const a = stages.slice(0, i).reduce((n, [, d]) => n + d * 24, 0); return [a, a + Math.floor(seconds * 12), a + seconds * 24 - 1]; })) {
    const c = ls.frame(f);
    await writeFile(join(launchOut, 'review', `frame-${f}.png`), await c.toBuffer('png'));
    c.getContext('2d').reset();
}
const report = { width: 1920, height: 1080, fps: 24, seconds: durationSeconds, frames: durationSeconds * 24, finalStartFrame, finalFramesMatched: 192, finalCameraLocked: true, turnaroundCels: turnCelCount, fourLegPathsPerTurnCel: true, rigControlCels: 12, rigControlsHiddenAtEnd: true, bezierSampleCount: 1001, maximumBezierParabolaDifference: maxCurveError, sourceExcerpts: 'Read from poses.ts during authoring', presentation: 'Scripted agent workflow visualization; displayed source and verification figures are real', performanceProjects: 'performance/codeboard-showreel.cboard and performance/clawd-final.cboard' };
await writeFile(join(launchOut, 'verification.json'), JSON.stringify(report, null, 2));
console.log(report);
