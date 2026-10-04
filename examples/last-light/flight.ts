import {flightLegRigs} from "./legs.js";
import type {PanelHandle,StoryboardProject} from "../../src/index.js";
import {contour,hatch,ink,insect,stroke} from "./art.js";
import {flightWingCycle} from "./wings.js";

export function flight(p:PanelHandle,board:StoryboardProject,start:number,duration:number){
  const sky=p.addVectorLayer("Flight / opening above the roofs",{depth:5});
  contour(sky,"M -100 -100 L 1380 -100 L 1380 820 L -100 820 Z","#394b4e");
  contour(sky,"M 218 -80 C 425 64 731 31 1013 -30 L 1280 89 C 1051 114 835 89 637 171 C 498 225 331 182 243 143 Z","#455756","#455756");
  contour(sky,"M 516 404 C 690 295 910 335 1290 222 L 1390 463 C 1045 426 822 513 611 558 Z","#324448","#324448");
  const far=p.addVectorLayer("Flight / distant chimney silhouettes",{depth:3});
  contour(far,"M 239 746 L 239 588 L 312 578 L 312 548 L 335 548 L 335 578 L 390 558 L 432 580 L 481 572 L 481 530 L 506 530 L 506 570 L 558 586 L 620 557 L 687 585 L 701 555 L 760 548 L 821 584 L 821 533 L 838 533 L 838 580 L 947 531 L 1038 570 L 1189 555 L 1280 603 L 1280 800 Z","#263639","#263639");
  for(const [x,y] of [[377,609],[495,626],[612,598],[717,588],[878,602],[955,568]]){
    stroke(far,[[x!,y!],[x!+21,y!-4],[x!+21,y!+35]],2,"#56645d");
  }
  const left=p.addVectorLayer("Flight / close tenement and rain gutter",{depth:.8});
  contour(left,"M -80 -80 L 325 -80 L 510 720 L -80 800 Z","#243235");
  contour(left,"M 253 -80 L 325 -80 L 510 720 L 431 746 Z","#111d22");
  contour(left,"M 212 -30 L 250 -39 L 427 727 L 389 737 Z","#3e4b48");
  for(let row=0;row<5;row++){
    const y=25+row*158,x=38+row*23;
    contour(left,`M ${x} ${y} L ${x+99} ${y-21} L ${x+125} ${y+89} L ${x+23} ${y+116} Z`,ink,"#778375",1.1);
    stroke(left,[[x+48,y-9],[x+73,y+102]],5,"#3e4b48");
    stroke(left,[[x+10,y+47],[x+110,y+23]],4,"#3e4b48");
    contour(left,`M ${x+17} ${y+116} L ${x+132} ${y+85} L ${x+139} ${y+96} L ${x+20} ${y+130} Z`,ink);
    stroke(left,[[x+20,y+117],[x+132,y+88]],1.5,"#8b9480");
    stroke(left,[[-30,y+143],[x+165,y+97],[x+181,y+112]],1.2,"#53635c");
  }
  stroke(left,[[285,-40],[317,109],[356,267],[391,425],[459,746]],10,ink);
  stroke(left,[[287,-40],[320,109],[359,267],[394,425],[462,746]],1.8,"#9da58c");
  for(let j=0;j<5;j++)stroke(left,[[301+j*32,44+j*143],[323+j*32,38+j*143]],4,"#7a8575");
  hatch(left,[[251,35],[273,30],[420,673],[398,681]],9,"#7b8371",-.7,.8);
  const right=p.addVectorLayer("Flight / opposite roof cornice",{depth:1.6});
  contour(right,"M 1121 -80 L 1380 -80 L 1380 820 L 1195 820 L 1022 126 Z","#293a3d");
  contour(right,"M 1022 126 L 1121 -80 L 1137 -80 L 1044 131 L 1219 820 L 1195 820 Z",ink);
  stroke(right,[[1051,153],[1115,77],[1264,22]],3,"#839080");
  for(let row=0;row<4;row++){
    const x=1081+row*36,y=184+row*153;
    contour(right,`M ${x} ${y} L ${x+110} ${y-51} L ${x+133} ${y+43} L ${x+22} ${y+98} Z`,ink,"#52665f",1.5);
    stroke(right,[[x+54,y-25],[x+78,y+70]],5,"#42544e");
    stroke(right,[[x+11,y+50],[x+122,y-2]],4,"#42544e");
    stroke(right,[[x+17,y+111],[x+142,y+50]],3,"#738271");
  }
  const wire=p.addVectorLayer("Flight / suspended telephone lines",{depth:1.2});
  for(const dy of [0,9])contour(wire,`M 293 ${60+dy} C 496 ${259+dy} 789 ${309+dy} 1044 ${131+dy}`,"transparent",ink,2);
  const bug=insect(p,560,493,1,true,true);
  bug.group.set({name:"Flight / banking firefly"});
  for(let f=0;f<duration;f++){
    const t=f/(duration-1),u=1-t;
    // A climbing arc opens away from the near wall, then turns toward the relay lamp.
    const x=u*u*u*560+3*u*u*t*594+3*u*t*t*682+t*t*t*865;
    const y=u*u*u*493+3*u*u*t*338+3*u*t*t*201+t*t*t*138;
    const scale=1-.52*t;
    board.production.addLayerKeyframe(bug.group.id,start+f,{transform:{x,y,scaleX:scale,scaleY:scale,rotation:-.18+.36*t},easing:"linear"});
  }
  flightWingCycle(p,board,bug.group.id,bug.wings.id,start,duration);
  flightLegRigs(p,board,bug.group.id,bug.body.id,start);
}
