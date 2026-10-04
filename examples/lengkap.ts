import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Canvas } from 'skia-canvas';
import { StoryboardProject, createRenderSession, exportMovie } from '../src/index.js';
import { Art, paper, ink, red, rough, dry, fine, stampInk, charcoal, pastel, pencil, document, person, motor, emptyMotor, warehouse, stampPrint } from './lengkap/art.js';
import { makeSound } from './lengkap/sound.js';

export const output=resolve('examples/output/lengkap');
export function author(){
  const board=StoryboardProject.create({id:'project:lengkap',title:'LENGKAP',width:1920,height:1080,frameRate:24,background:paper,seed:37});
  const titles=['MENULIS','MEMENUHI LAPORAN','MENGESAHKAN','MEMERIKSA KENYATAAN','TIDAK TERHUBUNG','PENUTUP'];
  const actions=['Laporan disusun.','Enam gambar motor memenuhi laporan.','Cap menyatakan lengkap.','Tempat barang tidak terisi.','Laporan tidak terhubung ke kenyataan.','Di kertas, semuanya ada.'];
  for(let i=0;i<6;i++)board.transaction(`Draw scene ${i+1}`,()=>{
    const p=board.addScene(titles[i]!,`scene:${i+1}`).addShot(titles[i]!,`shot:${i+1}`).addPanel({id:`panel:${i+1}`,number:String(i+1).padStart(2,'0'),title:titles[i]!,action:actions[i]!,durationFrames:60});
    const a=new Art(board,p,i*60);
    if(i===0){
      const desk=a.layer('Table / broad overlapping sweeps');a.stroke(desk,[[12,636],[549,674],[1257,594]],68,2,12);a.stroke(desk,[[42,665],[563,701],[1206,641]],36,8,9);a.stroke(desk,[[59,622],[614,578],[1241,560]],13,7,9);
      a.stroke(desk,[[116,642],[208,653],[318,663]],2.4,8,5,paper,fine);
      a.stroke(desk,[[398,683],[487,688],[605,686],[690,680]],2.8,12,6,paper,fine);
      a.stroke(desk,[[1010,641],[1081,628],[1160,612]],1.8,13,5,paper,fine);
      const figure=person(a,367,196,1.58,'write',7);
      a.move(figure.arm,[[0,0,0],[30,0,0],[36,6,-4],[41,0,0],[47,5,-3],[53,0,0]]);
      document(a,640,85,355,476,20);
      const pen=a.layer('Pen / simple nib');a.stroke(pen,[[700,583],[653,510],[617,453]],16,28,5,ink,dry);
      a.move(pen,[[0,0,0],[30,0,0],[36,6,-4],[41,0,0],[47,5,-3],[53,0,0]]);
      const marks=a.layer('Report / two written lines');a.stroke(marks,[[700,433],[910,424]],9,35,7);a.stroke(marks,[[700,470],[928,464]],9,45,7);
    }
    if(i===1){
      const page=a.group('Report / close-up angle',38,85);page.set({transform:{x:38,y:85,scaleX:1,scaleY:1,rotation:-.13}});
      document(a,0,-63,1160,853,undefined,page.id);
      for(let j=0;j<6;j++)motor(a,233+(j%3)*321,316+Math.floor(j/3)*243,1.50,[1,9,17,25,33,41][j]!,j===5?15:9,page.id);
    }
    if(i===2){
      const page=a.group('Paper / impact response');
      const edge=a.layer('Report / cropped diagonal edges',page.id);a.stroke(edge,[[228,770],[67,160]],24);a.stroke(edge,[[73,153],[910,-102]],23);a.stroke(edge,[[921,-18],[1265,715]],25);a.stroke(edge,[[176,743],[40,285]],10);
      const rules=a.layer('Report / spare rules',page.id);a.stroke(rules,[[233,181],[711,66]],8);a.stroke(rules,[[267,224],[751,126]],8);a.stroke(rules,[[378,609],[687,533]],9);a.stroke(rules,[[397,656],[725,580]],9);
      const imprint=a.group('Cap / appears only at contact',607,351,1.28,page.id);imprint.set({transform:{x:607,y:351,scaleX:1.28,scaleY:1.28,rotation:-.24}});stampPrint(a,imprint.id);a.appear(imprint,14);
      a.move(page,[[0,0,0],[13,0,0],[14,0,5],[17,0,-2],[21,0,0]]);
      const stamp=a.group('Stamp / handle and base',607,351,1.28);
      const solid=a.layer('Stamp / two black masses',stamp.id);
      a.stroke(solid,[[0,-282],[0,-82]],180,undefined,1,ink,rough);
      a.stroke(solid,[[-70,-283],[-81,-171],[-72,-84]],8);
      a.stroke(solid,[[-263,0],[263,0]],160,undefined,1,ink,dry);
      a.stroke(solid,[[-262,73],[270,70]],12);
      const stampDetail=a.layer('Detail / stamp contour and worn ink strokes',stamp.id);
      a.stroke(stampDetail,[[-54,-315],[-73,-273],[-73,-215]],5,undefined,6,ink,charcoal);
      a.stroke(stampDetail,[[-39,-299],[-49,-265],[-48,-239]],4,undefined,6,paper,pastel);
      a.stroke(stampDetail,[[-216,45],[-145,48],[-94,46]],4.3,undefined,6,paper,pastel);
      a.stroke(stampDetail,[[34,56],[88,57],[130,54]],2.3,undefined,6,paper,pencil);
      a.stroke(stampDetail,[[-225,84],[-115,87],[-42,84]],3.2,undefined,6,ink,pencil);
      for(const [f,x,y,r,s] of [[0,730,-430,-.24,1.28],[8,650,-50,-.24,1.28],[13,610,290,-.24,1.28],[14,607,351,-.24,1.28],[17,607,351,-.24,1.28],[25,809,171,.05,1.0],[37,1020,620,.30,.85],[59,1020,620,.30,.85]])board.production.addLayerKeyframe(stamp.id,120+f!,{transform:{x:x!,y:y!,rotation:r!,scaleX:s!,scaleY:s!},easing:'ease-in-out'});
    }
    if(i===3){
      warehouse(a);const figure=person(a,125,296,1.72,'stand');
      a.move(figure.head,[[0,0,0],[12,0,0],[22,5,1,.075],[59,5,1,.075]]);
      for(const x of [458,726,1074])emptyMotor(a,x,510,1.45);
    }
    if(i===4){
      const crop=a.group('Report / cropped paper',-1,173);crop.set({transform:{x:-1,y:173,scaleX:1,scaleY:1,rotation:-.18}});
      document(a,50,0,408,565,undefined,crop.id,false);motor(a,255,207,1.49,undefined,9,crop.id);
      const rules=a.layer('Report / two lines',crop.id);a.stroke(rules,[[104,323],[355,322]],10);a.stroke(rules,[[109,370],[337,369]],10);
      const fragment=a.layer('Warehouse / right edge');a.stroke(fragment,[[781,84],[1059,30],[1309,5]],59);a.stroke(fragment,[[852,82],[848,299],[845,566]],17);a.stroke(fragment,[[636,583],[972,591],[1256,622]],13);
      const groundDetail=a.layer('Detail / empty warehouse ground gestures');
      a.stroke(groundDetail,[[824,594],[853,596],[883,598]],5,undefined,6,ink,charcoal);
      a.stroke(groundDetail,[[913,608],[1002,615],[1056,618]],2.5,undefined,6,ink,pencil);
      a.stroke(groundDetail,[[824,73],[873,63],[930,52]],3,undefined,6,paper,pastel);
      emptyMotor(a,1045,519,2.05);
      const link=a.layer('Red / interrupted connection');a.stroke(link,[[414,341],[475,354],[535,357]],11,6,12,red,dry);
      a.stroke(link,[[736,390],[828,444]],11,19,3,red,dry);
      const cross=a.layer('Red / two decisive X strokes');a.stroke(cross,[[600,279],[723,433]],28,24,4,red,dry);a.stroke(cross,[[735,272],[598,440]],28,30,4,red,dry);
    }
    if(i===5){
      person(a,248,128,2.53,'stand');
      const remnant=a.layer('Warehouse / cropped lower right');a.stroke(remnant,[[716,578],[1012,529],[1295,488]],28);a.stroke(remnant,[[776,576],[774,633]],13);a.stroke(remnant,[[1199,510],[1200,633]],13);a.stroke(remnant,[[463,647],[900,629],[1299,642]],13);
      const closingDetail=a.layer('Detail / closing roof and graphite ground');
      a.stroke(closingDetail,[[742,590],[826,576],[892,562]],2.3,undefined,6,ink,pencil);
      a.stroke(closingDetail,[[748,575],[799,567],[829,562]],2.5,undefined,6,paper,pastel);
      a.stroke(closingDetail,[[751,638],[778,640],[806,637]],4.7,undefined,6,ink,charcoal);
      a.stroke(closingDetail,[[951,645],[1057,651],[1148,649]],2.1,undefined,6,ink,pencil);
      const words=a.group('Closing / handwritten phrase',0,0);words.set({transform:{x:0,y:0,scaleX:1,scaleY:1,rotation:-.055}});
      a.text('Closing / line one','Di kertas,',620,262,'bold 58px "Segoe Print"',words.id);
      a.text('Closing / line two','semuanya ada.',634,345,'bold 58px "Segoe Print"',words.id);
      const underline=a.layer('Closing / red underline');a.stroke(underline,[[650,422],[826,370],[1176,321]],23,4,7,red,dry);
    }
  });
  board.transaction('Register brushes and provenance',()=>{
    for(const brush of [rough,dry,fine,stampInk,charcoal,pastel,pencil])board.production.createBrush(brush);
    board.setMetadata('fiction','Original fictional satire. No real office, official, case or loss figure.');
    board.setMetadata('artwork','Procedural editable brush strokes and text; no generated image or video.');
    board.setMetadata('sound','Original synthesized Foley, CC0-1.0; examples/lengkap/sound.ts.');
    board.setMetadata('fonts','Arial and Segoe Print; system fonts.');
  });
  return board;
}

export async function sheets(board:StoryboardProject){
  const session=createRenderSession(board),frames=[59,119,179,239,299,359];
  const c=new Canvas(1920,890),ctx=c.getContext('2d');ctx.fillStyle=paper;ctx.fillRect(0,0,c.width,c.height);
  ctx.fillStyle=ink;ctx.font='bold 38px Arial';ctx.fillText('LENGKAP',28,48);ctx.font='19px Arial';ctx.fillText('15 DETIK  /  6 SCENE',1610,44);
  const titles=['MENULIS','MEMENUHI LAPORAN','MENGESAHKAN','MEMERIKSA KENYATAAN','TIDAK TERHUBUNG','PENUTUP'];
  for(let i=0;i<6;i++){
    const x=24+(i%3)*632,y=80+Math.floor(i/3)*398;
    ctx.drawImage(session.frame(frames[i]!),x,y,608,342);
    ctx.strokeStyle='#d7cfbd';ctx.lineWidth=1;ctx.strokeRect(x,y,608,342);
    ctx.fillStyle=ink;ctx.font='17px Arial';ctx.fillText(`${String(i+1).padStart(2,'0')}  ${titles[i]}  /  ${(i*2.5).toFixed(1)}–${((i+1)*2.5).toFixed(1)}s`,x,y+370);
  }
  await writeFile(join(output,'lengkap-storyboard.png'),await c.toBuffer('png'));
  await writeFile(join(output,'lengkap-hero.png'),await session.frame(359).toBuffer('png'));
}

async function main(){
  await mkdir(output,{recursive:true});
  const board=author(),bytes=makeSound();await writeFile(join(output,'lengkap-foley.wav'),bytes);
  board.transaction('Place original Foley',()=>{
    const id=board.production.addAsset({id:'asset:foley',name:'Original pen, paper, stamp and room',kind:'audio',path:'lengkap-foley.wav',mimeType:'audio/wav',source:'managed',checksum:createHash('sha256').update(bytes).digest('hex')});
    const track=board.production.addAudioTrack('Foley / no voice or music');
    board.production.addAudioClip(track,{assetId:id,name:'LENGKAP / 15s mix',startFrame:0,sourceInFrame:0,durationFrames:360,volume:1,fadeInFrames:0,fadeOutFrames:0});
  });
  await board.save(join(output,'lengkap.cboard'),{overwrite:true});
  await sheets(board);console.log('Artwork and editable project saved.');
  if(process.argv.includes('--movie')){
    const stats=await exportMovie(board,join(output,'lengkap.mp4'),{onProgress:(n,total)=>{if(n%24===0)console.log(`Render ${n}/${total}`);}});
    await writeFile(join(output,'render-metrics.json'),JSON.stringify(stats,null,2));
  }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
