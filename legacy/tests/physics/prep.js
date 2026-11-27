/* Builds .cache/eng.js (the engine only: hole generator + shot physics + analyzer) and eng_plain.js (same, but the
   analyzer may only use standard spin and a neutral shape, to measure what spin/shape add). Run automatically by run-all.js. */
const fs=require('fs'),path=require('path');
const cache=path.join(__dirname,'.cache');fs.mkdirSync(cache,{recursive:true});
const eng=fs.readFileSync(path.join(__dirname,'../../src/js/00-engine.js'),'utf8');
fs.writeFileSync(path.join(cache,'eng.js'),eng);
const plain=eng.replace('for(let sp=0;sp<3;sp++)for(let sh=0;sh<SHAPE.length;sh++)','for(let sp=1;sp<2;sp++)for(let sh=NEU;sh<NEU+1;sh++)');
if(plain===eng)throw new Error('prep: analyzer search loop not found; update the pattern in tests/physics/prep.js');
fs.writeFileSync(path.join(cache,'eng_plain.js'),plain);
