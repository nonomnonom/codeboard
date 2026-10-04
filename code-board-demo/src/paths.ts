import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(process.env.CODEBOARD_DEMO_OUTPUT ?? 'codeboard-demo-output');
export const paths = {
    output,
    root,
    performance: join(output, 'performance'),
    launch: join(output, 'launch'),
};
