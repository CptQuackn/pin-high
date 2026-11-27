# Pin High

Daily golf decision game. One shot per hole on a fictional par-3 island green; the player is scored on the
decision (club, spin, shape, aim) against the best possible shot and a simulated typical player.

Read first: `docs/BRIEF.md` (target product, architecture, build order), `docs/DESIGN.md` (shot model and
scoring), `docs/SOURCES.md` (which numbers are sourced vs invented).

## Layout

- `packages/engine/` TypeScript engine (`@pin-high/engine`): seeded hole generator, shot physics, best-shot
  search, scoring. Shared by the client and, later, the server.
- `legacy/` the v118 prototype, frozen. It is the reference the engine is tested against. Don't edit it,
  except to keep it building.
- Planned: `apps/web` (Vite + TS client, phase 2), `apps/api` (phase 4).

## Commands

```bash
pnpm install
pnpm test            # engine: golden parity with v118 (~5 s) + physics calibration (~40 s)
pnpm --filter @pin-high/engine test:fast   # golden parity only
pnpm typecheck && pnpm lint && pnpm format:check
pnpm legacy:build    # rebuild the prototype into legacy/dist
```

## Engine rules (enforced by ESLint in packages/engine/src)

- Pure functions. No DOM, no `Date`, no `Math.random`, no I/O, no module-level mutable state.
  Every function takes the `Hole` explicitly.
- Seeded randomness only (`mulberry32(hashStr(...))`). RNG call order is part of the output: adding,
  removing or reordering an `r()` call changes every hole.
- Results must be bit-identical to v118 (`test/golden.test.ts`). Do not reformat arithmetic in ways that
  change evaluation order (e.g. `a*b/c` vs `a*(b/c)`); that changes float results.
- Intentional physics or generator changes: bump `ENGINE_VERSION`, update the thresholds in
  `test/physics.test.ts` if needed, and add a new golden file. Never regenerate `v118.json` to make a test pass.

## Decisions owned by Keven

Open questions in `docs/BRIEF.md` (daily reset time, round score format, invite codes vs accounts, backend
stack, rewarded ads, final name) are Keven's to decide, not the agent's.
