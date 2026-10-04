import { encodeWav } from '../../src/index.js';

/** Original deterministic Foley synthesis, CC0. No recordings, speech or music. */
export function makeSound(){
  const rate=48000,data=new Float32Array(15*rate);let state=741;
  const noise=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/2147483648-1;};
  function scratch(start:number,duration:number,gain=.085){
    let previous=0;
    for(let i=0;i<duration*rate;i++){
      const t=i/rate,n=noise(),env=Math.min(1,t/.015,(duration-t)/.02);
      data[Math.floor(start*rate)+i]!+=gain*env*(n-previous*.75)*(.65+.35*Math.sin(t*91)**2);previous=n;
    }
  }
  for(const [start,duration] of [[.10,.34],[.38,.48],[.85,.5],[1.45,.25],[1.84,.28],[2.52,.26],[2.84,.24],[3.15,.23],[3.46,.23],[3.77,.23],[4.12,.48]])scratch(start!,duration!);
  function tap(start:number,gain:number){
    for(let i=0;i<rate*.18;i++){
      const t=i/rate;data[Math.floor(start*rate)+i]!+=gain*(Math.sin(2*Math.PI*155*t)*Math.exp(-t*42)+noise()*.55*Math.exp(-t*115));
    }
  }
  tap(2.19,.12);tap(134/24,.6);
  scratch(5.12,.20,.045);scratch(6.12,.12,.035);
  scratch(10.25,.48,.10);scratch(11,.16,.13);scratch(11.23,.18,.13);scratch(12.68,.25,.075);
  let room=0;
  for(let i=0;i<data.length;i++){
    room=room*.992+noise()*.008;
    const t=i/rate;data[i]!+=room*(t>=7.5&&t<12.5?.015:.004)*Math.min(1,(15-t)*2);
  }
  return encodeWav([data],rate);
}
