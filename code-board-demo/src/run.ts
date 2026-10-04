import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { join } from 'node:path';
import { paths } from './paths.ts';
const command = process.argv[2] ?? 'author';
process.env.SKIA_CANVAS_THREADS ??= '1';
// Each stage releases its renderer and document memory before the next starts.
function run(script: string, args: string[] = []) {
    const result = spawnSync('codeboard', ['run', script, ...args], {
        cwd: paths.root, stdio: 'inherit', windowsHide: true,
        shell: process.platform === 'win32',
        env: {...process.env, CODEBOARD_DEMO_OUTPUT: paths.output},
    });
    if(result.error) throw new Error(`Cannot launch codeboard. Add the installed CLI to PATH. ${result.error.message}`);
    if(result.status !== 0) throw new Error(`${script} failed (${result.status ?? result.signal})`);
}
switch(command) {
    case 'author':
    case 'render':
        run('src/author.ts');
        run('src/verify.ts');
        run('src/launch.ts', command === 'render' ? ['--movie'] : []);
        run('src/turn-review.ts');
        run('src/verify-launch.ts');
        break;
    case 'verify':
        run('src/verify.ts');
        run('src/verify-launch.ts');
        break;
    case 'review-script':
        await mkdir(paths.output,{recursive:true});
        await writeFile(join(paths.output,'review-playback.js'),stripTypeScriptTypes(await readFile(new URL('./review/playback.ts',import.meta.url),'utf8')));
        console.log(join(paths.output,'review-playback.js'));
        break;
    default: throw new Error('Usage: codeboard run src/run.ts [author|render|verify|review-script]');
}
