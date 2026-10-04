import {mkdtemp,rm,writeFile,unlink} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {it,expect} from "vitest";
import {StoryboardProject,createToneWav,exportMovie,renderFramePNG,decodePixels,pathCommands} from "../src/index.js";
const ffmpeg=process.env.FFMPEG_PATH;

it.skipIf(!ffmpeg)('exports editable gradient artwork and animated opacity consistently with preview',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'gradient-movie-'));
 try{
  const p=StoryboardProject.create({title:'Gradient export',width:96,height:54,frameRate:24,background:'white'});
  const panel=p.addScene('S').addShot('S').addPanel({durationFrames:12}),layer=panel.addVectorLayer('Gradient');
  layer.path(pathCommands('M 0 0 L 96 0 L 96 54 L 0 54 Z'),{fill:{kind:'linear',from:{x:0,y:0},to:{x:96,y:0},stops:[{offset:0,color:'black'},{offset:1,color:'white'}]}});
  p.production.addLayerKeyframe(layer.id,0,{opacity:1});p.production.addLayerKeyframe(layer.id,11,{opacity:.2});
  const file=join(directory,'gradient.mp4');await exportMovie(p,file,{ffmpegPath:ffmpeg!});
  const decoded=await promisify(execFile)(ffmpeg!,['-v','error','-i',file,'-vf','select=eq(n\\,0)+eq(n\\,11)','-fps_mode','passthrough','-pix_fmt','rgba','-f','rawvideo','pipe:1'],{encoding:'buffer',maxBuffer:1024*1024});
  const frameBytes=96*54*4;expect(decoded.stdout.length).toBe(frameBytes*2);
  for(const [index,frame] of [0,11].entries()){
   const preview=await decodePixels(await renderFramePNG(p,frame));
   for(const x of [12,36,60,84])for(let c=0;c<3;c++){
    const at=(27*96+x)*4+c;
    expect(Math.abs(decoded.stdout[index*frameBytes+at]!-preview.pixels[at]!)).toBeLessThanOrEqual(8);
   }
  }
  expect(decoded.stdout[frameBytes+(27*96+12)*4]!-decoded.stdout[(27*96+12)*4]!).toBeGreaterThan(150);
 }finally{await rm(directory,{recursive:true,force:true});}
},30000);

it.skipIf(!ffmpeg)('exports a muted track without reading its unavailable source',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'muted-track-'));
 try{
  const p=StoryboardProject.create({title:'Muted export',width:32,height:32});
  p.addScene('S').addShot('S').addPanel({durationFrames:4});
  const asset=p.production.addAsset({name:'Unavailable scratch',kind:'audio',path:'missing.wav',source:'linked',mimeType:'audio/wav'});
  const track=p.production.addAudioTrack('Scratch');
  p.production.addAudioClip(track,{assetId:asset,name:'Scratch',startFrame:0,sourceInFrame:0,durationFrames:4,volume:1,fadeInFrames:0,fadeOutFrames:0});
  p.production.updateAudioTrack(track,{muted:true});
  const file=join(directory,'muted.mp4');expect((await exportMovie(p,file,{assetRoot:directory,ffmpegPath:ffmpeg!})).frames).toBe(4);
  const decoded=await promisify(execFile)(ffmpeg!,['-hide_banner','-i',file,'-f','null','-']);
  expect(decoded.stderr).not.toMatch(/Audio:/);expect(decoded.stderr).toMatch(/Video:/);
 }finally{await rm(directory,{recursive:true,force:true});}
},30000);

it.skipIf(!ffmpeg)("keeps timeline duration when audio ends early or a trim begins beyond its source",async()=>{
  const directory=await mkdtemp(join(tmpdir(),"board-short-audio-"));
  try{
    const p=StoryboardProject.create({title:"Short source",width:64,height:64,frameRate:24});
    p.addScene("S").addShot("S").addPanel({durationFrames:24});
    await writeFile(join(directory,"short.wav"),createToneWav({durationSeconds:.125,volume:.5,attackSeconds:0,releaseSeconds:0}));
    const asset=p.production.addAsset({name:"Short tone",kind:"audio",path:"short.wav",source:"managed",mimeType:"audio/wav"});
    const track=p.production.addAudioTrack("Sound");
    p.production.addAudioClip(track,{assetId:asset,name:"Short source in long clip",startFrame:6,sourceInFrame:0,durationFrames:18,volume:1,fadeInFrames:0,fadeOutFrames:2});
    p.production.addAudioClip(track,{assetId:asset,name:"Trim beyond EOF",startFrame:18,sourceInFrame:12,durationFrames:6,volume:1,fadeInFrames:0,fadeOutFrames:0});
    const file=join(directory,"movie.mp4");
    const result=await exportMovie(p,file,{assetRoot:directory,ffmpegPath:ffmpeg!});
    expect(result.frames).toBe(24);expect(result.seconds).toBe(1);
    const {stdout}=await promisify(execFile)(ffmpeg!,["-v","error","-i",file,"-map","0:a:0","-f","f32le","-ac","1","-ar","48000","pipe:1"],{encoding:"buffer",maxBuffer:1024*1024});
    const rms=(from:number,to:number)=>{let sum=0;for(let i=from;i<to;i++)sum+=stdout.readFloatLE(i*4)**2;return Math.sqrt(sum/(to-from));};
    expect(stdout.length/4).toBeGreaterThanOrEqual(48000);
    expect(rms(1000,9000)).toBeLessThan(.002);
    expect(rms(13500,16500)).toBeGreaterThan(.2);
    expect(rms(21000,46000)).toBeLessThan(.002);
    const frames=await promisify(execFile)(ffmpeg!,["-v","error","-i",file,"-map","0:v:0","-f","framemd5","-"],{encoding:"utf8"});
    expect(frames.stdout.split(/\r?\n/).filter(line=>line.startsWith("0,"))).toHaveLength(24);
  }finally{await rm(directory,{recursive:true,force:true});}
},30000);

it.skipIf(!ffmpeg)("encodes real video and trimmed, placed, faded audio",async()=>{
  const directory=await mkdtemp(join(tmpdir(),"board-movie-"));
  try{
    const p=StoryboardProject.create({title:"Movie integration",width:96,height:54,frameRate:24});
    const panel=p.addScene("S").addShot("S").addPanel({durationFrames:12});
    panel.addVectorLayer("Art").text("test",10,30,{font:"12px sans-serif"});
    await writeFile(join(directory,"tone.wav"),createToneWav({durationSeconds:1,volume:.6,attackSeconds:0,releaseSeconds:0}));
    const asset=p.production.addAsset({kind:"audio",name:"tone",path:"tone.wav",mimeType:"audio/wav",source:"managed"});
    const track=p.production.addAudioTrack("sound");
    p.production.addAudioClip(track,{assetId:asset,name:"trimmed tone",startFrame:6,sourceInFrame:3,durationFrames:6,volume:.5,fadeInFrames:1,fadeOutFrames:1});
    const projectFile=join(directory,"project.cboard");await p.save(projectFile);
    await unlink(join(directory,"tone.wav"));
    const reopened=await StoryboardProject.open(projectFile);
    const file=join(directory,"movie.mp4"),result=await exportMovie(reopened,file,{ffmpegPath:ffmpeg!});
    expect(result.frames).toBe(12);
    const {stdout}=await promisify(execFile)(ffmpeg!,["-v","error","-i",file,"-map","0:a:0","-f","f32le","-ac","1","-ar","48000","pipe:1"],{encoding:"buffer",maxBuffer:1024*1024});
    const rms=(from:number,to:number)=>{let sum=0;for(let i=from;i<to;i++)sum+=stdout.readFloatLE(i*4)**2;return Math.sqrt(sum/(to-from));};
    expect(rms(1000,9000)).toBeLessThan(.002);expect(rms(15000,19500)).toBeGreaterThan(.1);
    const destination=reopened.production.addAudioTrack("Final effects");
    const clip=reopened.production.audioClips(track)[0]!;
    reopened.production.moveAudioClip(clip.id,destination);
    const movedFile=join(directory,"moved.mp4");
    await exportMovie(reopened,movedFile,{ffmpegPath:ffmpeg!});
    const moved=await promisify(execFile)(ffmpeg!,["-v","error","-i",movedFile,"-map","0:a:0","-f","f32le","-ac","1","-ar","48000","pipe:1"],{encoding:"buffer",maxBuffer:1024*1024});
    expect(moved.stdout.equals(stdout)).toBe(true);
    reopened.production.splitAudioClip(clip.id,9);
    const splitFile=join(directory,"split.mp4");
    await exportMovie(reopened,splitFile,{ffmpegPath:ffmpeg!});
    const split=await promisify(execFile)(ffmpeg!,["-v","error","-i",splitFile,"-map","0:a:0","-f","f32le","-ac","1","-ar","48000","pipe:1"],{encoding:"buffer",maxBuffer:1024*1024});
    expect(split.stdout.equals(stdout)).toBe(true);
    const verify=await promisify(execFile)(ffmpeg!,["-v","error","-i",file,"-map","0:v:0","-f","null","-"],{encoding:"utf8"});expect(verify.stderr).toBe("");
  }finally{await rm(directory,{recursive:true,force:true});}
},30000);
