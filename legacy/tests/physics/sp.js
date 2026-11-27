const fs=require('fs'),vm=require('vm');
function load(f){const c=vm.createContext({console,Math,Date});vm.runInContext(fs.readFileSync(__dirname+'/.cache/'+f,'utf8')+';this.API={makeHole,analyze,setH:h=>{H=h;},getH:()=>H,NEU,SHAPE,SPIN,CLUBS};',c);return c.API;}
const A=load('eng.js'),B=load('eng_plain.js');
let n=0,gain=[],nonstd=0,big=0;
for(let d=0;d<40;d++){const ds=new Date(Date.UTC(2026,2,1)+d*864e5*7).toISOString().slice(0,10);
 A.setH(A.makeHole(ds));B.setH(B.makeHole(ds));const H=A.getH();
 const run=(X)=>{const g=X.analyze({club:3,spin:1,shape:X.NEU},{x:H.pin.x,z:H.pin.z});let r;while(!(r=g.next()).done);return r.value;};
 const a=run(A),b=run(B);const gn=Math.max(0,b.pro.ev2-a.pro.ev2);gain.push(gn);n++;
 if(a.best.sel.spin!==1||a.best.sel.shape!==A.NEU)nonstd++;if(gn>.1)big++;}
gain.sort((x,y)=>x-y);const m=gain.reduce((s,x)=>s+x,0)/n;
console.log('holes',n,'best shot uses non-standard spin or shape on',nonstd,'| avg strokes saved vs plain-only best',m.toFixed(3),'| median',gain[Math.floor(n/2)].toFixed(3),'| >0.1 on',big,'holes | max',gain[n-1].toFixed(2));
