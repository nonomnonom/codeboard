import {mkdtemp,mkdir,cp,copyFile,readFile,writeFile,chmod,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('../',import.meta.url));
const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
assert(/^[0-9]+\.[0-9]+\.[0-9]+(?:-[\w.-]+)?$/.test(pkg.version),'Invalid package version');
assert(process.env.npm_execpath,'Run with npm run package:portable');
const platform={win32:'windows',linux:'linux',darwin:'macos'}[process.platform];
assert(platform&&['x64','arm64'].includes(process.arch),'Unsupported bundle platform');
const name=`codeboard-${pkg.version}-${platform}-${process.arch}`;
const work=await mkdtemp(join(tmpdir(),'codeboard-portable-'));
const bundle=join(work,name),output=join(root,'release');
function run(command,args,cwd=bundle){
  const result=spawnSync(command,args,{cwd,encoding:'utf8',windowsHide:true});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(`${command} failed: ${result.stderr}\n${result.stdout}`);
  return result.stdout;
}
try{
  await mkdir(join(bundle,'runtime'),{recursive:true});
  for(const file of ['package.json','package-lock.json','LICENSE','NOTICE'])await copyFile(join(root,file),join(bundle,file));
  await cp(join(root,'dist/src'),join(bundle,'dist/src'),{recursive:true});
  await copyFile(join(root,'docs/install.md'),join(bundle,'INSTALL.md'));
  process.stdout.write(run(process.execPath,[process.env.npm_execpath,'ci','--omit=dev','--no-audit','--no-fund']));
  const nodeName=process.platform==='win32'?'node.exe':'node';
  await copyFile(process.execPath,join(bundle,'runtime',nodeName));
  await chmod(join(bundle,'runtime',nodeName),0o755);
  const license=await fetch(`https://raw.githubusercontent.com/nodejs/node/${process.version}/LICENSE`);
  assert(license.ok,`Cannot retrieve Node license: ${license.status}`);
  await writeFile(join(bundle,'runtime','LICENSE'),await license.text());
  await writeFile(join(bundle,'runtime','VERSION'),`${process.version}\n`);
  if(process.platform==='win32'){
    await writeFile(join(bundle,'codeboard.cmd'),'@echo off\r\n"%~dp0runtime\\node.exe" "%~dp0dist\\src\\cli.js" %*\r\n');
  }else{
    await writeFile(join(bundle,'codeboard'),'#!/bin/sh\nbase=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd) || exit 1\nexec "$base/runtime/node" "$base/dist/src/cli.js" "$@"\n');
    await chmod(join(bundle,'codeboard'),0o755);
  }
  await mkdir(output,{recursive:true});
  const archive=join(output,`${name}.${process.platform==='win32'?'zip':'tar.gz'}`);
  run('tar',process.platform==='win32'?['-a','-cf',archive,'-C',work,name]:['-czf',archive,'-C',work,name]);
  const extracted=join(work,'extracted');await mkdir(extracted);
  run('tar',['-xf',archive,'-C',extracted]);
  const installed=join(extracted,name),node=join(installed,'runtime',nodeName);
  await copyFile(join(root,'scripts/package-smoke.mjs'),join(installed,'.verify.mjs'));
  process.stdout.write(run(node,['.verify.mjs'],installed));
  const version=process.platform==='win32'
    ?run(process.env.ComSpec??'cmd.exe',['/d','/c','codeboard.cmd','--version'],installed)
    :run(join(installed,'codeboard'),['--version'],installed);
  assert.equal(version.trim(),pkg.version,'Portable launcher version mismatch');
  console.log(`Verified extracted portable bundle: ${archive}`);
}finally{
  const local=relative(resolve(tmpdir()),resolve(work));
  assert(local.startsWith('codeboard-portable-')&&!local.includes('..'),'Invalid staging cleanup path');
  await rm(work,{recursive:true,force:true});
}
