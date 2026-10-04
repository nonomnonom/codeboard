import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {installUpdate} from '../src/updates.ts';

const work=await mkdtemp(join(tmpdir(),'codeboard-installer-'));
const target=join(work,"Artist's studio");
const windows=process.platform==='win32';
const launcher=join(target,'bin',windows?'codeboard.cmd':'codeboard');
const run=(command,args,cwd)=>spawnSync(command,args,{cwd,encoding:'utf8',windowsHide:true,timeout:240000});
const install=version=>windows
  ?run('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',resolve('website/public/install.ps1'),'-Version',version,'-InstallDir',target,'-NoModifyPath'])
  :run('sh',[resolve('website/public/install.sh'),'--version',version,'--prefix',target,'--no-modify-path']);
try{
  // Use a published archive so CI exercises the real GitHub download and checksum path before a new release exists.
  for(let attempt=0;attempt<2;attempt++){
    const result=install('0.1.1');
    assert.equal(result.status,0,result.stderr+result.stdout);
  }
  const result=windows
    ?run(process.env.ComSpec??'cmd.exe',['/d','/c','codeboard.cmd','--version'],join(target,'bin'))
    :run(launcher,['--version']);
  assert.equal(result.status,0,result.stderr);
  assert.equal(result.stdout.trim(),'0.1.1');
  const before=await readFile(launcher);
  assert.notEqual(install('99999.0.0').status,0,'Missing release must fail');
  assert.deepEqual(await readFile(launcher),before,'Failed update changed the active command');
  await installUpdate(join(target,'versions','0.1.1','package.json'),'0.1.1','0.2.0');
  const updated=windows
    ?run(process.env.ComSpec??'cmd.exe',['/d','/c','codeboard.cmd','--version'],join(target,'bin'))
    :run(launcher,['--version']);
  assert.equal(updated.status,0,updated.stderr);
  assert.equal(updated.stdout.trim(),'0.2.0');
  assert.equal((await readFile(join(target,'versions','0.1.1','.codeboard-install'),'utf8')).trim(),'0.1.1');
  console.log('Installer: verified download, custom path, reinstall, failed-update preservation and verified in-place upgrade passed');
}finally{await rm(work,{recursive:true,force:true});}
