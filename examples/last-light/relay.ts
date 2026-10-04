import {catmullRom,type PanelHandle,type StoryboardProject} from "../../src/index.js";
import {amber,contour,dry,hatch,ink,insect,paper,ring,stroke} from "./art.js";

export function relay(p:PanelHandle,board:StoryboardProject,start:number){
  const sky=p.addVectorLayer("Relay / rain sky",{depth:4});
  contour(sky,"M 0 0 L 1280 0 L 1280 720 L 0 720 Z","#3f4b49");
  contour(sky,"M 364 0 L 702 0 Q 659 142 741 208 L 904 269 L 792 330 C 698 256 574 250 530 153 Z","#526159","#526159");
  const facade=p.addVectorLayer("Relay / opposite tenement",{depth:2});
  contour(facade,"M 884 0 L 1280 0 L 1280 720 L 769 720 Z","#374642");
  contour(facade,"M 873 0 L 900 0 L 790 720 L 765 720 Z",ink);
  for(let row=0;row<4;row++)for(let col=0;col<3;col++){
    const x=905+col*136-row*24,y=43+row*163+col*21,w=67+col*12;
    const shape=`M ${x} ${y} L ${x+w} ${y+13} L ${x+w-13} ${y+112} L ${x-15} ${y+96} Z`;
    contour(facade,shape,ink,paper,1);
    stroke(facade,[[x-22,y+101],[x+w-8,y+119]],3,ink);
    const lit=p.addVectorLayer(`Relay / window ${row}:${col}`,{depth:2,opacity:0});
    contour(lit,shape,amber,ink,2);
    stroke(lit,[[x+w*.52,y+8],[x+w*.52-14,y+102]],3,ink);
    stroke(lit,[[x-7,y+50],[x+w-7,y+63]],2,ink);
    const at=start+22+col*6+row*4;
    board.production.addLayerKeyframe(lit.id,at,{opacity:0,easing:"hold"});
    board.production.addLayerKeyframe(lit.id,at+1,{opacity:1});
  }
  const wall=p.addVectorLayer("Relay / weathered stone pier",{depth:.8});
  contour(wall,"M 0 0 L 362 0 L 304 720 L 0 720 Z","#38433f");
  contour(wall,"M 304 0 L 362 0 L 304 720 L 249 720 Z",ink);
  hatch(wall,[[292,35],[324,23],[272,690],[246,710]],7,"#a2aa92",-.8,1.2);
  for(let i=0;i<8;i++){
    const y=35+i*91;
    stroke(wall,[[0,y],[139,y+17],[295-i*6,y+35]],2,"#899780");
    stroke(wall,[[i%2?85:220,y+22],[i%2?80:213,y+99]],2,ink);
  }
  const bracket=p.addVectorLayer("Relay / wrought iron bracket",{depth:.8});
  contour(bracket,"M 244 182 Q 267 154 285 181 L 273 411 Q 251 438 231 411 Z",ink,paper,1.3);
  ring(bracket,263,202,5,5,paper,1.2);ring(bracket,252,385,5,5,paper,1.2);
  contour(bracket,"M 269 228 C 354 169 430 151 505 174 C 577 195 612 215 651 229 L 648 243 C 585 231 550 211 496 195 C 423 175 353 198 267 244 Z",ink);
  contour(bracket,"M 258 358 C 330 395 380 319 427 271 C 473 223 530 218 571 241 C 608 262 576 306 550 286 C 532 272 546 253 563 264 C 540 239 500 243 455 282 C 400 331 350 414 257 376 Z",ink);
  stroke(bracket,[[279,230],[359,192],[431,176],[496,184],[563,209],[642,235]],2.3,paper);
  stroke(bracket,[[270,367],[321,380],[373,350],[422,297],[469,259]],1.6,"#9da68e");
  const glass=p.addVectorLayer("Relay / unlit glass",{depth:.8});
  const panes="M 528 313 L 645 336 L 762 306 L 730 530 L 642 564 L 554 540 Z";
  contour(glass,panes,"#738178",ink,3);
  contour(glass,"M 540 334 L 629 350 L 628 542 L 565 521 Z","#9b9f88","#9b9f88");
  const light=p.addVectorLayer("Relay / current enters glass",{depth:.8,opacity:0});
  contour(light,panes,amber,ink,3);
  contour(light,"M 543 337 L 628 351 L 627 538 L 569 518 Z","#f5d392","#f5d392");
  contour(light,"M 656 351 L 746 326 L 720 520 L 658 544 Z","#dc9f4c","#dc9f4c");
  contour(light,"M 630 479 C 616 440 633 392 641 371 C 650 406 672 447 655 484 Z","#fff2c7","#fff2c7");
  board.production.addLayerKeyframe(light.id,start+17,{opacity:0});
  board.production.addLayerKeyframe(light.id,start+21,{opacity:.65});
  board.production.addLayerKeyframe(light.id,start+24,{opacity:1});
  const frame=p.addVectorLayer("Relay / lamp casing and glass ribs",{depth:.8});
  contour(frame,"M 507 309 Q 558 285 619 273 L 632 258 L 662 255 L 675 270 Q 730 279 780 299 L 769 319 L 645 347 L 522 327 Z",ink);
  contour(frame,"M 544 306 Q 594 287 623 288 L 647 277 L 678 285 L 747 301 L 646 328 Z","#576459",ink,2);
  hatch(frame,[[548,306],[619,291],[644,301],[647,327]],6,"#a4ad96",-.9,1);
  stroke(frame,[[537,314],[645,336],[764,308]],3,paper);
  for(const points of [[[528,319],[551,541]],[[645,343],[642,562]],[[759,319],[730,531]]])stroke(frame,points,8,ink);
  stroke(frame,[[558,365],[572,448],[577,469]],3,"#d9ddc0");
  stroke(frame,[[712,356],[699,459]],1.8,"#d9ddc0");
  contour(frame,"M 547 532 L 642 557 L 734 523 L 728 549 L 642 587 L 556 554 Z",ink);
  contour(frame,"M 607 578 L 673 573 L 664 593 L 651 603 L 650 622 Q 641 639 633 621 L 630 603 L 615 595 Z",ink);
  stroke(frame,[[557,546],[641,571],[720,540]],2,paper);
  ring(frame,648,248,12,8,ink,3,"#9da38d");
  const wear=p.addRasterLayer("Relay / dry brush corrosion",{depth:.8});
  for(let i=0;i<4;i++)wear.rasterStroke(catmullRom([{x:286+i*7,y:442,pressure:.1},{x:271+i*7,y:524,pressure:.6},{x:260+i*7,y:634,pressure:.1}],9),{...dry,size:12},{color:"#919b86",seed:740+i});
  const bug=insect(p,845,121,.42,true,true);
  for(const [offset,x,y] of [[0,845,121],[8,747,171],[14,669,204],[17,648,215],[32,648,215],[43,688,172],[59,776,66]])
    board.production.addLayerKeyframe(bug.group.id,start+offset!,{transform:{x:x!,y:y!},easing:"ease-in-out"});
  for(let f=0;f<60;f+=3)board.production.addLayerKeyframe(bug.wings.id,start+f,{transform:{scaleY:f%6===0?1:.18},easing:"hold"});
}
