# ChronoFlip Code Review Handoff — Round 7 Complete

> **For Claude Opus.** This document is the complete context needed to continue code review or begin new work on ChronoFlip's AWS migration. Read this before doing anything.

## What Is ChronoFlip

A speech timer PWA (React 19 + TypeScript + Vite + Tailwind). Users create events with timed segments that auto-advance during presentations. Features: 3D flip clock animations, per-segment color alerts, QR-code sharing for live viewer screens, scheduled auto-start.

## What Was Done: Firebase → AWS Migration + 7 Rounds of Security Review

The app was migrated from Firebase to AWS (Cognito + AppSync + DynamoDB). Over 7 iterative rounds of multi-agent Opus code review, every finding from CRITICAL to MEDIUM was fixed. The codebase is now clean.

### AWS Architecture

- **Auth:** Cognito User Pool (email+password, NEW_PASSWORD_REQUIRED challenge support)
- **API:** AppSync GraphQL (userPool auth for mutations, apiKey auth for public viewer reads)
- **Storage:** DynamoDB — two tables:
  - `UserEvents` (userId + eventId, stores serialized SpeechEvent JSON, updatedAt for sync)
  - `SharedEvents` + `TimerState` + `Commands` (shareId-keyed, TTL-enabled)
- **Hosting:** Amplify Hosting (auto-deploy from git)
- **Real-time:** AppSync WebSocket subscriptions (timer state + viewer commands)

### Files Reviewed (the "core" that was security-hardened)

| File | Role |
|---|---|
| `services/awsConfig.ts` | Amplify.configure() with required() env var validation |
| `services/authService.ts` | Cognito sign-in/out/getCurrentUser, error sanitization, challenge flow |
| `hooks/useAuth.ts` | Single auth state hook — Hub listener, mount guards, token refresh failure handling |
| `hooks/AuthContext.tsx` | React context for auth (avoids duplicate Hub listeners) |
| `components/AuthGate.tsx` | Auth gate — loading spinner, LoginScreen, or App (useMemo before returns) |
| `components/screens/LoginScreen.tsx` | Login form with rate limiting, NEW_PASSWORD challenge, sessionStorage lockout |
| `services/syncService.ts` | QR sharing: publish/subscribe timer state + viewer commands, share ID generation |
| `hooks/usePersistence.ts` | localStorage cache + DynamoDB sync (last-write-wins, deletion tracking) |
| `App.tsx` | Root component — state, CRUD, navigation, cloud save debounce, guard effects |
| `index.tsx` | Entry point — view route regex, lazy loading, StrictMode |
| `types.ts` | Core types + defaults + helpers |
| `services/graphql/*.ts` | GraphQL queries, mutations, subscriptions |

## What Was Fixed Across 7 Rounds (Key Items)

### Security (Rounds 1-3)
- **User enumeration prevention:** `UserNotFoundException` and `NotAuthorizedException` return identical messages
- **Error sanitization:** Raw Cognito errors never reach UI; console.warn logs only `err.name`
- **Share ID hardening:** Rejection sampling eliminates modulo bias, base58 charset excludes ambiguous chars
- **Input validation:** `isValidTimerState` validates all 11 fields with `Number.isFinite()`, enum checks; `isValidSharedEvent` validates segments with 200 cap, mode enum, non-negative finite duration
- **View route regex tightened** to `[A-HJ-NP-Za-km-z2-9]{4,16}` matching `SHARE_ID_RE`
- **Explicit field picking** in `publishTimerState`/`publishCommand` (no object spread to API)

### Auth & Session (Rounds 3-7)
- **Single auth instance** via AuthContext pattern (no duplicate Hub listeners)
- **Token refresh failure** handled (`tokenRefresh_failure` → clear user)
- **Defensive signOut before signIn** clears lingering Cognito challenge state
- **useMemo before early returns** in AuthGate (Rules of Hooks)
- **Login rate limiting:** 5 attempts → 30s lockout, persisted in sessionStorage, live countdown
- **Password cleared on lockout** and on failed NEW_PASSWORD challenge

### Sync & Persistence (Rounds 4-7)
- **Last-write-wins** with `updatedAt` on every mutation (updateEvent, addSegment, updateSegment, deleteSegment, reorderSegments, exitTimer, handleScheduleStart)
- **Deletion tracking:** localStorage tombstones with 30-day TTL, cloud cleanup on sync
- **Post-sync prevEventsRef reset:** Prevents cloud-won events from being re-detected as "changed"
- **Pending saves persistence:** beforeunload → localStorage queue, replayed on next load
- **pendingSaveRef race fix:** Failed saves merged back preserving newer entries
- **Lazy client initialization:** `getSyncClient()`/`getClient()` ensure Amplify.configure() ran first
- **Client reset on sign-out:** Prevents stale auth context across sessions
- **Dual-writer race fix:** Removed `saveEventsToCache` from `syncEvents` (App.tsx effect handles it)

### Guard Effects (Rounds 6-7)
- **timerRunning guard:** Redirects to eventList if running event deleted by sync (prevents blank stuck screen)
- **eventSettings guard:** Redirects to eventList if active event deleted
- **segmentSettings guard:** Smart redirect — eventList if event gone, eventSettings if only segment gone
- **navigateTo clears stale IDs** on eventList/eventSettings transitions

### Subscription Resilience (Round 4)
- **Exponential backoff:** 3s → 30s cap, retryCount capped at 10
- **Cleanup before reconnect:** `sub?.unsubscribe()` called before creating new subscription
- **Publish segment cap** (200) enforced on write path matching read-path validator

## Remaining LOW Findings (Intentionally Not Fixed)

These were reviewed and classified as acceptable design decisions:

1. **Event reorder not synced to cloud** — Cloud stores individual events, not array order. Order is device-local via localStorage. Would need an `order` field on SpeechEvent to fix.
2. **`beforeunload` async saves likely killed by browser** — The localStorage fallback (`persistPendingSaves`) is the real safety net. The async calls are best-effort.
3. **`isValidSharedEvent` returns `SpeechEvent` type but object is missing `date`/`startTime`/`endTime`/`updatedAt`** — Viewer only uses `title` + `segments`. Could create a `SharedEventSummary` type for strictness.
4. **Redundant `instanceof` cast in `getAuthErrorMessage`** — Works correctly, just verbose.
5. **`awsConfig` apiKey `required()`** — Documented. App needs it for viewer feature.
6. **Routing evaluated once on load** — Correct for SPA with no client-side router.

## Build & Dev

```bash
npm install
npm run dev       # Port 3000
npm run build     # Verify: should produce ✓ built in ~2s with no errors
```

The build passes cleanly. Only pre-existing TypeScript warnings from Amplify's generated types (not our code).

## What To Do Next

### If continuing code review (Round 8+)
Run 5 parallel Opus agents reviewing these file groups:
1. `services/authService.ts` + `hooks/useAuth.ts` + `components/AuthGate.tsx`
2. `services/syncService.ts`
3. `hooks/usePersistence.ts` + `App.tsx`
4. `index.tsx` + `types.ts` + `hooks/AuthContext.tsx`
5. `components/screens/LoginScreen.tsx`

Expected: 0 critical, 0 high. Any mediums found will be increasingly speculative.

### If moving to new features / other work
The AWS migration is complete and hardened. Suggested next areas:
- **AWS backend review:** AppSync resolver authorization rules, DynamoDB TTL config, IAM policies
- **Manual E2E testing:** Delete event while timer runs, login after abandoned password challenge, offline/reconnect, cross-device sync
- **Consider:** Adding an `order` field to `SpeechEvent` for cross-device event ordering

## Current Branch & Git State

- **Branch:** `ver-4`
- **Status:** Clean (all changes committed through `2927477`)
- **Main branch:** `main`
