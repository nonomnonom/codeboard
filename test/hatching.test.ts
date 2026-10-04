import {expect,it} from 'vitest';
import {hatchPolygon} from '../src/index.js';

const rectangle=[{x:0,y:0},{x:80,y:0},{x:80,y:40},{x:0,y:40}];
it('generates bounded, evenly spaced pen paths with authored pressure and repeatable jitter',()=>{
 const paths=hatchPolygon(rectangle,{angle:0,spacing:10,pressure:.7,maxSamples:40});
 expect(paths).toHaveLength(4);
 expect(paths.map(path=>[path[0]!.x,path[0]!.y,path.at(-1)!.x,path.at(-1)!.y])).toEqual([[0,0,80,0],[0,10,80,10],[0,20,80,20],[0,30,80,30]]);
 expect(paths.every(path=>path.length===10&&path.every((point,i)=>point.pressure===.7&&point.time===i*8))).toBe(true);
 const settings={angle:.37,spacing:7,jitter:2,seed:31};
 expect(hatchPolygon(rectangle,settings)).toEqual(hatchPolygon(rectangle,settings));
 expect(()=>hatchPolygon(rectangle,{angle:0,spacing:10,maxSamples:39})).toThrow(/samples exceed/);
 expect(hatchPolygon(rectangle,{angle:0,spacing:10,maxSamples:40})).toEqual(paths.map(path=>path.map(point=>({...point,pressure:.5}))));
});

it('rejects excessive scan work, allocations, nonfinite inputs and numerically stagnant spacing',()=>{
 expect(()=>hatchPolygon(rectangle,{spacing:1e-20})).toThrow(/scan rows/);
 const distant=rectangle.map(p=>({x:p.x,y:p.y+1e16}));
 expect(()=>hatchPolygon(distant,{angle:0,spacing:.1})).toThrow(/coordinate precision/);
 expect(()=>hatchPolygon([{x:-1e308,y:0},{x:1e308,y:0},{x:0,y:10}],{angle:0})).toThrow(/samples exceed/);
 for(const options of [{angle:NaN},{pressure:2},{jitter:-1},{seed:Infinity},{maxSamples:1}])expect(()=>hatchPolygon(rectangle,options)).toThrow();
 expect(()=>hatchPolygon([{x:Infinity,y:0},...rectangle])).toThrow(/finite/);
});
