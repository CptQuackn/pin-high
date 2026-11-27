# Pin High: architecture and design brief

Nov 26, 2026 · @Keven

## Purpose

Pin High is a daily golf decision game. This brief takes the working one-hole prototype to a releasable 9-hole daily game with leaderboards, and it is the starting context for development in Claude Code.

How to use it in Claude Code:

- Unzip `pin-high-project.zip` into a new git repo and read its `README.md`, `docs/DESIGN.md` and `docs/SOURCES.md`. This brief adds the target product and architecture on top of them.
- Keep `npm test` (physics regression) green through every refactor. Today's tuned numbers are the reference.
- Treat the open questions at the end as decisions for Keven, not for the agent.

## Current state

The prototype is one playable daily hole, published as a Claude artifact (v118) and packaged as a repo. It has no server: holes are generated in the browser from the date, and results live in `localStorage`.

| Part | Where | Notes |
| --- | --- | --- |
| Engine (hole generator, shot physics, best-shot search) | `src/js/00-engine.js` | Pure logic, no DOM. Seeded by date (mulberry32). |
| 3D scene and UI | `src/js/10-` to `70-*.js` | three.js r128, shared global scope, concatenated in filename order |
| Build | `tools/build.js` | Writes `dist/index.html` (standalone), `dist/artifact.html` (byte-identical to v118), `dist/test.html` |
| Physics tests | `tests/physics/run-all.js` | Best shot holes out on 28 of 28 holes; spin/shape matter on 7 of 40 holes |
| Render smoke test | `tests/render/smoke.js` | Headless Chrome: aim, shoot, result card, no page errors |
| Docs | `docs/DESIGN.md`, `SOURCES.md`, `ROADMAP.md` | Shot model, scoring, sourced vs invented numbers |

Not verified yet: frame rate on real phones, dark theme, sound, haptics and confetti on a device.

## Decisions so far

The game scores the decision, not the swing: the shot model is deterministic, and each hole is scored against the best possible shot and a simulated typical player.

- **Concept:** fictional par-3 island greens. Read slope, green speed and wind; pick club, spin and shape; tap an aim spot; one shot.
- **Scoring:** each hole scores 60 to 1000, where about 500 is the typical player and 1000 matches the best shot. Tiers are Pro line (985), Dialed in (900), Sharp read (780), Solid (620), Decent (450), Costly (250) and Wrong read. A count-up, tier pop, confetti, sounds and haptics deliver the result.
- **Clubs:** 4i to LW. Launch angle, landing angle and peak height for 4i to PW come from TrackMan tour averages; GW, SW and LW are estimated.
- **Roll:** fitted to tour carry-vs-total roll (about 27 ft for 7i, 18 ft for PW, 15 ft for SW at standard spin). High spin checks and can roll back.
- **Wind:** 5 to 20 mph, mean about 11, chosen to sit in the range of NOAA city averages and Masters round means.
- **Cup:** 20% bigger than real, with a bevel funnel. A ball drops if it is slower than about 4 mph at the centre.
- **Shape:** draws and fades bow up to about 10 yd with a 7i, change landing angle 6% per step and roll 12% per step. The landing spot does not move.
- **Aim line:** white dashes from the tee to the aim ring along the real flight arc, fading in over the first half.
- **Platform:** web first so a shared link opens and plays in seconds; wrap with Capacitor for iOS and Android later, for push notifications and store purchases.
- **Money:** fun first, income if possible. Free at launch. Ads only as opt-in rewarded ads, and never anything that changes a daily score.

Known weakness: spin and shape rarely beat a plain shot. They save 0.11 strokes per hole on average and matter on about 7 of 40 holes, because free aim with no dispersion always leaves a plain line. Ideas not built yet: swing dispersion, landing zones, obstacles, limited aim.

## Product: the 9-hole daily round

Each day is a 9-hole course, one shot per hole, for a session of about 4 to 6 minutes instead of 30 seconds. Every player gets the same 9 holes that day.

**The daily course**

- Built as a course, not 9 random holes: about 2 wedge holes, 3 short irons, 3 mid irons and 1 long iron, so a round uses the whole bag.
- Wind, green shape and slope vary hole to hole, with a difficulty curve (for example, the hardest hole last).
- One attempt per hole, locked once you shoot. A round in progress resumes after a refresh, and on another device once accounts exist.

**Scoring**

- Each hole shows its own score and tier right after the shot, as today.
- The round shows a total (out of 9,000, or an average per hole) plus the holes where you lost the most points.
- With real players, each hole can also show the crowd average and your percentile.

**Sharing**

- One share card for the whole round: the day number, the total, and one coloured square per hole by tier.
- It must paste cleanly as text in chats, as Wordle's grid does. A share image is optional later.

**Leaderboards**

- Global daily, friends daily, and streaks or all-time.
- Friends join through an invite link or code; no contact-list access.

**Practice**

- A separate mode with unlimited random holes. It never touches the daily score or leaderboards.
- Candidate home for opt-in rewarded ads: watch an ad for an extra practice round, a streak freeze or a cosmetic (ball trail, theme). Not researched yet: ad networks, payouts, and how rewarded ads differ on web versus in an app.

## Architecture

One TypeScript engine runs in both the browser and the server; the server is authoritative for holes and scores.

&#91;embedded content: target architecture · 5 parts\]

The client draws and animates; the API sends each day's holes as data, re-runs every submitted shot with the same engine and stores the official score; a daily job builds the next course and precomputes each hole's best shot and typical-player cost, which are too slow to compute in the browser for 9 holes.

**Stack.** TypeScript end to end, with Vite for the client, Node (Fastify or Hono) for the API, and Postgres. Keven's strongest backend tool is FastAPI; it works too, but then the engine needs a separate Node worker, because sharing the exact same engine code is what makes server scoring match what players see.

**Engine rules.** Pure functions, no DOM, no clock, seeded randomness only. Every round and shot stores the engine version.

## Data model and API

A first pass in Postgres: five tables, and shots are the source of truth for every score.

| Table | Key columns | Notes |
| --- | --- | --- |
| `players` | id, display name or initials, created\_at, auth provider (nullable) | Anonymous by default; sign-in added later for cross-device play |
| `rounds` | day, course seed, holes (JSON: geometry, pin, wind, stimp), best shot and typical-player cost per hole, engine version | Written by the daily job before the day starts |
| `shots` | player, day, hole number, club, spin, shape, aim x/z, outcome, cost, score, created\_at | Unique on (player, day, hole): one attempt per hole |
| `round_results` | player, day, total, holes played, finished\_at | Feeds leaderboards and streaks |
| `friendships` | player, friend, invite code, created\_at | Built from invite links |

| Endpoint | Does |
| --- | --- |
| `GET /rounds/today` | Today's 9 holes as data (no best shots). Optionally one hole at a time |
| `POST /shots` | Validates the decision, re-runs the shot with the engine, stores and returns the score and outcome |
| `GET /rounds/today/me` | The player's progress, so a round resumes |
| `GET /leaderboards/:day?scope=global` (or `friends`) | Ranked totals |
| `POST /friends/invite`, `POST /friends/accept` | Invite code flow |
| `GET /practice/hole?seed=` | A random practice hole; no scoring stored |

Store `engine version` on every round and shot, so a physics change never rescores past days.

## Fairness: determinism, cheating, daily reset

The server owns every hole and every official score; the browser only draws and animates.

**Determinism.** Today each browser rebuilds the hole from the date. `Math.sin`, `Math.exp` and similar functions are not guaranteed to return identical bits across JavaScript engines, so Safari and Chrome could build slightly different greens. Not tested; it is a known JavaScript caveat. The fix is that the server generates holes and sends them as data, and the server re-runs each submitted shot to score it.

**Cheating.** The client must receive the hole data, so anyone can run the engine offline and find the best shot. It cannot be fully prevented. Mitigations:

- Send each hole only after the previous shot is submitted.
- Flag rounds that are implausibly perfect for review or a separate board.
- Make the friends leaderboard the main one, where cheating matters less.

**Daily reset.** Undecided. One global reset time keeps leaderboards simple; each player's local midnight (as Wordle does) feels more natural but complicates a global daily ranking.

## Build order

Each phase ends playable, and `npm test` stays green throughout.

1. **Engine package.** Move `00-engine.js` into a typed, pure TypeScript package with no DOM. Port the physics tests and confirm the numbers match v118.
2. **Client on Vite + TypeScript.** Move the scene and UI files into modules that import the engine. Keep the visuals and feel identical.
3. **9-hole round, offline.** Course generator (club spread, difficulty curve), round flow, per-hole and total scoring, round share text.
4. **API and database.** Players (anonymous), rounds, shots, server-side scoring, daily precompute job, resume a round.
5. **Leaderboards and friends.** Global and friends daily boards, invite codes, streaks.
6. **Practice mode**, then decide on rewarded ads.
7. **Release on web**, then wrap with Capacitor for iOS and Android with push reminders for streaks.

Alongside, from the gameplay backlog: make spin and shape matter (landing zones, obstacles, dispersion), a lip-out animation for near misses, and testing on real phones.

## Open questions for Keven

- [ ] Daily reset: one global time, or each player's local midnight?
- [ ] Round score: total out of 9,000, or average per hole?
- [ ] Friends: simple invite codes, or full accounts with sign-in?
- [ ] Backend: TypeScript end to end (recommended), or FastAPI with a Node worker for the engine?
- [ ] Rewarded ads: which rewards, and on web or only in the app versions?
- [ ] Final name (Pin High is a placeholder).
