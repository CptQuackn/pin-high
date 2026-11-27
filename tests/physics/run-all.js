/* Physics regression: runs the calibration scripts and asserts the numbers we tuned against.
   Thresholds are the values at v118 with a little slack. If you change physics on purpose, update them here. */
const {execFileSync}=require('child_process'),path=require('path');
execFileSync('node',[path.join(__dirname,'prep.js')],{stdio:'inherit'});
const run=f=>execFileSync('node',[path.join(__dirname,f)],{encoding:'utf8',timeout:600000});
let fail=0;const check=(name,ok,detail)=>{console.log((ok?'PASS ':'FAIL ')+name+'  '+detail);if(!ok)fail++;};
let o=run('h.js');let m=o.match(/holes out on (\d+) of (\d+)/);
check('best shot holes out on every daily hole',m&&m[1]===m[2],o.trim().split('\n').pop());
o=run('n2.js');m=o.match(/shots (\d+) holed (\d+) rolled over (\d+) caught edge (\d+)/);
check('some shots drop, none absurd',m&&+m[2]>0&&+m[2]<+m[1],o.trim().split('\n').pop().slice(0,120));
o=run('run.js');m=o.match(/share cost>=1\.5: ([\d.]+)/);
check('typical-player loss not extreme (share of holes costing >=1.5 strokes < 0.6)',m&&+m[1]<.6,o.trim().split('\n').pop());
o=run('sp.js');m=o.match(/avg strokes saved vs plain-only best ([\d.]+).*>0\.1 on (\d+) holes/);
check('spin/shape matter on at least a few holes',m&&+m[2]>=3,o.trim().split('\n').pop());
console.log(fail?fail+' check(s) failed':'all checks passed');process.exit(fail?1:0);
