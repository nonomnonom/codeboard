import { brushes, customizeBrush, brushTipFromFunction, catmullRom, ellipse, pathCommands, type Point, type LayerHandle, type PanelHandle, type StoryboardProject } from 'codeboard-studio';

export const paper='#f3eddf', ink='#191916', red='#b73824';
const grain=Array.from({length:128*128},(_,i)=>{
  const x=i%128,y=Math.floor(i/128);
  let h=Math.imul(x+19,374761393)^Math.imul(y+71,668265263);h=Math.imul(h^(h>>>13),1274126177);
  const n=((h^(h>>>16))>>>0)/4294967296;
  const patch=(Math.sin(x*.37+y*.15)+Math.sin(x*.11-y*.41)+2)/4;
  return n>.91&&patch>.44?.06:n>.72?.76:1;
});
export const rough=customizeBrush(brushes.cleanInk,{
  id:'brush:rough-ink',name:'Rough ink / broken perimeter',hardness:1,spacing:.055,flow:1,
  taperStart:.04,taperEnd:.10,texture:'dry-brush',textureStrength:.04,
  paperTexture:{width:128,height:128,alpha:grain,scale:.55,strength:.15},
  tip:brushTipFromFunction(96,96,(x,y)=>{
    const a=Math.atan2(y,x),r=Math.hypot(x,y);
    const edge=.92+.027*Math.sin(a*17)+.018*Math.cos(a*29);
    return r<edge?(r>.79&&Math.sin(x*81+y*137)>.77?.25:1):0;
  }),dynamics:{pressureSize:.85,pressureOpacity:0,speedSize:0,rotationJitter:0},
});
export const dry=customizeBrush(rough,{
  id:'brush:dry-ink',name:'Dry ink / broken broad sweep',spacing:.045,taperStart:.025,taperEnd:.09,textureStrength:.12,
  tip:brushTipFromFunction(96,96,(x,y)=>{
    const edge=.57+.18*Math.sin(y*39)+.11*Math.cos(y*87);
    if(Math.abs(x)>edge||Math.abs(y)>.92)return 0;
    for(const [center,width] of [[-.84,.028],[-.69,.025],[.61,.022],[.81,.034]])if(Math.abs(y-center!)<width!)return 0;
    return 1;
  }),
});
export const fine=customizeBrush(brushes.cleanInk,{
  id:'brush:pen',name:'Pena / firm pressure line',spacing:.065,taperStart:.035,taperEnd:.10,
  hardness:1,flow:1,dynamics:{pressureSize:1,pressureOpacity:.12,speedSize:0},
});
const speck=(x:number,y:number)=>{
  let h=Math.imul(x+131,374761393)^Math.imul(y+317,668265263);
  h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;
};
const tooth=Array.from({length:128*128},(_,i)=>{
  const x=i%128,y=Math.floor(i/128),gx=Math.floor(x/8),gy=Math.floor(y/8);
  const u=(x%8)/8,v=(y%8)/8,s=u*u*(3-2*u),t=v*v*(3-2*v);
  const top=speck(gx,gy)*(1-s)+speck((gx+1)%16,gy)*s;
  const bottom=speck(gx,(gy+1)%16)*(1-s)+speck((gx+1)%16,(gy+1)%16)*s;
  const n=speck(x+1000,y+1000),clump=top*(1-t)+bottom*t;
  return n>.985?.22:Math.min(1,.65+clump*.12+n*.20);
});
export const charcoal=customizeBrush(rough,{
  id:'brush:charcoal-mass',name:'Arang / compressed dark mass',texture:'charcoal',textureStrength:.32,
  paperTexture:{width:128,height:128,alpha:tooth,scale:.62,strength:.67},
  spacing:.075,taperStart:.025,taperEnd:.06,hardness:.96,
  dynamics:{pressureSize:.72,pressureOpacity:.10,rotationJitter:.025},
});
export const pastel=customizeBrush(rough,{
  id:'brush:soft-pastel',name:'Pastel / broad powder edge',texture:'charcoal',textureStrength:.17,
  opacity:.90,flow:.45,hardness:.86,spacing:.09,taperStart:.025,taperEnd:.07,
  paperTexture:{width:128,height:128,alpha:tooth,scale:.39,strength:.86},
  tip:brushTipFromFunction(96,96,(x,y)=>{
    const edge=.79+.07*Math.sin(y*21)+.045*Math.sin(y*57);
    return Math.abs(x)<edge&&Math.abs(y)<.86?Math.min(1,(.89-Math.abs(y))*12):0;
  }),dynamics:{pressureSize:.42,pressureOpacity:.25,rotationJitter:.02},
});
export const pencil=customizeBrush(brushes.roughPencil,{
  id:'brush:graphite-pencil',name:'Pensil / searching graphite line',hardness:.88,opacity:.73,flow:.52,
  spacing:.10,taperStart:.045,taperEnd:.14,
  paperTexture:{width:128,height:128,alpha:tooth,scale:.32,strength:.62},
  dynamics:{pressureSize:.80,pressureOpacity:.40,speedSize:0,speedOpacity:0},
});
export const stampInk=customizeBrush(rough,{
  id:'brush:stamp-ink',name:'Stamp / porous impression',taperStart:.025,taperEnd:.045,
  paperTexture:{width:128,height:128,alpha:grain,scale:.65,strength:.78},
});

type XY=readonly [number,number];
export class Art {
  readonly root:LayerHandle;
  readonly board:StoryboardProject;
  readonly panel:PanelHandle;
  readonly start:number;
  constructor(board:StoryboardProject,panel:PanelHandle,start:number){
    this.board=board;this.panel=panel;this.start=start;
    this.root=panel.addGroup('Artwork / 1280 × 720 design coordinates',{transform:{scaleX:1.5,scaleY:1.5}});
  }
  layer(name:string,parent=this.root.id){return this.panel.addRasterLayer(name,{},parent);}
  text(name:string,value:string,x:number,y:number,font:string,parent=this.root.id,color=ink){
    const l=this.panel.addVectorLayer(name,{},parent);l.text(value,x,y,{font,color});return l;
  }
  group(name:string,x=0,y=0,s=1,parent=this.root.id){return this.panel.addGroup(name,{transform:{x,y,scaleX:s,scaleY:s}},parent);}
  stroke(l:LayerHandle,xy:readonly XY[],size:number,at?:number,duration=6,color=ink,br=dry){
    const phase=xy[0]![0]*.13+xy[0]![1]*.07;
    const center=catmullRom(xy.map(([x,y])=>({x,y})),24);
    const points=center.map((p,i)=>{
      const t=i/(center.length-1),prev=center[Math.max(0,i-1)]!,next=center[Math.min(center.length-1,i+1)]!;
      const angle=Math.atan2(next.y-prev.y,next.x-prev.x);
      const wobble=Math.sin(Math.PI*t)*(Math.sin(t*19+phase)*.6+Math.sin(t*47+phase)*.22)*Math.min(2.5,size*.045);
      return {...p,x:p.x-Math.sin(angle)*wobble,y:p.y+Math.cos(angle)*wobble,
        pressure:.77+.13*Math.sin(t*7+phase)+.055*Math.sin(t*23+phase),time:i*8};
    });
    const brush=br===dry&&size<20?fine:br;
    const result=this.points(l,points,size,at,duration,color,brush);
    if(br===dry&&size>=23){
      // Broken edge passes share the primary stroke's reveal interval and stay fixed afterward.
      for(const [j,side] of [-.42,.39,-.30].entries()){
        const start=[.10,.31,.59][j]!,end=[.46,.91,.97][j]!;
        const strand=points.map((p,i)=>{
          const prev=points[Math.max(0,i-1)]!,next=points[Math.min(points.length-1,i+1)]!,angle=Math.atan2(next.y-prev.y,next.x-prev.x);
          const offset=size*side*(p.pressure??1)+Math.sin(i*.37+phase)*size*.017;
          return {...p,x:p.x-Math.sin(angle)*offset,y:p.y+Math.cos(angle)*offset,pressure:.4+.4*Math.sin(Math.PI*i/(points.length-1))};
        }).slice(Math.floor(start*points.length),Math.ceil(end*points.length));
        const begin=at===undefined?undefined:at+Math.floor(duration*start);
        this.points(l,strand,Math.max(.9,size*.022),begin,Math.max(1,Math.ceil(duration*(end-start))),color,fine);
      }
    }
    return result;
  }
  points(l:LayerHandle,points:Point[],size:number,at?:number,duration=6,color=ink,br=rough){
    return l.rasterStroke(points,{...br,size},{color,seed:37,...(at===undefined?{}:{reveal:{startFrame:this.start+at,endFrame:this.start+at+duration}})});
  }
  corners(l:LayerHandle,xy:readonly XY[],size:number,at?:number,duration=6,color=ink,br=rough){
    return this.points(l,xy.map(([x,y],i)=>({x,y,pressure:1,time:i*80})),size,at,duration,color,br);
  }
  appear(l:LayerHandle,at:number,end=60){this.board.production.setExposure(l.id,{startFrame:this.start+at,endFrame:this.start+end});}
  move(l:LayerHandle,keys:readonly (readonly [number,number,number,number?])[]){
    for(const [at,x,y,rotation] of keys)this.board.production.addLayerKeyframe(l.id,this.start+at,{transform:{x,y,rotation:rotation??0},easing:'ease-in-out'});
  }
}

export function document(a:Art,x:number,y:number,w:number,h:number,at?:number,parent=a.root.id,heading=true){
  const l=a.layer('Report / paper perimeter',parent);
  a.stroke(l,[[x-4,y+h+5],[x-10,y+h*.52],[x+1,y+6]],13,at,7);
  a.stroke(l,[[x+7,y],[x+w*.45,y-7],[x+w+2,y-3]],11,at===undefined?undefined:at+4,5);
  a.stroke(l,[[x+w+1,y+2],[x+w+7,y+h*.55],[x+w+3,y+h]],12,at===undefined?undefined:at+6,8);
  a.stroke(l,[[x+w+2,y+h],[x+w*.52,y+h+3],[x-3,y+h-2]],10,at===undefined?undefined:at+11,4);
  a.stroke(l,[[x-15,y+h*.84],[x-19,y+h*.47],[x-12,y+34]],3.4,at===undefined?undefined:at+4,9,ink,pencil);
  const finish=a.layer('Detail / paper corners and graphite edge',parent);
  const f=at===undefined?undefined:at+12;
  a.stroke(finish,[[x-16,y+75],[x-17,y+12],[x+18,y-10],[x+83,y-13]],2.4,f,5,ink,pencil);
  a.stroke(finish,[[x+w+13,y+h-104],[x+w+15,y+h+8],[x+w-51,y+h+12]],2.7,f,6,ink,pencil);
  a.stroke(finish,[[x+w+2,y+43],[x+w+5,y+89],[x+w+6,y+138]],5.5,f,5,ink,charcoal);
  a.stroke(finish,[[x+23,y-2],[x+54,y-3],[x+103,y-5]],3.5,f,4,paper,pastel);
  a.stroke(finish,[[x+w+5,y+h-54],[x+w+4,y+h-19]],3.6,f,5,paper,pastel);
  if(heading){const label=a.text('Report / LAPORAN','LAPORAN',x+45,y+96,'bold 39px "Segoe Print"',parent);
    if(at!==undefined)a.appear(label,at+10);}
  return l;
}

export function person(a:Art,x:number,y:number,s:number,pose:'write'|'stand',at?:number){
  const g=a.group(`Figure / ${pose}`,x,y,s);
  const bodyMask=a.panel.addVectorLayer('Figure / editable body boundary',{visible:false},g.id);
  bodyMask.path(pathCommands(pose==='write'
    ?'M -22 82 C -47 103 -91 142 -118 201 Q -128 222 -145 265 Q -59 264 -4 247 C 7 212 32 181 40 153 Q 37 117 18 93 Z'
    :'M -22 82 C -44 99 -94 140 -121 199 L -157 306 L 88 306 C 80 231 52 151 18 98 Z'),{fill:ink});
  const body=a.layer('Figure / overlapping torso sweeps',g.id);body.set({maskLayerId:bodyMask.id});
  a.stroke(body,[[1,102],[-59,175],[-110,278]],143,at===undefined?undefined:at+5,11,ink,dry);
  a.stroke(body,[[14,129],[-4,194],[24,285]],124,at===undefined?undefined:at+9,10,ink,dry);
  const rim=a.layer('Figure / dry outer gestures',g.id);
  a.stroke(rim,[[-19,92],[-65,142],[-101,190],[-141,265]],7,at===undefined?undefined:at+8,10);
  a.stroke(rim,[[-24,96],[-81,151],[-124,229]],4.3,at===undefined?undefined:at+8,10,ink,pencil);
  a.stroke(rim,[[-34,117],[-53,143],[-76,174],[-90,197]],1.8,at===undefined?undefined:at+12,7,paper,fine);
  a.stroke(rim,[[-97,209],[-107,229],[-116,245]],2.6,at===undefined?undefined:at+16,5,paper,fine);
  const head=a.group('Figure / faceless oval',0,0,1,g.id);
  const headMask=a.panel.addVectorLayer('Head / editable oval boundary',{visible:false},head.id);
  headMask.path(pathCommands('M -24 91 C -43 71 -47 39 -32 14 C -18 -9 8 -17 29 -8 C 54 2 61 26 54 50 C 48 73 27 98 3 102 Q -15 106 -24 91 Z'),{fill:ink});
  const face=a.layer('Head / two broad ink sweeps',head.id);face.set({maskLayerId:headMask.id});
  a.stroke(face,[[16,-10],[2,48],[-12,100]],104,at,8,ink,dry);
  a.stroke(face,[[28,-7],[28,43],[6,91]],73,at===undefined?undefined:at+3,7,ink,dry);
  const edge=a.layer('Head / rough perimeter',head.id);
  a.stroke(edge,[[-21,91],[-42,49],[-32,14],[-10,-7],[20,-12],[47,5],[59,33],[49,66],[6,105]],4,at,9,ink,pencil);
  a.stroke(edge,[[-35,12],[-18,-7],[17,-17],[40,-7]],3,at,9,ink,pencil);
  const arm=a.layer('Figure / arm gesture',g.id);
  if(pose==='write'){
    a.stroke(arm,[[24,129],[49,177],[90,235]],48,at===undefined?undefined:at+12,7,ink,dry);
    a.stroke(arm,[[84,234],[142,230],[199,216]],39,at===undefined?undefined:at+17,7,ink,dry);
    a.stroke(arm,[[193,217],[208,211]],29,at===undefined?undefined:at+19,3,ink,rough);
  } else a.stroke(arm,[[24,132],[77,205],[119,293]],29,at,12,ink,dry);
  const finish=a.layer('Detail / charcoal shoulder and broken pastel drag',g.id);
  const f=at===undefined?undefined:at+21;
  a.stroke(finish,[[-41,110],[-74,143],[-104,185]],7,f,6,ink,charcoal);
  a.stroke(finish,[[-66,137],[-96,175],[-121,214]],2.2,f,6,ink,pencil);
  a.stroke(finish,[[-48,136],[-61,153],[-70,169]],3.6,f,5,paper,pastel);
  a.stroke(finish,[[-80,180],[-89,193]],4.4,f,4,paper,pastel);
  a.stroke(finish,[[-109,239],[-116,255],[-123,266]],1.8,f,6,paper,pencil);
  const headFinish=a.layer('Detail / graphite searching head contour',head.id);
  a.stroke(headFinish,[[-42,48],[-44,24],[-29,0],[-8,-14]],2.7,at===undefined?undefined:at+10,6,ink,pencil);
  a.stroke(headFinish,[[51,12],[57,28],[54,45]],4.0,at===undefined?undefined:at+11,5,ink,charcoal);
  a.stroke(headFinish,[[-18,0],[-5,-5],[11,-6],[26,0]],2.6,at===undefined?undefined:at+12,5,paper,pastel);
  a.stroke(headFinish,[[49,51],[41,70],[30,82]],1.7,at===undefined?undefined:at+13,5,paper,pencil);
  if(pose==='write'){
    a.stroke(arm,[[44,164],[62,197],[81,223]],2.4,at===undefined?undefined:at+24,5,paper,pastel);
    a.stroke(arm,[[106,241],[148,238],[176,230]],2.6,at===undefined?undefined:at+25,5,ink,pencil);
  }
  return {g,head,arm};
}

const motorPaths: {xy:XY[];size:number}[]=[
  {xy:[[-62,-30],[-23,-30]],size:15},
  {xy:[[-53,-18],[-24,-18],[-29,0],[15,0],[30,-37],[47,-10]],size:22},
  {xy:[[46,1],[33,-31],[24,-62],[8,-62]],size:10},
  {xy:[[8,-53],[30,-56]],size:10},
];
export function motor(a:Art,x:number,y:number,s:number,at?:number,span=9,parent=a.root.id){
  const g=a.group('Motor / consistent report pictogram',x,y,s,parent);
  const l=a.layer('Motor / two wheels and three gestures',g.id);
  for(const [i,cx] of [-55,48].entries()){
    const wheel=ellipse(cx,6,20,20,{samples:64}).map((p,j)=>({...p,x:p.x+Math.sin(j*.30)*1.1,y:p.y+Math.sin(j*.42)*.8,pressure:.87+.12*Math.sin(j*.15)}));
    a.points(l,wheel,15,at===undefined?undefined:at+i*2,Math.max(3,span-4),ink,{...rough,taperStart:0,taperEnd:0});
    a.points(l,ellipse(cx,6,24,23,{samples:64}),2,at===undefined?undefined:at+i*2,Math.max(3,span-4),ink,dry);
  }
  for(const [i,p] of motorPaths.entries())a.stroke(l,p.xy,p.size,at===undefined?undefined:at+2+i,Math.max(3,span-4),ink,dry);
  const finish=a.layer('Detail / pictogram seat drag and wheel gestures',g.id);
  const f=at===undefined?undefined:at+span-3;
  a.stroke(finish,[[-64,-34],[-46,-35],[-26,-34]],2.4,f,3,paper,pastel);
  a.stroke(finish,[[-27,7],[-7,9],[12,7]],2.2,f,3,paper,pencil);
  a.stroke(finish,[[-79,4],[-74,19],[-60,30],[-44,29]],2.1,f,3,ink,pencil);
  a.stroke(finish,[[28,21],[39,31],[54,32],[68,20]],2.3,f,3,ink,pencil);
  a.stroke(finish,[[25,-43],[30,-28],[34,-19]],1.7,f,3,paper,fine);
  return g;
}

function dashed(a:Art,l:LayerHandle,points:Point[],width:number){
  let distance=0,segment:Point[]=[];
  for(let i=0;i<points.length;i++){
    const p=points[i]!;if(i)distance+=Math.hypot(p.x-points[i-1]!.x,p.y-points[i-1]!.y);
    if(distance%23<12)segment.push(p);
    else if(segment.length){if(segment.length>1)a.points(l,segment,width);segment=[];}
  }
  if(segment.length>1)a.points(l,segment,width);
}
export function emptyMotor(a:Art,x:number,y:number,s=1,parent=a.root.id){
  const g=a.group('Unfilled place / dashed motor outline',x,y,s,parent),l=a.layer('Empty contour / no solid vehicle',g.id);
  const outline:XY[]=[[-80,0],[-69,-30],[-27,-32],[-14,-21],[7,-23],[15,-42],[10,-59],[8,-66],[24,-72],[32,-59],[26,-51],[36,-35],[61,-20],[78,2],[77,26],[62,37],[44,32],[37,22],[-23,22],[-34,36],[-55,38],[-76,27],[-80,0]];
  dashed(a,l,catmullRom(outline.map(([x,y])=>({x,y})),12),4.5);
  return g;
}

export function warehouse(a:Art,parent=a.root.id){
  const l=a.layer('Warehouse / roof, two posts, floor',parent);
  a.stroke(l,[[224,183],[665,62],[1304,-17]],87);
  a.stroke(l,[[227,207],[660,96],[1253,8]],15);
  a.stroke(l,[[263,183],[330,165],[428,139],[502,119]],2.4,undefined,6,paper,fine);
  a.stroke(l,[[574,94],[647,74],[731,61]],3.0,undefined,6,paper,fine);
  a.stroke(l,[[386,130],[460,109],[491,103]],1.4,undefined,6,paper,fine);
  a.stroke(l,[[329,177],[327,371],[330,567]],18);
  a.stroke(l,[[910,145],[909,368],[911,565]],16);
  a.stroke(l,[[206,565],[660,567],[1260,576]],11);
  const finish=a.layer('Detail / warehouse joints and broken ground',parent);
  a.stroke(finish,[[236,218],[361,185],[458,162]],3.5,undefined,6,ink,pencil);
  a.stroke(finish,[[288,159],[404,128],[498,103]],6,undefined,6,ink,charcoal);
  a.stroke(finish,[[321,190],[321,234],[323,259]],4,undefined,6,paper,pastel);
  a.stroke(finish,[[312,571],[336,573],[363,570]],5.5,undefined,6,ink,dry);
  a.stroke(finish,[[887,571],[910,575],[948,574]],5,undefined,6,ink,charcoal);
  a.stroke(finish,[[232,579],[366,581],[408,579]],2.1,undefined,6,ink,pencil);
  a.stroke(finish,[[1067,583],[1151,587],[1244,586]],2.2,undefined,6,ink,pencil);
  return l;
}

const letters:Record<string,XY[][]>={
  L:[[[0,0],[0,80],[43,80]]], E:[[[46,0],[0,0],[0,80],[48,80]],[[0,38],[36,38]]],
  N:[[[0,80],[0,0],[48,80],[48,0]]], G:[[[48,10],[29,1],[8,12],[2,42],[10,72],[31,79],[47,68],[47,44],[28,44]]],
  K:[[[0,0],[0,80]],[[46,0],[0,42],[48,80]]], A:[[[0,80],[24,0],[49,80]],[[10,53],[38,53]]],
  P:[[[1,80],[0,0]],[[0,2],[29,1],[46,12],[47,25],[34,38],[1,39]]],
};
export function stampPrint(a:Art,parent:string){
  const l=a.layer('LENGKAP / rough red impression',parent);
  a.stroke(l,[[-280,-90],[-8,-94],[277,-90]],13,undefined,1,red,stampInk);
  a.stroke(l,[[273,-96],[278,5],[275,94]],12,undefined,1,red,stampInk);
  a.stroke(l,[[279,94],[-1,89],[-278,94]],14,undefined,1,red,stampInk);
  a.stroke(l,[[-277,95],[-281,2],[-274,-95]],12,undefined,1,red,stampInk);
  a.stroke(l,[[-271,-82],[-269,2],[-269,81]],3,undefined,1,red);
  a.stroke(l,[[-263,-101],[-178,-103],[-141,-101]],2.8,undefined,1,red,pencil);
  a.stroke(l,[[129,103],[216,105],[274,102]],3.0,undefined,1,red,pastel);
  a.stroke(l,[[-185,-91],[-169,-92]],3.5,undefined,1,paper,pastel);
  a.stroke(l,[[277,41],[277,56]],3,undefined,1,paper,pastel);
  let x=-233;
  for(const ch of 'LENGKAP'){
    for(const path of letters[ch]!){
      const coords=path.map(([px,py])=>[px+x+py*.06,py-40+Math.sin(x)*3] as XY);
      if(ch==='G'||ch==='P')a.stroke(l,coords,16,undefined,1,red,stampInk);
      else a.corners(l,coords,14,undefined,1,red,stampInk);
    }
    x+=69;
  }
  return l;
}
