/**
 * Seeded hole generator. A faithful port of v118 `makeHole`: the same RNG calls in the same order
 * and the same floating-point operations, so the same date gives a bit-identical hole
 * (checked by test/golden.test.ts).
 *
 * The returned Hole holds closures over precomputed grids (height, gradient, outline), so it is
 * not serialisable. Sending holes from a server as data is a later phase.
 */
import { CLUBS, YD } from './constants.js';
import { hashStr, mulberry32 } from './math.js';
import type { Point } from './types.js';

export const ARCHETYPES = [
  'Classic',
  'Redan',
  'Eden',
  'Biarritz',
  'Punchbowl',
  'Double plateau',
  'Road',
  'Tiers',
  'Spine',
  'False front',
  'Kidney',
  'Two-lobe',
  'Three-lobe',
  'Boomerang',
] as const;
export type Archetype = (typeof ARCHETYPES)[number];

/** Bunkers and ponds are switched off for now (every hole is an island). */
export const HAZARDS_ON = false;

export interface Hazard {
  ap: number;
  kind: 'sand' | 'water';
  aT: number;
  aN: number;
  Tx: number;
  Tz: number;
  nx: number;
  nz: number;
  ph: number;
  d: number;
  cx: number;
  cz: number;
}

export interface Wind {
  mph: number;
  /** Unit direction the wind blows toward. */
  x: number;
  z: number;
}

/**
 * Gradient lookup result. The same two-element array is reused on every call of one hole's
 * `grad`, as in v118, so read both values before calling `grad` again.
 */
export type Grad = readonly [number, number];

export interface Hole {
  /** The date string or seed key the hole was generated from. */
  seed: string;
  type: Archetype;
  waterAround: boolean;
  /** Green radius by angle (radians, atan2 convention). */
  outline(th: number): number;
  /** Drawn landmass radius by angle (green plus hazard surrounds). */
  vOutline(th: number): number;
  /** Equivalent circular radius of the green. */
  R: number;
  area: number;
  Rmax: number;
  /** Camera framing: radius and centre. */
  Rview: number;
  vcx: number;
  vcz: number;
  /** Half-size of the square the analyzer searches. */
  S: number;
  /** Green height (m). */
  h(x: number, z: number): number;
  /** Height including hazard dips. */
  hv(x: number, z: number): number;
  grad(x: number, z: number): Grad;
  inIsland(x: number, z: number): boolean;
  inSand(x: number, z: number): boolean;
  inWater(x: number, z: number): boolean;
  inBunker(x: number, z: number): boolean;
  /** Distance from (x, z) to the green edge along the ray from the centre (positive inside). */
  edgeR(x: number, z: number): number;
  hazards: Hazard[];
  hq(h: Hazard, x: number, z: number): number;
  pin: Point;
  /** Tee position. */
  P: Point;
  pinYd: number;
  stimp: number;
  wind: Wind;
  /** Base friction from green speed (5.5 / stimp). */
  af: number;
}

interface Ellipse {
  x: number;
  z: number;
  a: number;
  b: number;
  rot: number;
}

type Feature = (x: number, z: number, fe: number) => number;

const TAU2 = Math.PI * 2;

/** Builds the daily hole for a date string ('YYYY-MM-DD'), or a practice hole for any other key. */
export function makeHole(dateStr: string): Hole {
  const r = mulberry32(hashStr('pinhigh:' + dateStr));
  const U = (a: number, b: number) => a + r() * (b - a);
  const sgn = () => (r() < 0.5 ? -1 : 1);
  const sm = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const type = ARCHETYPES[(r() * ARCHETYPES.length) | 0]!;
  const mir = sgn(); // flips the whole hole left to right
  const E: Ellipse[] = [];
  const spec: { kind: 'sand' | 'water'; th: number; aT: number; aN: number }[] = [];
  let tx = 0;
  let tz = 0;
  let feat: Feature | null = null;
  const waterAround = false;
  const ell = (x: number, z: number, a: number, b: number, rot?: number) =>
    E.push({ x: x * mir, z, a, b, rot: (rot || 0) * mir });
  // Hazard specs are never added while HAZARDS_ON is false; kept for parity with v118.
  void spec;
  /* Sizes are metres. Shapes and features follow published template holes; the exact sizes and
     slopes are tuning, kept near greens of 2,700 to 6,000 sq ft and pin areas of about 3% or less. */
  const bump = (x: number, z: number, cx: number, cz: number, sg: number) =>
    Math.exp(-((x - cx) * (x - cx) + (z - cz) * (z - cz)) / (2 * sg * sg));

  switch (type) {
    case 'Classic': {
      // a pear: a big body with a smaller lobe off one shoulder
      ell(0, 0, U(10.5, 12), U(9.5, 11), U(-0.4, 0.4));
      {
        const sd = sgn();
        ell(sd * U(6, 7.5), -U(2.5, 4), U(6.2, 7.4), U(5.6, 6.8), U(-0.5, 0.5));
      }
      tx = U(-0.014, 0.014);
      tz = -U(0.006, 0.02);
      const m1 = [U(-5, 5), U(-5, 5), U(2.6, 3.4), U(0.14, 0.24) * sgn()] as const;
      const m2 = [U(-6, 6), U(-6, 6), U(2.4, 3.2), U(0.12, 0.2) * sgn()] as const;
      feat = (x, z) => m1[3] * bump(x, z, m1[0], m1[1], m1[2]) + m2[3] * bump(x, z, m2[0], m2[1], m2[2]);
      break;
    }
    case 'Redan': {
      // a long diagonal body with a tongue at the front
      ell(0, 0, U(9, 10.5), U(12.5, 14.5), -0.35);
      ell(U(4, 5.5), U(8.5, 10.5), U(5.2, 6.2), U(4.4, 5.4), 0.5);
      tz = U(0.018, 0.026);
      tx = mir * U(0.012, 0.018);
      const zs = U(-3, 0);
      const d = U(0.14, 0.22);
      feat = (x, z) => -d * sm(zs - 3, zs + 4, z) * (0.5 + 0.5 * Math.sin(x * 0.25)); // front drops toward the player
      break;
    }
    case 'Eden': {
      // a rounded triangle
      {
        const a0 = U(0, 6.283);
        const d = U(3.4, 4.2);
        const rr = U(9, 10);
        for (let k = 0; k < 3; k++) {
          const a = a0 + (k * TAU2) / 3;
          ell(Math.cos(a) * d * mir, Math.sin(a) * d, rr, rr * U(0.92, 1.04), a);
        }
      }
      tz = -U(0.024, 0.034);
      tx = U(-0.008, 0.008);
      const hx = U(-4, 4);
      const hz = U(-5, -1);
      const hh = U(0.2, 0.3);
      feat = (x, z) => hh * bump(x, z, hx, hz, 3.2);
      break;
    }
    case 'Biarritz': {
      ell(0, 0, U(6.5, 7.5), U(18, 21));
      tz = -U(0.006, 0.012);
      tx = U(-0.006, 0.006);
      const zs = U(-2.5, 2.5);
      const d = U(0.34, 0.46);
      const sg = U(2.4, 3);
      feat = (x, z) => -d * Math.exp((-(z - zs) * (z - zs)) / (2 * sg * sg)); // a deep swale across the middle
      break;
    }
    case 'Punchbowl': {
      ell(0, 0, U(11.5, 13), U(11, 12.5));
      tz = -U(0.002, 0.008);
      tx = U(-0.006, 0.006);
      const k = U(0.0018, 0.0026);
      const rd = U(0.14, 0.2);
      feat = (x, z, fe) => k * (x * x + z * z) + rd * sm(2.8, 0.4, fe);
      break;
    }
    case 'Double plateau': {
      ell(-U(3, 4), U(2.5, 3.5), U(8, 9), U(7, 8), 0.3);
      ell(U(3, 4), -U(2.5, 3.5), U(8, 9), U(7, 8), 0.3);
      tz = -U(0.002, 0.008);
      tx = U(-0.005, 0.005);
      const hA = U(0.3, 0.42);
      const hB = U(0.1, 0.18);
      feat = (x, z) => {
        let v = 0;
        for (let i = 0; i < 2; i++) {
          const e = E[i]!;
          const dx = x - e.x;
          const dz = z - e.z;
          const c = Math.cos(e.rot);
          const sn = Math.sin(e.rot);
          const u = (dx * c + dz * sn) / e.a;
          const w = (-dx * sn + dz * c) / e.b;
          const f = u * u + w * w;
          v += (i ? hB : hA) * sm(1.5, 0.5, f);
        }
        return v;
      };
      break;
    }
    case 'Road': {
      ell(0, 0, U(7.5, 8.5), U(16, 18), U(0.45, 0.6));
      tz = -U(0.012, 0.02);
      tx = U(-0.012, 0.012);
      const zs = U(-3, 3);
      const d = U(0.12, 0.2);
      feat = (x, z) => -d * sm(zs - 2.5, zs + 2.5, z) - 0.1 * Math.sin(z * 0.35);
      break;
    }
    case 'Tiers': {
      ell(0, 0, U(12, 13.5), U(10.5, 12), U(-0.3, 0.3));
      tz = -U(0.002, 0.006);
      tx = U(-0.006, 0.006);
      const zc = U(-2, 2);
      const st = U(0.3, 0.42);
      feat = (x, z) => st * sm(zc + 1.6, zc - 1.6, z); // high back tier, low front tier
      break;
    }
    case 'Spine': {
      ell(0, 0, U(8.5, 9.5), U(14, 16), U(-0.12, 0.12));
      tz = -U(0.004, 0.01);
      tx = U(-0.006, 0.006);
      const h0 = U(0.3, 0.42);
      const sg = U(2.3, 3);
      const off = U(-1, 1);
      feat = (x) => h0 * Math.exp((-(x - off) * (x - off)) / (2 * sg * sg)); // a ridge that sheds the ball both ways
      break;
    }
    case 'False front': {
      ell(0, 0, U(11, 12.5), U(11, 12.5), U(-0.3, 0.3));
      tz = -U(0.014, 0.022);
      tx = U(-0.008, 0.008);
      const zf = U(2, 3.5);
      const dr = U(0.42, 0.58);
      feat = (x, z) => -dr * sm(zf, zf + 4.8, z); // the front falls back toward the player
      break;
    }
    case 'Kidney':
    case 'Two-lobe':
    case 'Three-lobe': {
      // an elongated body with round lobes off its sides
      const al = U(0.95, 1.35);
      const ux = Math.cos(al);
      const uz = Math.sin(al);
      const vx = -uz;
      const vz = ux;
      const A = U(9.5, 10.5);
      const B = U(6, 7);
      const sd = sgn();
      ell(0, 0, A, B, al);
      const L: [number, number][] =
        type === 'Kidney'
          ? [[0.8, 1]]
          : type === 'Two-lobe'
            ? [
                [0.82, 1],
                [-0.6, -1],
              ]
            : [
                [0.85, 1],
                [0.02, -1],
                [-0.8, 1],
              ];
      const mnd: [number, number][] = [];
      for (const [t, sg] of L) {
        const cx = ux * A * t + vx * sg * sd * B * 0.62;
        const cz = uz * A * t + vz * sg * sd * B * 0.62;
        const rr = U(3.9, 4.7);
        ell(cx, cz, rr, rr * U(0.92, 1.05), 0);
        mnd.push([cx, cz]);
      }
      tz = -U(0.004, 0.012);
      tx = U(-0.008, 0.008);
      const hh = U(0.2, 0.3);
      feat = (x, z) => hh * mnd.reduce((a, c) => a + bump(x, z, c[0] * mir, c[1], 2.8), 0);
      break;
    }
    default: {
      // Boomerang: a bent green, bowl at the elbow
      const a1 = U(-0.2, 0.2);
      const sp = U(2.0, 2.4);
      const a2 = a1 + sp;
      const L = U(7.2, 8.2);
      const A = U(10, 11);
      const B = U(4.8, 5.4);
      ell(Math.cos(a1) * L, Math.sin(a1) * L, A, B, a1);
      ell(Math.cos(a2) * L, Math.sin(a2) * L, A, B, a2);
      tz = -U(0.002, 0.008);
      tx = U(-0.006, 0.006);
      const k = U(0.0015, 0.0022);
      feat = (x, z) => k * (x * x + z * z) - 0.12 * bump(x, z, 0, 0, 3);
      break;
    }
  }

  const DRAMA = 0.6; // how bold the contours are: 1 was too dramatic
  if (feat) {
    const F0 = feat;
    feat = (x, z, fe) => DRAMA * F0(x, z, fe);
  }
  tx *= 0.85;
  tz *= 0.85;

  const inside = (x: number, z: number): boolean => {
    for (const e of E) {
      const dx = x - e.x;
      const dz = z - e.z;
      const c = Math.cos(e.rot);
      const s = Math.sin(e.rot);
      const u = (dx * c + dz * s) / e.a;
      const v = (-dx * s + dz * c) / e.b;
      if (u * u + v * v < 1) return true;
    }
    return false;
  };

  /* outline: march a ray from the middle to the edge of the union of ellipses, smooth the notches,
     then add a little wobble */
  const OTN = 1440;
  const OT = new Float32Array(OTN);
  for (let i = 0; i < OTN; i++) {
    const th = ((i + 0.5) / OTN) * TAU2 - Math.PI;
    const c = Math.cos(th);
    const s = Math.sin(th);
    let t = 0;
    while (t < 60 && inside(c * t, s * t)) t += 0.1;
    let lo = Math.max(0, t - 0.1);
    let hi = t;
    for (let k = 0; k < 7; k++) {
      const m = (lo + hi) / 2;
      if (inside(c * m, s * m)) lo = m;
      else hi = m;
    }
    OT[i] = lo;
  }
  /* soft joins without blobby lobes: blur a copy hard, keep the larger of the two, then ease the seams */
  {
    const O0 = OT.slice();
    const B = OT.slice();
    for (let pass = 0; pass < 14; pass++) {
      const c = B.slice();
      for (let i = 0; i < OTN; i++) {
        let a = 0;
        for (let k = -10; k <= 10; k++) a += c[(i + k + OTN) % OTN]!;
        B[i] = a / 21;
      }
    }
    for (let i = 0; i < OTN; i++) OT[i] = Math.max(O0[i]!, B[i]!);
    for (let pass = 0; pass < 5; pass++) {
      const c = OT.slice();
      for (let i = 0; i < OTN; i++) {
        let a = 0;
        for (let k = -5; k <= 5; k++) a += c[(i + k + OTN) % OTN]!;
        OT[i] = a / 11;
      }
    }
  }
  const lobes = [
    [3, U(0.015, 0.04), U(0, 6.283)],
    [5, U(0.008, 0.02), U(0, 6.283)],
    [7, U(0.004, 0.012), U(0, 6.283)],
  ] as const;
  for (let i = 0; i < OTN; i++) {
    const th = ((i + 0.5) / OTN) * TAU2 - Math.PI;
    let s = 1;
    for (const l of lobes) s += l[1] * Math.sin(l[0] * th + l[2]);
    OT[i] = OT[i]! * s;
  }
  const outline = (th: number): number => {
    const f = (((((th + Math.PI) / TAU2) % 1) + 1) % 1) * OTN - 0.5;
    const i = Math.floor(f);
    const u = f - i;
    return OT[(i + OTN) % OTN]! * (1 - u) + OT[(i + 1 + OTN) % OTN]! * u;
  };
  let Rmax = 0;
  let area = 0;
  for (let i = 0; i < OTN; i++) {
    Rmax = Math.max(Rmax, OT[i]!);
    area += (0.5 * OT[i]! * OT[i]! * TAU2) / OTN;
  }
  let S = Rmax * 1.04;
  const inIsland = (x: number, z: number): boolean =>
    x * x + z * z < OT[(((Math.atan2(z, x) + Math.PI) / TAU2) * OTN) | 0]! ** 2;
  const edgeR = (x: number, z: number): number =>
    OT[(((Math.atan2(z, x) + Math.PI) / TAU2) * OTN) | 0]! - Math.hypot(x, z);

  /* hazards sit beside the green, outside its edge, never on it (disabled: HAZARDS_ON = false) */
  const hazards: Hazard[] = [];
  const outlineAt = outline;
  for (const sp of HAZARDS_ON ? spec : []) {
    const R0 = outlineAt(sp.th);
    const p0 = { x: Math.cos(sp.th) * R0, z: Math.sin(sp.th) * R0 };
    const e = 0.02;
    const pa = [Math.cos(sp.th - e) * outlineAt(sp.th - e), Math.sin(sp.th - e) * outlineAt(sp.th - e)] as const;
    const pb = [Math.cos(sp.th + e) * outlineAt(sp.th + e), Math.sin(sp.th + e) * outlineAt(sp.th + e)] as const;
    let Tx = pb[0] - pa[0];
    let Tz = pb[1] - pa[1];
    const tl = Math.hypot(Tx, Tz) || 1;
    Tx /= tl;
    Tz /= tl;
    let nx = Tz;
    let nz = -Tx;
    if (nx * p0.x + nz * p0.z < 0) {
      nx = -nx;
      nz = -nz;
    }
    const ph = U(0, 6.283);
    const hz: Hazard = {
      ap: sp.kind === 'water' ? 1.18 : 1.3,
      kind: sp.kind,
      aT: sp.aT,
      aN: sp.aN,
      Tx,
      Tz,
      nx,
      nz,
      ph,
      d: sp.kind === 'water' ? 0.12 : U(0.16, 0.21),
      cx: 0,
      cz: 0,
    };
    let gap = 0.25;
    let ok = false;
    for (let k = 0; k < 16 && !ok; k++) {
      hz.cx = p0.x + nx * (gap + sp.aN);
      hz.cz = p0.z + nz * (gap + sp.aN);
      ok = true;
      for (let a = 0; a < 40; a++) {
        const f = (a / 40) * TAU2;
        const u = Math.cos(f) * sp.aT * 1.02;
        const v = Math.sin(f) * sp.aN * 1.02;
        const x = hz.cx + Tx * u + nx * v;
        const z = hz.cz + Tz * u + nz * v;
        if (inIsland(x, z)) {
          ok = false;
          break;
        }
      }
      if (!ok) gap += 0.3;
    }
    if (!ok) continue;
    if (hazards.some((o) => Math.hypot(o.cx - hz.cx, o.cz - hz.cz) < 0.8 * (o.aT + hz.aT))) continue;
    hazards.push(hz);
  }
  const hq = (h: Hazard, x: number, z: number): number => {
    const dx = x - h.cx;
    const dz = z - h.cz;
    const u = (dx * h.Tx + dz * h.Tz) / h.aT;
    const v = (dx * h.nx + dz * h.nz) / h.aN;
    const f = Math.atan2(v, u);
    const w = 1 + 0.07 * Math.sin(3 * f + h.ph) + 0.04 * Math.sin(5 * f + 2 * h.ph);
    return (u * u + v * v) / (w * w);
  };
  const inKind = (k: Hazard['kind'], x: number, z: number): boolean => {
    for (const h of hazards) if (h.kind === k && hq(h, x, z) < 1) return true;
    return false;
  };
  const inSand = (x: number, z: number) => inKind('sand', x, z);
  const inWater = (x: number, z: number) => inKind('water', x, z);
  const inApron = (x: number, z: number): boolean => {
    for (const h of hazards) if (hq(h, x, z) < h.ap * h.ap) return true;
    return false;
  };
  // the sand and the dark ground around it: all one penalty area
  const inBunker = (x: number, z: number) => !inWater(x, z) && inApron(x, z);

  /* the drawn landmass: the green plus the ground around each hazard, as one smooth outline */
  const OV = OT.slice();
  for (let i = 0; i < OTN; i++) {
    const th = ((i + 0.5) / OTN) * TAU2 - Math.PI;
    const c = Math.cos(th);
    const sn = Math.sin(th);
    let t = OT[i]!;
    for (let u = OT[i]! + 0.1; u < OT[i]! + 14; u += 0.1) {
      if (inApron(c * u, sn * u)) {
        t = u;
      } else if (u - t > 0.8) break;
    }
    OV[i] = t;
  }
  for (let pass = 0; pass < 4; pass++) {
    const c = OV.slice();
    for (let i = 0; i < OTN; i++) {
      let a = 0;
      for (let k = -6; k <= 6; k++) a += c[(i + k + OTN) % OTN]!;
      OV[i] = Math.max(OT[i]!, a / 13);
    }
  }
  const vOutline = (th: number): number => {
    const f = (((((th + Math.PI) / TAU2) % 1) + 1) % 1) * OTN - 0.5;
    const i = Math.floor(f);
    const u = f - i;
    return OV[(i + OTN) % OTN]! * (1 - u) + OV[(i + 1 + OTN) % OTN]! * u;
  };
  let vRmax = 0;
  for (let i = 0; i < OTN; i++) vRmax = Math.max(vRmax, OV[i]!);
  S = Math.max(S, vRmax * 1.04);
  const dip = (x: number, z: number): number => {
    let v = 0;
    for (const h of hazards) {
      const q = hq(h, x, z);
      if (q < 1.6) {
        const t = 1 - q / 1.6;
        v -= h.d * t * t * (3 - 2 * t);
      }
    }
    return v;
  };

  /* contour: a gentle tilt, a few soft bumps, and the archetype's feature; sampled once onto a
     fine grid so the physics stays fast */
  const bumps: { x: number; z: number; s: number; a: number }[] = [];
  const nb = 1 + (r() < 0.5 ? 1 : 0) + (r() < 0.3 ? 1 : 0);
  for (let i = 0; i < nb; i++) {
    const a = r() * 6.283;
    const d = r() * 0.5 * Math.min(Rmax, 14);
    bumps.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, s: U(3.4, 6), a: sgn() * U(0.05, 0.12) });
  }
  const featFinal = feat;
  const raw = (x: number, z: number): number => {
    let v = tx * x + tz * z;
    for (const b of bumps) {
      const dx = x - b.x;
      const dz = z - b.z;
      v += b.a * Math.exp(-(dx * dx + dz * dz) / (2 * b.s * b.s));
    }
    if (featFinal) v += featFinal(x, z, edgeR(x, z));
    return v;
  };
  let ext = Rmax + 2;
  for (const h of hazards) ext = Math.max(ext, Math.abs(h.cx) + h.aT * 1.4 + 1, Math.abs(h.cz) + h.aT * 1.4 + 1);

  /* what the camera should frame: the green and its hazards together */
  const vp: [number, number][] = [];
  for (let i = 0; i < OTN; i += 20) {
    const th = ((i + 0.5) / OTN) * TAU2 - Math.PI;
    vp.push([Math.cos(th) * OT[i]!, Math.sin(th) * OT[i]!]);
  }
  for (const h of hazards)
    for (let a = 0; a < 24; a++) {
      const f = (a / 24) * TAU2;
      const u = Math.cos(f) * h.aT * 1.15;
      const v = Math.sin(f) * h.aN * 1.15;
      vp.push([h.cx + h.Tx * u + h.nx * v, h.cz + h.Tz * u + h.nz * v]);
    }
  let x0 = 1e9;
  let x1 = -1e9;
  let z0 = 1e9;
  let z1 = -1e9;
  for (const q of vp) {
    x0 = Math.min(x0, q[0]);
    x1 = Math.max(x1, q[0]);
    z0 = Math.min(z0, q[1]);
    z1 = Math.max(z1, q[1]);
  }
  const vcx = (x0 + x1) / 2;
  const vcz = (z0 + z1) / 2;
  let Rview = 0;
  for (const q of vp) Rview = Math.max(Rview, Math.hypot(q[0] - vcx, q[1] - vcz));

  const GS = 0.15;
  const GN = Math.ceil((2 * ext) / GS) + 1;
  const hg = new Float32Array(GN * GN);
  let mn = 1e9;
  for (let j = 0; j < GN; j++)
    for (let i = 0; i < GN; i++) {
      const x = -ext + i * GS;
      const z = -ext + j * GS;
      const v = raw(x, z);
      hg[j * GN + i] = v;
      if (inIsland(x, z) && v < mn) mn = v;
    }
  for (let k = 0; k < hg.length; k++) hg[k] = hg[k]! - mn;
  const gxg = new Float32Array(GN * GN);
  const gzg = new Float32Array(GN * GN);
  for (let j = 1; j < GN - 1; j++)
    for (let i = 1; i < GN - 1; i++) {
      gxg[j * GN + i] = (hg[j * GN + i + 1]! - hg[j * GN + i - 1]!) / (2 * GS);
      gzg[j * GN + i] = (hg[(j + 1) * GN + i]! - hg[(j - 1) * GN + i]!) / (2 * GS);
    }
  const bil = (A: Float32Array, x: number, z: number): number => {
    let fx = (x + ext) / GS;
    let fz = (z + ext) / GS;
    fx = fx < 0 ? 0 : fx > GN - 1.001 ? GN - 1.001 : fx;
    fz = fz < 0 ? 0 : fz > GN - 1.001 ? GN - 1.001 : fz;
    const i = fx | 0;
    const j = fz | 0;
    const u = fx - i;
    const v = fz - j;
    const o = j * GN + i;
    return (A[o]! * (1 - u) + A[o + 1]! * u) * (1 - v) + (A[o + GN]! * (1 - u) + A[o + GN + 1]! * u) * v;
  };
  const GR: [number, number] = [0, 0];
  const h = (x: number, z: number) => bil(hg, x, z);
  const grad = (x: number, z: number): Grad => {
    GR[0] = bil(gxg, x, z);
    GR[1] = bil(gzg, x, z);
    return GR;
  };
  const hv = (x: number, z: number) => h(x, z) + dip(x, z);

  /* the pin: on a slope of 3% or less, clear of the edge, and often tucked near a hazard */
  const hzDist = (x: number, z: number): number => {
    let m = 1e9;
    for (const hz of hazards)
      for (let a = 0; a < 24; a++) {
        const f = (a / 24) * TAU2;
        const u = Math.cos(f) * hz.aT;
        const v = Math.sin(f) * hz.aN;
        m = Math.min(m, Math.hypot(x - (hz.cx + hz.Tx * u + hz.nx * v), z - (hz.cz + hz.Tz * u + hz.nz * v)));
      }
    return m;
  };
  const wantNear = hazards.length > 0 && r() < 0.65;
  let pin: Point | null = null;
  for (let n = 0; n < 500 && !pin; n++) {
    const a = r() * 6.283;
    const ff = 0.08 + r() * 0.8;
    const ro = outline(a);
    const x = Math.cos(a) * ro * ff;
    const z = Math.sin(a) * ro * ff;
    if (!inside(x, z) && !inIsland(x, z)) continue;
    const eo = edgeR(x, z);
    const g = grad(x, z);
    const sl = Math.hypot(g[0], g[1]);
    const slMax = n < 300 ? 0.032 : 0.045;
    if (eo < (n < 400 ? 3.6 : 2.8) || sl > slMax) continue;
    if (wantNear && n < 300) {
      const dh = hzDist(x, z);
      if (dh < 3.5 || dh > 8.5) continue;
    }
    pin = { x, z };
  }
  if (!pin) pin = { x: 0, z: 0 };

  /* every club gets its turn: one club is picked evenly, then the pin sits 82% to 95% of its stock
     carry away, so it is always reachable */
  const cu = r() * CLUBS.length;
  const ck = Math.min(CLUBS.length - 1, Math.floor(cu));
  const pinYd = Math.round(CLUBS[ck]!.y * (0.82 + 0.13 * (cu - ck)));
  const pinM = pinYd / YD;
  const D = pin.z + Math.sqrt(Math.max(1, pinM * pinM - pin.x * pin.x));
  const stimp = Math.round((9.5 + r() * 2.5) * 2) / 2;
  const wmph = Math.round(5 + 15 * Math.pow(r(), 1.5));
  const wang = r() * 6.283;
  const wind: Wind = { mph: wmph, x: Math.cos(wang), z: Math.sin(wang) };

  return {
    seed: dateStr,
    type,
    waterAround,
    vOutline,
    inSand,
    R: Math.sqrt(area / Math.PI),
    area,
    Rmax,
    Rview,
    vcx,
    vcz,
    S,
    outline,
    h,
    hv,
    grad,
    inIsland,
    inBunker,
    inWater,
    hazards,
    hq,
    pin,
    edgeR,
    P: { x: 0, z: D },
    pinYd,
    stimp,
    wind,
    af: 5.5 / stimp,
  };
}
