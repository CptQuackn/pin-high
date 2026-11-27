const fs=require('fs'),vm=require('vm');
vm.runInThisContext(fs.readFileSync(__dirname+'/.cache/eng.js','utf8')+`;globalThis.API={makeHole,geom,CLUBS,setH:h=>{H=h;},getH:()=>H,outcomeAt,landFrom,NEU,YD,mulberry32};`);
let n=0,holed=0,over=0,edge=0,sp=[],hs=[];const r=API.mulberry32(3);
for(let d=1;d<=28;d++){API.setH(API.makeHole('2026-05-'+String(d).padStart(2,'0')));const H=API.getH();
 for(let k=0;k<20;k++){
  const ang=r()*6.283,rr=r()*7,aim={x:H.pin.x+Math.cos(ang)*rr,z:H.pin.z+Math.sin(ang)*rr};if(!H.inIsland(aim.x,aim.z))continue;
  const need=API.geom({club:0,spin:1,shape:API.NEU},aim).dist*API.YD;let bi=0,bd=1e9;API.CLUBS.forEach((c,i)=>{const e=Math.abs(need/c.y-.95);if(e<bd){bd=e;bi=i;}});
  const sel={club:bi,spin:1,shape:API.NEU,hand:'R'},g=API.geom(sel,aim),L=API.landFrom(g,aim,0,0),o=API.outcomeAt(sel,L,null);
  n++;if(o.s==='holed')holed++;else if(o.near){if(o.near.d<.09){over++;sp.push(o.near.v)}else{edge++;}}}}
console.log('shots',n,'holed',holed,'rolled over',over,'caught edge',edge,'pass speed m/s (over): avg',(sp.reduce((a,b)=>a+b,0)/(sp.length||1)).toFixed(2),'min',Math.min(...sp).toFixed(2));
