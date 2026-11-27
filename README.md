# Pin High (working title)

A daily, Wordle-style golf decision game. Everyone gets the same fictional par-3 island greens each day. Read the
slope, green speed and wind, pick club, spin and shape, tap an aim spot, and take one shot. You're scored on the
quality of the decision, not on swing timing.

Status: playable one-hole prototype (v118, in `legacy/`), being rebuilt into a 9-hole daily game. See
[`docs/BRIEF.md`](docs/BRIEF.md) for the plan.

## Repository

| Path              | What                                                                             |
| ----------------- | -------------------------------------------------------------------------------- |
| `packages/engine` | TypeScript game engine: holes, physics, best-shot search, scoring. Pure, tested. |
| `legacy/`         | The v118 prototype (single-page three.js app). Frozen reference.                 |
| `docs/`           | Brief, design, data sources, roadmap.                                            |

## Develop

Requires Node 20+ and pnpm 10 (`corepack enable`).

```bash
pnpm install
pnpm test                 # golden parity with v118 + physics calibration
pnpm typecheck && pnpm lint
pnpm legacy:build         # build the prototype; open legacy/dist/index.html
```
