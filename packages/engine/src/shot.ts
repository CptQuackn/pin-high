/**
 * Shot model: geometry from the decision, landing spot, and roll-out on the green.
 * Ported from v118 with the hole passed in explicitly instead of read from a global.
 */
import { BEV, CLUBS, COLLAR, CUPR, CW, DISP, FRM, G, K, SG, SHAPE, SPIN, YD } from './constants.js';
import type { Hole } from './hole.js';
import { clamp } from './math.js';
import type { Outcome, Point, Selection } from './types.js';

/** +1 for a right-hander, -1 for a left-hander (a lefty's draw bends right). */
export const handSign = (sel: Selection): number => (sel.hand === 'L' ? -1 : 1);

export interface ShotGeom {
  /** Unit vector from tee to aim, and its right-hand normal. */
  ux: number;
  uz: number;
  rx: number;
  rz: number;
  /** Tee-to-aim distance (m). */
  dist: number;
  carry: number;
  land: number;
  /** Wind distance factor (>1 plays longer). */
  wf: number;
  drift: number;
  wdrift: number;
  /** Flight bow from shape (m). Cosmetic: it does not move the landing spot. */
  curve: number;
  head: number;
  cross: number;
  /** Fraction of the club's stock carry the shot needs. */
  swing: number;
  still: number;
  sw0: number;
  /** Dispersion along / across the line (0 while DISP = 0). */
  sa: number;
  sl: number;
}

/**
 * The carry is set by the aim spot. The club only decides whether it is reachable and how hard
 * you must swing; out of reach lands short.
 */
export function geom(hole: Hole, sel: Selection, aim: Point): ShotGeom {
  const c = CLUBS[sel.club]!;
  const dx = aim.x - hole.P.x;
  const dz = aim.z - hole.P.z;
  const dist = Math.hypot(dx, dz) || 1;
  const ux = dx / dist;
  const uz = dz / dist;
  const rx = -uz;
  const rz = ux;
  const sw = SPIN[sel.spin]!.w;
  const swh = SPIN[sel.spin]!.wh;
  /* wind: headwind adds ~1% of distance per mph, tailwind removes ~0.5% per mph (Golf Monthly rule
     of thumb); crosswind drift is a placeholder 0.35% of distance per mph. High spin feels it more. */
  const W = hole.wind;
  const head = -(W.x * ux + W.z * uz) * W.mph;
  const cross = (W.x * rx + W.z * rz) * W.mph;
  /* a shot that curves into the crosswind holds its line (-25% drift), one that curves with it is
     pushed more (+25%); placeholder size */
  const ls = SHAPE[sel.shape]!.s * handSign(sel); // + = the ball bends right
  const sf = 1 + 0.15 * ls * Math.sign(cross);
  const curve = ls * 0.045 * dist;
  const wf = 1 + (head >= 0 ? 0.01 : 0.005) * head * swh;
  const wdrift = cross * 0.0035 * dist * sw * sf;
  const drift = wdrift;
  const need = dist * YD * wf;
  const swing = need / c.y;
  const carry = Math.min(need, c.y) / YD;
  const land = carry / wf;
  const df = 1 + 1.5 * Math.max(0, swing - 0.95) + 3.5 * Math.max(0, 0.9 - swing);
  return {
    ux,
    uz,
    rx,
    rz,
    dist,
    carry,
    land,
    wf,
    drift,
    wdrift,
    curve,
    head,
    cross,
    swing,
    still: Math.min(dist * YD, c.y) / YD - dist,
    sw0: (dist * YD) / c.y,
    sa: DISP * 0.028 * carry * df * SPIN[sel.spin]!.d,
    sl: DISP * 0.024 * carry * df * Math.sqrt(SPIN[sel.spin]!.d),
  };
}

export interface Landing extends Point {
  ux: number;
  uz: number;
  rx: number;
  rz: number;
}

/** Landing spot for a shot, given two standard-normal dispersion samples (0, 0 = no spread). */
export function landFrom(g: ShotGeom, aim: Point, g1: number, g2: number): Landing {
  const a = g.land - g.dist + g1 * g.sa;
  const l = g2 * g.sl + g.drift;
  return { x: aim.x + g.ux * a + g.rx * l, z: aim.z + g.uz * a + g.rz * l, ux: g.ux, uz: g.uz, rx: g.rx, rz: g.rz };
}

/**
 * Rolls a ball on the green from (x, z) with velocity (vx, vz).
 * `rec`, when given, receives the path as flat x,z pairs and forces the fine step.
 * `fine` uses the animation's small time step (the analyzer rolls coarsely, then re-checks).
 */
export function roll(
  hole: Hole,
  x: number,
  z: number,
  vx: number,
  vz: number,
  rec: number[] | null,
  fine = false,
): Outcome {
  const isFine = !!rec || fine;
  const dt = isFine ? 0.016 : 0.06;
  const af0 = hole.af * FRM;
  const pin = hole.pin;
  const max = isFine ? 1400 : 250;
  let af = af0;
  let near: { d: number; v: number } | null = null; // closest pass of the cup that did not drop
  if (rec) rec.push(x, z);
  for (let i = 0; i < max; i++) {
    af = hole.edgeR(x, z) < CW ? af0 * COLLAR : af0;
    const g = hole.grad(x, z);
    let ax = -K * G * SG * g[0];
    let az = -K * G * SG * g[1];
    {
      const bx = pin.x - x;
      const bz = pin.z - z;
      const bd = Math.hypot(bx, bz);
      if (bd < BEV && bd > 1e-6) {
        const w = (K * G * SG * 0.12 * (1 - bd / BEV)) / bd;
        ax += w * bx;
        az += w * bz;
      }
    }
    const nx = vx + ax * dt;
    const nz = vz + az * dt;
    const s2 = Math.hypot(nx, nz);
    if (s2 <= af * dt) {
      if (Math.hypot(ax, az) <= af) {
        vx = 0;
        vz = 0;
        break;
      }
      vx = nx;
      vz = nz;
    } else {
      const f = 1 - (af * dt) / s2;
      vx = nx * f;
      vz = nz * f;
    }
    const ox = x;
    const oz = z;
    x += vx * dt;
    z += vz * dt;
    /* swept cup check: closest approach of this step to the hole; slower and centred balls drop */
    {
      const sx = x - ox;
      const sz = z - oz;
      const sl = sx * sx + sz * sz;
      const t = sl > 0 ? clamp(((pin.x - ox) * sx + (pin.z - oz) * sz) / sl, 0, 1) : 0;
      const d = Math.hypot(ox + sx * t - pin.x, oz + sz * t - pin.z);
      if (d < CUPR && Math.hypot(vx, vz) < 1.75 * Math.sqrt(1 - (d / CUPR) * (d / CUPR)) + 0.15) {
        if (rec) rec.push(pin.x, pin.z);
        return { s: 'holed', x: pin.x, z: pin.z };
      }
      if (d < CUPR * 1.8 && (!near || d < near.d)) near = { d, v: Math.hypot(vx, vz) };
    }
    if (rec) rec.push(x, z);
    // sand is beside the green; anywhere else off the edge is lost
    if (!hole.inIsland(x, z)) return hole.inBunker(x, z) ? { s: 'bunker', x, z } : { s: 'water', x, z };
  }
  return { s: 'green', x, z, near };
}

/** Where a shot that lands at L finishes, including landing-spot slope effects on release. */
export function outcomeAt(hole: Hole, sel: Selection, L: Landing, rec: number[] | null, fine = false): Outcome {
  if (!hole.inIsland(L.x, L.z))
    return hole.inBunker(L.x, L.z) ? { s: 'bunker', x: L.x, z: L.z } : { s: 'water', x: L.x, z: L.z };
  const c = CLUBS[sel.club]!;
  const sp = SPIN[sel.spin]!;
  const sh = SHAPE[sel.shape]!;
  /* shape: a draw lands flatter and releases (+12% roll per step), a fade lands steeper and checks
     (-12% roll, +12% backspin bite). Slope at the landing spot: into the slope the ball checks up
     harder, down the slope it releases and backspin bites less; a side slope kicks it downhill. */
  const gg = hole.grad(L.x, L.z);
  const sa = gg[0] * L.ux + gg[1] * L.uz;
  const cs = gg[0] * L.rx + gg[1] * L.rz;
  const fr = clamp(1 - 9 * sa, 0.55, 1.7);
  const bk = clamp(1 + 14 * sa, 0.3, 2);
  const v = (c.rel * sp.m * fr * (1 - 0.12 * sh.s) - c.back * sp.b * bk * (1 + 0.12 * sh.s)) * Math.sqrt(FRM);
  const lat = (0.35 * sh.s * handSign(sel) - 1.5 * cs) * Math.sqrt(FRM);
  return roll(hole, L.x, L.z, L.ux * v + L.rx * lat, L.uz * v + L.rz * lat, rec, fine);
}

/** Plans one shot with no dispersion: geometry, landing spot and finish. */
export function playShot(hole: Hole, sel: Selection, aim: Point, rec: number[] | null = null) {
  const g = geom(hole, sel, aim);
  const L = landFrom(g, aim, 0, 0);
  const out = outcomeAt(hole, sel, L, rec);
  return { geom: g, landing: L, outcome: out };
}
