#!/usr/bin/env node
/* Captures golden outputs from the v118 prototype engine (legacy/src/js/00-engine.js) and the v118
   scoring code (legacy/src/js/60-result-scoring.js) into test/golden/v118.json.

   The TypeScript engine must reproduce every number in that file exactly (test/golden.test.ts).
   Run this only to regenerate the reference from the legacy code; never to "fix" a failing test.
   Usage: node packages/engine/scripts/capture-golden.cjs */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const legacy = path.join(__dirname, '../../../legacy/src/js');
const engineSrc = fs.readFileSync(path.join(legacy, '00-engine.js'), 'utf8');
const scoringSrc = fs.readFileSync(path.join(legacy, '60-result-scoring.js'), 'utf8');

/* Scoring code lives in the UI file; take only the pure parts. */
const scoreBlock = scoringSrc.slice(scoringSrc.indexOf('const SCORE_PTS'), scoringSrc.indexOf('function showResult'));
const typicalFn = /function typicalShot\(\)\{[\s\S]*?\n\}/.exec(scoringSrc);
if (!scoreBlock || !typicalFn) throw new Error('capture-golden: scoring code not found in 60-result-scoring.js');

const API_EXPORT = `;this.API={makeHole,geom,landFrom,outcomeAt,roll,evChoice,hazOf,analyze,makeZ,mulberry32,hashStr,gauss,Z0,
  CLUBS,SPIN,SHAPE,NEU,totalScore,tierOf,nextTier,typicalShot,
  setH:h=>{H=h;},setHand:v=>{HAND=v;},setFine:v=>{FINE=v;}};`;

function load(src) {
  const ctx = vm.createContext({ Math, console });
  vm.runInContext(src + '\n' + scoreBlock + '\n' + typicalFn[0] + API_EXPORT, ctx);
  return ctx.API;
}
const A = load(engineSrc);
const plainSrc = engineSrc.replace(
  'for(let sp=0;sp<3;sp++)for(let sh=0;sh<SHAPE.length;sh++)',
  'for(let sp=1;sp<2;sp++)for(let sh=NEU;sh<NEU+1;sh++)',
);
if (plainSrc === engineSrc) throw new Error('capture-golden: analyzer loop not found for the plain-only variant');
const B = load(plainSrc);

const r6 = (n) => n; // keep full precision: the port must be bit-identical
const pt = (p) => ({ x: r6(p.x), z: r6(p.z) });
const plain = (o) => JSON.parse(JSON.stringify(o));
const heatArr = (vals) => Array.from(vals, (v) => (v === v ? v : null));

const dayKeys = [];
for (let d = 0; d < 36; d++) dayKeys.push(new Date(Date.UTC(2026, 0, 1) + d * 864e5 * 10).toISOString().slice(0, 10));
dayKeys.push('practice-1', 'practice-42', 'zzz');

const rnd = A.mulberry32(20261127);
const holes = [];
for (const key of dayKeys) {
  const H = A.makeHole(key);
  A.setH(H);
  A.setHand('R');
  const out = {
    key,
    scalars: {
      type: H.type, waterAround: H.waterAround, R: H.R, area: H.area, Rmax: H.Rmax, Rview: H.Rview,
      vcx: H.vcx, vcz: H.vcz, S: H.S, pin: pt(H.pin), P: pt(H.P), pinYd: H.pinYd, stimp: H.stimp,
      wind: plain(H.wind), af: H.af, hazards: H.hazards.length,
    },
    outline: [], vOutline: [], field: [], shots: [],
  };
  for (let k = 0; k < 48; k++) {
    const th = -Math.PI + (k + 0.37) * (2 * Math.PI / 48);
    out.outline.push([th, H.outline(th)]);
    out.vOutline.push([th, H.vOutline(th)]);
  }
  const L = H.Rmax * 1.1;
  for (let j = 0; j < 11; j++)
    for (let i = 0; i < 11; i++) {
      const x = -L + (2 * L * i) / 10 + 0.013, z = -L + (2 * L * j) / 10 - 0.021;
      const g = H.grad(x, z);
      out.field.push({ x, z, h: H.h(x, z), hv: H.hv(x, z), gx: g[0], gz: g[1], inIsland: H.inIsland(x, z), edgeR: H.edgeR(x, z) });
    }
  for (let s = 0; s < 14; s++) {
    const hand = rnd() < 0.25 ? 'L' : 'R';
    const sel = { club: (rnd() * A.CLUBS.length) | 0, spin: (rnd() * 3) | 0, shape: (rnd() * 5) | 0, hand };
    const rr = Math.pow(rnd(), 0.8) * (s < 12 ? 9 : 30), th = rnd() * 6.283;
    const aim = { x: H.pin.x + Math.cos(th) * rr, z: H.pin.z + Math.sin(th) * rr };
    const g = A.geom(sel, aim);
    const Ld = A.landFrom(g, aim, 0, 0);
    const coarse = A.outcomeAt(sel, Ld, null);
    const rec = [];
    const fine = A.outcomeAt(sel, Ld, rec);
    const evCoarse = A.evChoice(sel, aim, A.Z0);
    const hzCoarse = A.hazOf(sel, aim, A.Z0);
    A.setFine(true);
    const evFine = A.evChoice(sel, aim, A.Z0);
    A.setFine(false);
    out.shots.push({
      sel, aim, geom: plain(g), landing: plain(Ld), coarse: plain(coarse), fine: plain(fine),
      rec: { n: rec.length, sum: rec.reduce((a, b) => a + b, 0), last: rec.slice(-2) }, evCoarse, evFine, hzCoarse,
    });
  }
  holes.push(out);
}

/* Full analysis and scoring on a subset of holes, as the v118 result card computed it. */
function runAnalysis(E, H, sel, aim) {
  E.setH(H);
  E.setHand(sel.hand);
  const it = E.analyze({ club: sel.club, spin: sel.spin, shape: sel.shape }, aim);
  let r, yields = 0;
  while (!(r = it.next()).done) yields++;
  const res = r.value;
  const ty = E.typicalShot();
  const avgCost = Math.max(0, E.evChoice(ty.sel, ty.aim, E.Z0) - res.pro.ev2);
  const tyHz = E.hazOf(ty.sel, ty.aim, E.Z0);
  const cost = Math.max(0, res.mine - res.pro.ev2);
  const total = E.totalScore(+cost.toFixed(2), +avgCost.toFixed(2));
  E.setHand('R');
  return {
    yields,
    best: { ev: res.best.ev, ev2: res.best.ev2, sel: plain(res.best.sel), aim: pt(res.best.aim) },
    mine: res.mine, hz: plain(res.hz),
    heat: { nx: res.heat.nx, step: res.heat.step, S: res.heat.S, min: res.heat.min, vals: heatArr(res.heat.vals) },
    score: { cost, avgCost, total, tier: E.tierOf(total).n, typical: { sel: plain(ty.sel), aim: pt(ty.aim), hz: plain(tyHz) } },
  };
}
const analyses = [];
const aRnd = A.mulberry32(7);
for (let k = 0; k < 10; k++) {
  const key = dayKeys[k * 3];
  const hand = k === 4 ? 'L' : 'R';
  const H = A.makeHole(key);
  const sel = { club: (aRnd() * 10) | 0, spin: (aRnd() * 3) | 0, shape: (aRnd() * 5) | 0, hand };
  const rr = aRnd() * 6, th = aRnd() * 6.283;
  const aim = { x: H.pin.x + Math.cos(th) * rr, z: H.pin.z + Math.sin(th) * rr };
  analyses.push({ key, sel, aim, plainOnly: false, ...runAnalysis(A, H, sel, aim) });
}
for (const key of [dayKeys[1], dayKeys[8]]) {
  const H = B.makeHole(key);
  const sel = { club: 3, spin: 1, shape: 2, hand: 'R' };
  const aim = pt(H.pin);
  analyses.push({ key, sel, aim, plainOnly: true, ...runAnalysis(B, H, sel, aim) });
}

const scoring = [];
for (const cost of [0, 0.004, 0.01, 0.03, 0.1, 0.15, 0.25, 0.4, 0.62, 0.8, 1.3, 2, 2.6, 3.5, 5])
  for (const avg of [null, 0, 0.1, 0.25, 0.5, 1, 2]) scoring.push({ cost, avg, total: A.totalScore(cost, avg) });
const tiers = [];
for (const s of [0, 60, 249, 250, 449, 450, 619, 620, 779, 780, 899, 900, 984, 985, 1000])
  tiers.push({ s, tier: A.tierOf(s).n, next: (A.nextTier(s) || [null])[0] });

const rngs = { hash: ['', 'pinhigh:2026-03-01', 'x'].map((s) => [s, A.hashStr(s)]), mulberry: [], gauss: [], makeZ: plain(A.makeZ(5, 99)) };
{ const r = A.mulberry32(12345); for (let i = 0; i < 8; i++) rngs.mulberry.push(r()); const g = A.mulberry32(5); for (let i = 0; i < 8; i++) rngs.gauss.push(A.gauss(g)); }

const outFile = path.join(__dirname, '../test/golden/v118.json');
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify({ source: 'prototype v118 (legacy/src/js)', holes, analyses, scoring, tiers, rngs }));
console.log('wrote', path.relative(process.cwd(), outFile), (fs.statSync(outFile).size / 1024).toFixed(0) + ' KB');
