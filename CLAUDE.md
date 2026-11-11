@AGENTS.md

# MK Akur8 — Claude Working Guide

## What This Is

Office Mario Kart grand prix tracker. Two separate UIs served from one Next.js app:

- **`/dashboard`** — TV/big screen leaderboard. Live-updating, read-only. Designed to run full-screen all day.
- **`/admin`** — Mobile web app. Submit GP results, manage players, view history. Phone-sized layout (`max-w-md`).

No user accounts, no multi-tenancy — the admin is behind one shared code (see Admin lock). Small office tool. Simplicity over robustness.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2.6, App Router, `src/` layout |
| UI | React 19, Tailwind CSS v4 (`@import "tailwindcss"` — not v3 syntax) |
| Animation | Framer Motion v12 |
| Database | Supabase (Postgres + realtime) |
| Type checking | TypeScript strict mode |

**Tailwind v4 note:** There is no `tailwind.config.js`. Styles live in `src/app/globals.css`. Arbitrary values like `bg-[#1a1a1a]` work. Class-based config does not.

---

## Environment Variables

All three must be set in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=        # public, used client-side and server-side
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # public, used client-side and server-side
SUPABASE_SERVICE_ROLE_KEY=       # server-only, bypasses RLS; falls back to anon if absent
ADMIN_CODE=                      # the code typed on /login (case-insensitive)
ADMIN_SESSION_SECRET=            # signs the 90-day admin cookie; changing it signs everyone out
```

## Admin lock

No auth, but **no anonymous writes**: `/admin` and every API route that writes (POST/PATCH/DELETE) need the `mk_admin` cookie, a signed expiry date set by `POST /api/auth/login` after the shared admin code (`src/lib/admin-auth.ts`). Checked twice: `src/proxy.ts` (Next 16's renamed middleware) and `requireAdmin(req)` at the top of each write route — **add it to every new write route**. Reads, the dashboard and realtime stay public.
The public anon key ships to every browser, so it is **read-only** at the database level (migration `20261106_lock_public_writes`: write grants revoked, old anon write policies set to `false`, avatar uploads go through `POST /api/players/[id]/avatar`). Never add an anon write policy or grant back.

---

## Database Schema

Managed entirely in Supabase. Tables:

**`players`** — one row per person
```
id              uuid PK
name            text
character_avatar text  (single emoji, e.g. "🦊")
rating          float  (mirror of the player's latest rating_changes.rating_after)
gp_played       int    (mirror of the latest rating_changes.gp_count)
archived_at     timestamptz null  (archived = hidden from live boards/lobby, history kept)
```

**`matches`** — one row per grand prix
```
id         uuid PK
played_at  timestamptz  (defaults to now())
```

**`race_results`** — one row per player per GP
```
id         uuid PK
match_id   uuid FK → matches
player_id  uuid FK → players
position   int  (1–24; positions not occupied by real players are bots, not stored)
```

**`position_points`** — lookup table, authoritative scoring
```
position   int PK  (1–24)
points     int
```
Positions 1–12 award 15/12/10/9/8/7/6/5/4/3/2/1 points. Positions 13–24 award 0. **Single source of truth** — no copy in code. Server code reads it directly; the client reads it via `api.scoring.get()` (`GET /api/scoring`).

**`scoring_settings`** — single row (`id = true`), every scoring parameter
```
season_elo_from   text  ('2026-06' — seasons from this month use the monthly Elo)
global_elo_from   text  ('2026-06' — global rating is the all-time Elo from this month; NULL = legacy average)
season_elo_start  int   (1500 — everyone's Elo on the 1st of each month, and on their first GP globally)
season_elo_k      int   (32   — max change per GP)
season_elo_scale  int   (400  — 400-point gap = 10:1 expected odds, as in chess)
season_min_gp     int   (5    — GPs in the month to be eligible to win it; below = provisional)
global_min_gp     int   (10   — GPs to be ranked globally; below = provisional)
global_prior, season_prior  (legacy average formula, unused while both *_elo_from are set)
```
**Scoring is Elo everywhere (decided 2026-11-02)** — no more 0–15 averages in the UI. Every pair of humans in a GP is a duel (finished ahead = 1, shared position = 0.5, bots ignored); change = K × Σ(score − expected) / opponents, expected = 1 / (1 + 10^((their − yours) / scale)). The season Elo resets to 1500 each month; the global Elo never resets. Provisional players (under the min GPs) are shown in an unnumbered "Not ranked yet / Not eligible yet" section, never on the podium — unless nobody is ranked yet, then it's one list with PROV tags.
Changing `scoring_settings` or `position_points` only affects GPs submitted **afterwards** — see the ledger below.

**`rating_changes`** — the frozen scoring ledger, one row per player per GP, written once when the GP is scored: position, points, running `total_points`/`gp_count`, `rating_before`/`rating_after`, and the season figures (`season` = YYYY-MM in America/Montreal, `season_points`/`season_gp`/`season_p1`/`season_rating`). Past rows are never recomputed when the rules change — **this is the core invariant: a formula change must only affect future GPs.**
Views: `season_standings` (each player's last ledger row per season, incl. `global_rating` at that point — used for tie-breaks) and `season_summaries` (GP count per season).

**DB functions** (execute revoked from anon/authenticated — call via the service-role server client):
- `submit_gp(p_results jsonb) → uuid` — inserts match + results + ledger rows in one transaction. `/api/matches` calls it.
- `delete_gp(p_match uuid)` — deletes the GP, then `rescore_from` it: every later GP is re-scored in order **with the current rules** (accepted trade-off).
- `score_gp`, `rescore_from`, `sync_player_ratings` — internals. To add a new formula, change `score_gp` (and add ledger columns for its state); old rows stay as they are.
- Never write `race_results` directly — there is no trigger anymore, so the ledger would not be updated.

`position_points` is only used for the informational `points`/`total_points` ledger columns now; ratings come from the Elo duels in `score_gp`. `season_kind` / `global_kind` on each ledger row record which formula scored it (`elo` or legacy `average`); `src/lib/format.ts` formats Elo as whole numbers.

---

## File Structure

```
src/
  app/
    layout.tsx                  # Root layout (Geist font, dark bg)
    page.tsx                    # Redirects → /dashboard
    globals.css                 # Tailwind v4 import + .neon-text utility
    dashboard/
      layout.tsx
      page.tsx                  # force-dynamic; renders <Leaderboard />
    admin/
      layout.tsx
      page.tsx                  # Tab shell: Submit / Players / Results
    api/
      players/route.ts          # GET (list), POST (create)
      players/[id]/route.ts     # GET (stats), PATCH (avatar / archived), DELETE (archives if the player has GPs)
      matches/route.ts          # POST (submit GP → rpc submit_gp)
      matches/[id]/route.ts     # GET (one GP: ranking + Elo changes + every recorded race), DELETE (rpc delete_gp — re-scores later GPs)
      history/route.ts          # GET (paginated match history, with each GP's tracks)
      scoring/route.ts          # GET (points table + priors from the DB)
      gp-breakdown/route.ts     # GET ?offset=N — per-duel Elo math of the N-th latest GP (replayed from the ledger)

  components/
    GPDetails.tsx               # One GP's final ranking + races, shared by the dashboard modal and the admin history
    dashboard/
      Leaderboard.tsx           # Main dashboard component (uses useLeaderboard)
      DashboardMenu.tsx         # The one ☰ Menu button that opens every dashboard modal — add new modals here, not as header buttons
      CelebrationOverlay.tsx    # GP winner celebration modal + fireworks
      PlayerModal.tsx           # Player stats modal (slide-up)
      RankingInfoModal.tsx      # Points table explainer modal
      GPMathModal.tsx           # "GP Math": every duel of a GP (expected, result, points), season/global
      GPHistoryModal.tsx        # "Last GPs": GP list (infinite scroll on scroll events — no IntersectionObserver on iOS 12) → GPDetails
    admin/
      SubmitTab.tsx             # Thin orchestrator — just wires useSubmitFlow to steps
      PlayersTab.tsx            # Add / delete players
      ResultsTab.tsx            # Rankings + paginated history
      submit/
        LobbyStep.tsx           # Step 1: select who raced (+ "Record each race" toggle)
        RacesStep.tsx           # Step 2 (optional): track + position of each racer, race by race
        PositionsStep.tsx       # Step 3: final GP ranking with the keypad (ties allowed) → submit
        PositionRows.tsx        # Player rows + 1–24 keypad, shared by steps 2 and 3
        SuccessStep.tsx         # Done screen

  hooks/
    useLeaderboard.ts           # All dashboard state: players, realtime, celebrations
    useSubmitFlow.ts            # 3-step wizard state + broadcast after submit
    useFireworks.ts             # Canvas particle animation

  lib/
    api.ts                      # Typed fetch client — all HTTP calls go through here
    supabase.ts                 # Client singleton (getSupabase)
    supabase-server.ts          # Server client factory (getServerSupabase)
    ranking.ts                  # compareRank() — the one ordering rule for every leaderboard
    season.ts                   # Server-only: loadSeasonData, seasonStandings, Montreal-time months
    ledger.ts                   # seasonRatingsBefore — season Elo before a GP (GP Math + GP details)

  types/
    index.ts                    # Shared interfaces (Player, HistoryEntry, PlayerStats, …)
```

---

## Data Flow

### Dashboard (read path)
```
useLeaderboard
  ├── initial fetch: api.players.list() + api.history.list()
  ├── realtime: supabase channel "leaderboard-live"
  │     ├── broadcast "gp_submitted" → immediate celebration + doFetch()
  │     ├── postgres_changes on players/race_results/matches → debounced doFetch (800ms)
  │     └── fallback polling: setInterval(doFetch, 15_000)
  └── state: players (RankedPlayer[]), celebrationWinner, loading, error
```

The 800 ms debounce lets all realtime events of a submission settle before fetching, so the leaderboard never shows a half-updated state. The 15 s poll is the real reliability workhorse — WebSockets drop on long-running office connections.

### Submit flow (write path)
```
useSubmitFlow
  step 1 (LobbyStep):   select which players raced → Set<playerId>
  step 2 (RacesStep):   optional, race by race
  step 3 (PositionsStep): GP position of each racer on a keypad (shared spots allowed) → POST /api/matches
                          → after API returns, broadcast "gp_submitted" on
                            "leaderboard-live" channel so dashboard celebrates instantly
  step 4 (SuccessStep):  confirmation
```

The broadcast happens _after_ `api.matches.submit()` resolves, meaning the DB is fully committed. This eliminates the race where the dashboard fetches and sees empty `race_results`.

---

## Key Patterns

### API client (`src/lib/api.ts`)
All HTTP calls go through `apiFetch`. Never call `fetch` directly in components or hooks.

```ts
api.players.list()
api.players.create(name, avatar)
api.players.delete(id)
api.players.stats(id)
api.matches.submit(results)
api.matches.get(id)                    // GP details
api.history.list({ limit?, offset? })  // pagination: limit≤50, offset≥0
```

### Supabase clients
- **Client components / hooks:** `getSupabase()` — lazy singleton, uses public anon key (read-only), for realtime subscriptions and nothing else.
- **API routes:** `getServerSupabase()` — new instance per request, uses service role key (bypasses RLS). Never import the client singleton in API routes.

### Supabase join type workaround
Supabase TypeScript types infer joined columns as `[]` arrays, but the JS client returns a single object for many-to-one FK joins. Always use a typed interface + double cast:

```ts
interface ResultRow {
  position: number;
  players: { name: string; character_avatar: string } | null;  // single object, NOT array
}
const rows = (data as unknown as ResultRow[]) ?? [];
const name = rows[0].players?.name;  // direct access, no [0]
```

### `params` in App Router API routes
Route params are a Promise in this Next.js version. Always `await` them:

```ts
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
```

### Ranking & seasons
- **Ordering:** every leaderboard sorts provisional players after ranked ones, then with `compareRank` (`src/lib/ranking.ts`): rating ↓, P1 count ↓, name. Elo seasons never use the global rating, not even for tie-breaks (legacy average seasons used it before name). Season winner = first row of `seasonStandings`, so the ranking and the winner can never disagree. `/api/players` returns `p1_count` and is pre-sorted.
- **Seasons** are calendar months in **`America/Montreal`** time (`toYearMonth` / `currentYearMonth` in `src/lib/season.ts`). Never slice ISO strings for months — that's UTC.
- **Row limit:** Supabase silently caps every select at 1000 rows. Any query over a growing table (`race_results`, `matches`) must go through `fetchAll` (`src/lib/fetch-all.ts`) with a stable `.order(...)`, ending in `id`.
- **Submitting a GP** is atomic (`submit_gp`), so empty GPs can't happen.
- **Race details (optional, branch `race-tracks`)**: tables `tracks` (40 Mario Kart World tracks, images in `public/tracks/*.jpg` — JPG because iOS 12 has no WebP), `gp_races` (GP, race 1–6, track) and `race_finishes` (race, player, position 1–24). Sent as `p_races` to `submit_gp(p_results, p_races default null)`; purely informational, never read by the Elo. Admin: "Record each race" toggle in the lobby → `RacesStep`; the in-progress GP is kept in localStorage (`mk-akur8:gp-draft`); the final ranking is pre-filled from Mario Kart World race points (`RACE_POINTS` in `src/lib/tracks.ts`). Stats need ≥ 3 races on a track (`MIN_TRACK_RACES`). Rollback: `supabase/rollback/20261104_race_tracks_down.sql` (run it in the SQL Editor — DROP hangs the MCP).
- **Archived players** are excluded from `/api/players` (use `?archived=1` to list them), the lobby and the current season, but stay in GP history and past seasons. Players with GPs are never hard-deleted.
- **Celebration:** only a latest GP *newer* than the last one seen is celebrated — deleting the latest GP must not re-celebrate the previous one.

### `RankedPlayer.rankDelta`
`useLeaderboard` exports `RankedPlayer` (extends `Player` with `rankDelta: number`). Positive = moved up, negative = moved down. Zero on first load or for new players.

Two refs drive this: `liveRanksRef` is overwritten on every settled fetch (always current); `frozenBaselineRef` is only updated when a new committed GP is detected — it captures `liveRanksRef` at that moment (pre-GP ranks). Deltas are calculated as `frozenBaselineRef[id] - newRank`, so they persist across polling cycles until the next GP arrives.

### `useSubmitFlow.goToPositions`
Call this instead of `setStep(3)` directly. With recorded races it pre-fills the final ranking 1…N from the race points; without, the ranking starts empty (a guessed order is too easy to submit by mistake). The ranking is `Record<playerId, position>`; Submit stays disabled until every racer has one.

### Celebration trigger
`lastMatchIdRef` stores the UUID of the last match displayed. On each `doFetch`:
1. If the latest match UUID changed AND `results.length > 0` → fire celebration.
2. If `results.length === 0` → `race_results` not yet committed; don't advance the ref (retry next fetch).
3. Use functional setState `prev => prev ?? winner` to prevent double-fire from concurrent calls.

`HistoryEntry.results` is returned pre-sorted by position ASC (best finisher first) — `results[0]` is always the race winner.

---

## Running the App

```bash
npm run dev      # http://localhost:3000 (TEST database)
npm run dev:prod # http://localhost:3000 (PROD database)
npm run build    # type-check + production build
npm run lint     # ESLint
npx tsc --noEmit # type-check only (fast)
```

After code changes, always run `npx tsc --noEmit` before declaring done. The project has no test suite.

**Test vs prod databases:** two Supabase projects. `npm run dev` uses the TEST project (`rqsvrwzgsutllzycyzmp`, creds in `.env.test`, loaded by `scripts/dev-test.mjs`); `npm run dev:prod` uses PROD (`znokolhvhdbwdlijclqp`, `.env.local`). Vercel Preview deploys use TEST, Production uses PROD. MCP servers: `supabase` = prod, `supabase-test` = test. Try schema changes on test first.

---

## Conventions

- **No comments** unless the why is non-obvious. Never describe what the code does.
- **No new API calls** outside `src/lib/api.ts`.
- **No direct Supabase queries** in components — API routes for mutations, `api.*` for everything else (except the realtime subscription in `useLeaderboard`, which must use the client directly).
- **Colors:** `#0a0a0a` (page bg), `#121212` (header/nav bg), `#1a1a1a` (card bg), `#2a2a2a` (border), `#00d4ff` (brand cyan).
- **Emojis as avatars:** stored as a single Unicode character in `character_avatar`. The avatar picker in `PlayersTab` has a fixed set; users can't type arbitrary emoji.
- **Positions 1–24:** bots occupy any position a real player doesn't. Only real player results are stored in `race_results`.
- **`"use client"`** at the top of every component and hook that uses React hooks or browser APIs.
- **`force-dynamic`** on the dashboard page (`export const dynamic = "force-dynamic"`) so it never caches.
