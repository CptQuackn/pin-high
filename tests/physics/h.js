const fs=require('fs'),vm=require('vm');
vm.runInThisContext(fs.readFileSync(__dirname+'/.cache/eng.js','utf8')+`;globalThis.API={makeHole,analyze,setH:h=>{H=h;},getH:()=>H};`);
let n=0,h=0,ev=0;
for(let d=1;d<=28;d++){const ds='2026-03-'+String(d).padStart(2,'0');API.setH(API.makeHole(ds));const H=API.getH();
 const g=API.analyze({club:2,spin:1,shape:2},{x:H.pin.x,z:H.pin.z});let r;while(!(r=g.next()).done);
 n++;if(r.value.hz.best.holed>.5)h++;}
console.log('best shot holes out on',h,'of',n,'holes');
