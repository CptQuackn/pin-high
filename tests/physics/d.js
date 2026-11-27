const fs=require('fs'),vm=require('vm');
vm.runInThisContext(fs.readFileSync(__dirname+'/.cache/eng.js','utf8')+`;globalThis.API={makeHole};`);
const v=[];for(let d=0;d<730;d++){const dt=new Date(Date.UTC(2026,0,1)+d*864e5).toISOString().slice(0,10);v.push(API.makeHole(dt).pinYd);}
v.sort((a,b)=>a-b);const q=p=>v[Math.floor(p*(v.length-1))];
console.log('n',v.length,'min',v[0],'p10',q(.1),'p25',q(.25),'median',q(.5),'p75',q(.75),'p90',q(.9),'max',v[v.length-1]);
const b={};v.forEach(x=>{const k=Math.floor(x/10)*10;b[k]=(b[k]||0)+1});console.log(b);
