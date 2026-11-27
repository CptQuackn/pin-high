const fs=require('fs'),vm=require('vm');
const c=vm.createContext({console,Math,Date});vm.runInContext(fs.readFileSync(__dirname+'/.cache/eng.js','utf8')+';this.A={CLUBS,SPIN,FRM};',c);const A=c.A;
const af=5.5/10*A.FRM;console.log('flat stimp10 roll ft (low/std/high; - = back)');
console.log(A.CLUBS.map(k=>A.SPIN.map(sp=>{const v=(k.rel*sp.m-k.back*sp.b)*Math.sqrt(A.FRM);return ((v<0?-1:1)*v*v/(2*af)*1.09361*3).toFixed(0)}).join('/')+' '+k.n).join(' | '));
