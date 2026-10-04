import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { StoryboardProject, exportMovie } from 'codeboard-studio';
import { output, sheets } from '../lengkap.ts';

const board=await StoryboardProject.open(join(output,'lengkap.cboard'));
await sheets(board);console.log('Refreshed stills from saved editable project.');
if(process.argv.includes('--movie')){
  const stats=await exportMovie(board,join(output,'lengkap.mp4'),{onProgress:(n,total)=>{if(n%24===0)console.log(`Render ${n}/${total}`);}});
  await writeFile(join(output,'render-metrics.json'),JSON.stringify(stats,null,2));
}
