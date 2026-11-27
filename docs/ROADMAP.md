# Roadmap and release plan

## Platform: web first, wrap for stores later
Recommendation (not verified against current store policies; check before relying on it):
1. **Launch as a web game at its own domain.** The core loop is a daily share; a link that opens and plays in seconds is
   worth more than store discovery, and web means no store review, no commission and instant fixes.
2. **Wrap with Capacitor for iOS and Android only when there is a reason**: push notifications and streak reminders (the
   weak spot of iOS web apps), store discovery, in-app purchases. Add something native so Apple does not treat it as a thin web wrapper.
3. Unity/Godot or native only if you want consoles or Steam. That is a rewrite and it loses link sharing.

Apple has a Small Business Program with a reduced commission (recalled as 15% under US$1M/year, not verified). Google Play fees not checked.

## Backend (needed before a real launch)
- Daily hole stays client-side (seed = date), but add server-side validation of the submitted decision (clubs, spin, shape, aim, day).
- Store results per day: `{day, anonId or initials, sel, aim, score, tier}`. Aggregates (average player, percentile, "typical player" calibrated on real play) replace the simulated typical player when there is enough data.
- Leaderboard: anonymous ID by default, optional initials. A daily lock so a day can only be submitted once.
- Anti-cheat: the engine is deterministic and `analyze` runs in the browser, so a cheater can always find the best shot. Accept it for casual play, or move scoring to the server (run `00-engine.js` in Node).
- Suggested stack given the existing skills: small Node or FastAPI service + Postgres, or a serverless DB (Supabase/Firebase). Untested.

## Money (fun first, income if possible)
Nothing here is researched; I did not look at ad networks, payouts or what daily games earn.
- Start free and ad-free; measure whether people return daily (streak retention) before monetising.
- Opt-in rewarded ads fit your "watch this to get..." idea, but the reward must not change the daily score or ranking.
  Candidates: a streak freeze, an extra practice hole, cosmetic unlocks (ball trail, theme). Avoid hints that reveal the best shot.
- Other options to evaluate: cosmetics shop, optional "supporter" subscription, sponsored hole (a brand on the fictional course). 
- Rewarded ads on web versus in an app wrapper work differently; research that before choosing.

## Gameplay backlog
- Make spin/shape matter more: landing zones, obstacles, swing dispersion, limited aim (see DESIGN.md known weaknesses).
- Shape moves the landing spot / start line instead of only the flight.
- Rim animation and lip-out for near misses; set 8i/9i/PW carries to tour values (160/148/136); weight wedges.
- Share image; real crowd averages; anonymous vs initials leaderboard.
- Verify on real devices: frame rate, dark theme, sound, haptics, confetti.
