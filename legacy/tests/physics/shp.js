const fs=require('fs'),vm=require('vm');
const c=vm.createContext({console,Math,Date});vm.runInContext(fs.readFileSync(__dirname+'/.cache/eng.js','utf8')+';this.A={makeHole,geom,landFrom,clamp,setH:h=>{H=h},CLUBS,SPIN,SHAPE,FRM,YD};',c);const A=c.A;
const h=A.makeHole('2026-02-05');A.setH(h);
const out=[];
for(const ci of [0,3,6,9]){const k=A.CLUBS[ci];const dist=k.y*.9/A.YD; // aim 90% of carry, in metres
 const aim={x:h.P.x,z:h.P.z-dist};
 for(const sh of [0,1,2,3,4]){const sel={club:ci,spin:1,shape:sh,hand:'R'};const g=A.geom(sel,aim);const L=A.landFrom(g,aim,0,0);const apexK=[.8,1,1.25][1]*(1+.08*A.SHAPE[sh].s),bulge=-Math.sign(g.curve)*Math.min(12,.35*Math.abs(g.curve)),kc=A.clamp(g.carry*A.YD/k.y,.45,1),fp={bulge,H:k.h/A.YD*Math.pow(kc,.7)*apexK};
  const s=A.SHAPE[sh].s,af0=5.5/10;
  const rollStd=Math.pow(k.rel*(1-.12*s),2)/(2*af0)*3.28084;
  const rollHi=((k=>{const v=(k.rel*.45-k.back)*(1-.12*s);return Math.sign(v)*v*v/(2*af0)*3.28084})(k));
  const lat=Math.pow(.35*s,2)/(2*af0)*3.28084*Math.sign(s);
  out.push([k.n,A.SHAPE[sh].n,'curve(yd)',(Math.abs(g.curve)*A.YD).toFixed(1),'peak off-line m/ft',Math.abs(fp.bulge).toFixed(1)+'/'+(Math.abs(fp.bulge)*3.28).toFixed(0),'apex yd',(fp.H*A.YD).toFixed(0),'roll std ft',rollStd.toFixed(0),'hi-spin ft',rollHi.toFixed(0),'side-kick ft',lat.toFixed(1)].join(' '));}}
console.log(out.join('\n'));
