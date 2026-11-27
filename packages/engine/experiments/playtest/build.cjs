#!/usr/bin/env node
/* Builds a playtest copy of the v118 prototype with a "Spread" switch in the menu:
     off    v118 behaviour (no dispersion)
     flat   every swing spreads (DISP 0.5, with v118's extra spread for very soft or hard swings)
     swing  small base spread + more spread the further the swing is from 100% (0.25 + 5 x |swing - 1|),
            swings from 70% to 110% allowed, and over-swings really fly further
   The shot you watch is one random sample from the spread; the score uses the average of 8 samples.
   legacy/ is not modified: this script patches a copy in memory and writes playtest/dist/index.html.
   Usage: node packages/engine/experiments/playtest/build.cjs */
'use strict';
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '../../../../legacy/src');
const read = (p) => fs.readFileSync(path.join(src, p), 'utf8');

/** Replace exactly `count` occurrences (default 1) or fail, so a drifted source is caught. */
function patch(text, from, to, count = 1) {
  const n = text.split(from).length - 1;
  if (n !== count) throw new Error(`playtest patch expected ${count} match(es), found ${n}: ${from.slice(0, 80)}`);
  return text.split(from).join(to);
}

let engine = read('js/00-engine.js');
engine = patch(
  engine,
  'let DISP=0;',
  `let DISP=0;
let SPREAD=(function(){try{const v=localStorage.getItem('pinhigh:spread');return v==='off'||v==='flat'||v==='swing'?v:'swing';}catch(e){return 'swing';}})();
const MAXSW=SPREAD==='swing'?1.1:1,MINSW=SPREAD==='swing'?.7:.8;
const ZA=SPREAD==='off'?{g1:[0],g2:[0]}:makeZ(8,4242); /* the samples every score is averaged over */
function spreadK(swing,df){return SPREAD==='off'?0:SPREAD==='flat'?.5*df:.25+5*Math.abs(swing-1);}`,
);
engine = patch(engine, 'carry=Math.min(need,c.y)/YD', 'carry=Math.min(need,c.y*MAXSW)/YD');
engine = patch(engine, 'still:Math.min(dist*YD,c.y)/YD-dist', 'still:Math.min(dist*YD,c.y*MAXSW)/YD-dist');
engine = patch(
  engine,
  'sa:DISP*.028*carry*df*SPIN[sel.spin].d,sl:DISP*.024*carry*df*Math.sqrt(SPIN[sel.spin].d)',
  'sa:spreadK(swing,df)*.028*carry*SPIN[sel.spin].d,sl:spreadK(swing,df)*.024*carry*Math.sqrt(SPIN[sel.spin].d)',
);
engine = patch(engine, 'if(g.swing<.8||g.swing>1.0)continue;', 'if(g.swing<MINSW||g.swing>MAXSW)continue;');
engine = patch(engine, 'evChoice(s0,A,Z0)', 'evChoice(s0,A,ZA)');
engine = patch(engine, 'evChoice(c.sel,c.aim,Z0)', 'evChoice(c.sel,c.aim,ZA)');
engine = patch(engine, 'evChoice(sel,aim,Z0)', 'evChoice(sel,aim,ZA)', 2);
engine = patch(engine, 'hazOf(sel,aim,Z0)', 'hazOf(sel,aim,ZA)');
engine = patch(engine, 'hazOf(best.sel,best.aim,Z0)', 'hazOf(best.sel,best.aim,ZA)');

const files = {};
for (const f of fs.readdirSync(path.join(src, 'js')).sort()) if (f !== '00-engine.js') files[f] = read('js/' + f);

// every hole is a practice hole: nothing is saved as a daily result
files['10-state-scene.js'] = patch(files['10-state-scene.js'], 'practice:custom,', 'practice:true,');
files['10-state-scene.js'] = patch(files['10-state-scene.js'], 'if(!custom){try{saved=', 'if(false){try{saved=');

// the aim readout: swing % and the size of the typical miss
const aim = files['20-camera-aim.js'];
files['20-camera-aim.js'] = patch(
  patch(patch(aim, 'g.sw0>1', 'g.sw0>MAXSW', 2), 'sw>=.75&&sw<=1', 'sw>=MINSW&&sw<=MAXSW'),
  'ft.hidden=!ft.innerHTML;',
  `if(!ft.innerHTML&&SPREAD!=='off')ft.innerHTML='Swing <em>'+Math.round(g.swing*100)+'%</em> &middot; typical miss &plusmn;'+Math.round(g.sa*FT)+' ft long/short, &plusmn;'+Math.round(g.sl*FT)+' ft left/right';ft.hidden=!ft.innerHTML;`,
);

// the real shot is one random sample from the spread; the best-shot ring and replays stay at the centre
files['40-shot-flight.js'] = patch(
  files['40-shot-flight.js'],
  'function planShot(sel,aim){\n  const g=geom(sel,aim),L=landFrom(g,aim,0,0)',
  'function planShot(sel,aim,rnd){\n  const g=geom(sel,aim),L=rnd?landFrom(g,aim,gauss(Math.random),gauss(Math.random)):landFrom(g,aim,0,0)',
);
let res = files['60-result-scoring.js'];
res = patch(res, 'const P=planShot(sel,aim);', 'const P=planShot(sel,aim,true);');
res = patch(res, 'Z0', 'ZA', 2);
res = patch(
  res,
  "$('rCost').textContent=cmpText(cost,avgCost);",
  "$('rCost').textContent=cmpText(cost,avgCost)+(SPREAD!=='off'?' \\u00b7 Scored on the average of 8 swings with your decision, not on this one ball':'');",
);
files['60-result-scoring.js'] = res;

files['70-loop-share-boot.js'] = patch(
  files['70-loop-share-boot.js'],
  '  requestAnimationFrame(frame);\n})();\n})();',
  '  requestAnimationFrame(frame);\n' +
  `\n$('modeChip').textContent='Playtest \\u00b7 spread: '+SPREAD;
{const sg=$('segSpread');[...sg.children].forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===SPREAD)));
 sg.addEventListener('click',e=>{const v=e.target.dataset&&e.target.dataset.v;if(!v||v===SPREAD)return;try{localStorage.setItem('pinhigh:spread',v);}catch(err){}location.reload();});}\n})();\n})();`,
);

let body = read('body.html');
body = patch(
  body,
  '<div class="mrow"><span>You play</span>',
  '<div class="mrow"><span>Spread</span><div class="seg" id="segSpread" role="group" aria-label="Shot spread"><button data-v="off">Off</button><button data-v="flat">Flat</button><button data-v="swing">Swing</button></div></div>\n        <div class="mrow"><span>You play</span>',
);
const head = patch(read('head.html'), '<title>Pin High</title>', '<title>Pin High playtest</title>');

const THREE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
const html =
  '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' +
  '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html,body{margin:0}body{font:14px system-ui,sans-serif;background:#0f1f19}img{max-width:100%}[hidden]{display:none!important}</style>\n' +
  head +
  '<style>\n' +
  read('style.css') +
  '</style>\n</head>\n<body>\n' +
  body +
  '<script src="' +
  THREE_CDN +
  '"></script>\n<script>\n' +
  engine +
  '</script>\n<script>\n' +
  Object.values(files).join('') +
  '</script>\n</body>\n</html>\n';

// the same page without its own skeleton, for hosts that wrap it (as legacy dist/artifact.html)
const scripts = html.slice(html.indexOf('<script src='), html.indexOf('</body>'));
const artifact = head + '<style>\n' + read('style.css') + '</style>\n' + body + scripts;
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist/artifact.html'), artifact);
const out = path.join(__dirname, 'dist/index.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
// offline copy for the headless smoke test (three.js from node_modules)
const three = path.join(__dirname, '../../../../legacy/node_modules/three/build/three.min.js');
if (fs.existsSync(three)) fs.writeFileSync(path.join(path.dirname(out), 'test.html'), html.replace(THREE_CDN, 'file://' + three));
console.log('wrote', path.relative(process.cwd(), out), (html.length / 1024).toFixed(0) + ' KB');
