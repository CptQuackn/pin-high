const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync(__dirname+'/.cache/eng.js','utf8')+`
;globalThis.API={makeHole,analyze,evChoice,geom,Z0,CLUBS,SPIN,SHAPE,setH:h=>{H=h;},getH:()=>H,mulberry32,clamp,YD};`;
vm.runInThisContext(src);
const A=API,rows=[];
const days=[];for(let d=1;d<=24;d++)days.push('2026-02-'+String(d).padStart(2,'0'));
for(const ds of days){
  A.setH(A.makeHole(ds));
  const H=A.getH();
  // probe pro (analyze at a dummy shot)
  const g=A.analyze({club:2,spin:1,shape:2},{x:H.pin.x,z:H.pin.z});let r;while(!(r=g.next()).done);
  const pro=r.value.pro.ev2;
  const rnd=A.mulberry32(7);
  // "typical player": aims within 0..9 m of pin, picks a club that reaches comfortably, random spin/shape sometimes
  for(let k=0;k<14;k++){
    const rr=Math.pow(rnd(),1.3)*9,th=rnd()*6.28,aim={x:H.pin.x+Math.cos(th)*rr,z:H.pin.z+Math.sin(th)*rr};
    if(!H.inIsland(aim.x,aim.z)&&rnd()<.7)continue;
    let ok=null;for(let c=0;c<A.CLUBS.length;c++){const s={club:c,spin:rnd()<.6?1:Math.floor(rnd()*3),shape:rnd()<.5?2:Math.floor(rnd()*5)};const gg=A.geom(s,aim);if(gg.swing>=.72&&gg.swing<=1.02){ok=s;break;}}
    if(!ok)continue;
    const ev=A.evChoice(ok,aim,A.Z0);rows.push({ds,cost:Math.max(0,ev-pro),pro});
  }
}
rows.sort((a,b)=>a.cost-b.cost);const q=p=>rows[Math.floor(p*(rows.length-1))].cost.toFixed(2);
console.log('n',rows.length,'pro mean',(rows.reduce((s,r)=>s+r.pro,0)/rows.length).toFixed(2));
console.log('cost quantiles 5/10/25/50/75/90/95:',[.05,.1,.25,.5,.75,.9,.95].map(q).join(' '));
console.log('share cost>=1.5:',(rows.filter(r=>r.cost>=1.5).length/rows.length).toFixed(2),' <0.1:',(rows.filter(r=>r.cost<.1).length/rows.length).toFixed(2));
