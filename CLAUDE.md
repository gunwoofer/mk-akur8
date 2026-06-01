@AGENTS.md

# MK Akur8 — Claude Working Guide

## What This Is

Office Mario Kart grand prix tracker. Two separate UIs served from one Next.js app:

- **`/dashboard`** — TV/big screen leaderboard. Live-updating, read-only. Designed to run full-screen all day.
- **`/admin`** — Mobile web app. Submit GP results, manage players, view history. Phone-sized layout (`max-w-md`).

No auth, no multi-tenancy. Small office tool. Simplicity over robustness.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2.6, App Router, `src/` layout |
| UI | React 19, Tailwind CSS v4 (`@import "tailwindcss"` — not v3 syntax) |
| Animation | Framer Motion v12 |
| Drag-and-drop | `@dnd-kit/core` v6 |
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
```

---

## Database Schema

Managed entirely in Supabase. Tables:

**`players`** — one row per person
```
id              uuid PK
name            text
character_avatar text  (single emoji, e.g. "🦊")
rating          float  (cumulative points, updated by DB trigger)
gp_played       int    (incremented by DB trigger)
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
Positions 1–12 award 15/12/10/9/8/7/6/5/4/3/2/1 points. Positions 13–24 award 0. This is mirrored client-side in `src/lib/points.ts` for display without an extra fetch.

**DB trigger:** After every `race_results` INSERT, a Postgres trigger recalculates `rating` and `gp_played` for all affected players.

Rating formula: `R = sum_points / (20 + gp_count)` — a Bayesian average with a fixed prior of 20 phantom zero-point games. Ratings live in [0, 15]; 15 is approached only by someone who wins every race. A newcomer finishing P1 once scores 15/21 ≈ 0.71, while a 34-GP player with solid results scores proportionally higher. The prior is intentionally strong: you need ~20 real GPs before your actual average dominates.

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
      players/[id]/route.ts     # GET (stats), DELETE
      matches/route.ts          # POST (submit GP)
      history/route.ts          # GET (paginated match history)
      seed/route.ts             # POST (insert sample data)

  components/
    dashboard/
      Leaderboard.tsx           # Main dashboard component (uses useLeaderboard)
      CelebrationOverlay.tsx    # GP winner celebration modal + fireworks
      PlayerModal.tsx           # Player stats modal (slide-up)
      RankingInfoModal.tsx      # Points table explainer modal
    admin/
      SubmitTab.tsx             # Thin orchestrator — just wires useSubmitFlow to steps
      PlayersTab.tsx            # Add / delete players
      ResultsTab.tsx            # Rankings + paginated history
      submit/
        LobbyStep.tsx           # Step 1: select who raced
        PositionsStep.tsx       # Step 2: DnD positions (wraps DndContext)
        SuccessStep.tsx         # Step 3: confirmation screen
        PositionSlot.tsx        # Single slot — both droppable AND draggable
        DraggablePlayer.tsx     # Bench chip — draggable only

  hooks/
    useLeaderboard.ts           # All dashboard state: players, realtime, celebrations
    useSubmitFlow.ts            # 3-step wizard state + broadcast after submit
    useFireworks.ts             # Canvas particle animation

  lib/
    api.ts                      # Typed fetch client — all HTTP calls go through here
    supabase.ts                 # Client singleton (getSupabase)
    supabase-server.ts          # Server client factory (getServerSupabase)
    points.ts                   # POINTS_TABLE + getPoints() — mirrors DB table

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

The 800 ms debounce lets the DB trigger finish updating all player ratings before fetching, so the leaderboard never shows a half-updated state. The 15 s poll is the real reliability workhorse — WebSockets drop on long-running office connections.

### Submit flow (write path)
```
useSubmitFlow
  step 1 (LobbyStep):   select which players raced → Set<playerId>
  step 2 (PositionsStep): drag-and-drop into 24 slots → POST /api/matches
                          → after API returns, broadcast "gp_submitted" on
                            "leaderboard-live" channel so dashboard celebrates instantly
  step 3 (SuccessStep):  confirmation
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
api.history.list({ limit?, offset? })  // pagination: limit≤50, offset≥0
api.seed.run()
```

### Supabase clients
- **Client components / hooks:** `getSupabase()` — lazy singleton, uses public anon key, for realtime subscriptions and nothing else.
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

### `RankedPlayer.rankDelta`
`useLeaderboard` exports `RankedPlayer` (extends `Player` with `rankDelta: number`). Positive = moved up, negative = moved down. Zero on first load or for new players.

Two refs drive this: `liveRanksRef` is overwritten on every settled fetch (always current); `frozenBaselineRef` is only updated when a new committed GP is detected — it captures `liveRanksRef` at that moment (pre-GP ranks). Deltas are calculated as `frozenBaselineRef[id] - newRank`, so they persist across polling cycles until the next GP arrives.

### `useSubmitFlow.goToPositions`
Call this instead of `setStep(2)` directly. It pre-fills the 24 slots with selected players sorted by current rating descending (best player in slot 1, etc.) so the admin only needs to make small adjustments for a typical race result. `benchPlayers` is derived from `selected` minus `placedIds`.

### Celebration trigger
`lastMatchIdRef` stores the UUID of the last match displayed. On each `doFetch`:
1. If the latest match UUID changed AND `results.length > 0` → fire celebration.
2. If `results.length === 0` → `race_results` not yet committed; don't advance the ref (retry next fetch).
3. Use functional setState `prev => prev ?? winner` to prevent double-fire from concurrent calls.

`HistoryEntry.results` is returned pre-sorted by position ASC (best finisher first) — `results[0]` is always the race winner.

### DnD slots — dual role
`PositionSlot` combines `useDraggable` and `useDroppable` on the same element. The ref must be merged manually:
```ts
const setRef = (el: HTMLElement | null) => { setDropRef(el); setDragRef(el); };
```
Disable dragging when slot is empty: `disabled: !player`. Always spread `listeners`/`attributes` conditionally.

---

## Running the App

```bash
npm run dev      # http://localhost:3000
npm run build    # type-check + production build
npm run lint     # ESLint
npx tsc --noEmit # type-check only (fast)
```

After code changes, always run `npx tsc --noEmit` before declaring done. The project has no test suite.

**Seed data:** Hit the "Seed" button in the admin header (or POST `/api/seed`) to insert 5 sample players and 10 GPs. The seed route refuses to run twice — delete the sample players first.

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
