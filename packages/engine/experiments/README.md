# Experiments

Exploration code, not part of the engine or its tests.

`spin-shape.ts` compares mechanics that could make spin and shape matter. For each variant it finds the
best shot on 40 holes (weekly from 2026-03-01), with and without spin/shape, and reports the strokes saved.
Raw output for each variant (40 holes, 2026-11-27) is in `results/`.

| Variant                                  | Mean strokes saved | Holes > 0.1 | Holes > 0.25 | Typical-player cost | Best shot holes out         |
| ---------------------------------------- | ------------------ | ----------- | ------------ | ------------------- | --------------------------- |
| baseline (v118): free aim, no dispersion | 0.113              | 7 / 40      | 6            | 1.06                | 40 / 40                     |
| dispersion DISP=0.5                      | 0.212              | 21 / 40     | 15           | 0.93                | 21 / 40                     |
| dispersion DISP=1                        | 0.209              | 28 / 40     | 11           | 0.82                | 5 / 40                      |
| fixed carry, full swing only             | 0.303              | 17 / 39     | 15           | 1.16                | 31 / 39 (1 hole unplayable) |
| fixed carry, full / 90% / 80% swing      | 0.278              | 15 / 40     | 13           | 1.41                | 40 / 40                     |
| fixed carry + shape ±3%, spin ±2% carry  | 0.431              | 19 / 39     | 17           | 1.33                | 36 / 39 (1 hole unplayable) |

Run from `packages/engine`:

```bash
node ../../node_modules/.pnpm/vite-node@*/node_modules/vite-node/vite-node.mjs experiments/spin-shape.ts -- disp1 40
```
