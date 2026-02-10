# ChronoFlip Pre-Deployment Verification Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Systematically audit, fix, and verify all existing ChronoFlip features before Vercel deployment.

**Architecture:** Code review + targeted bug fixes + build verification. No new features - only fix what's broken and confirm what works. Each task audits one area, documents findings, fixes issues, and verifies the fix.

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, Tailwind CSS (CDN), Web Audio API

---

## Task 1: Build Verification & Dependency Audit

**Files:**
- Read: `package.json`
- Read: `vite.config.ts`
- Read: `tsconfig.json`
- Read: `index.html`

**Step 1: Clean install and build**

Run:
```bash
cd C:\Users\yashr\Downloads\chronoflip
rm -rf node_modules dist
npm install
```
Expected: No warnings about peer dependency conflicts. No deprecated package warnings.

**Step 2: Run production build**

Run:
```bash
npm run build
```
Expected: Build succeeds with zero errors and zero TypeScript errors. Output in `dist/`.

**Step 3: Verify dist output contains all required files**

Run:
```bash
ls dist/
ls dist/assets/
ls dist/sounds/
```
Expected:
- `dist/index.html` exists
- `dist/assets/` contains JS and CSS bundles
- `dist/sounds/tick.mp3` and `dist/sounds/my-alarm.mp3` exist (copied from public)
- `dist/manifest.webmanifest` exists
- `dist/sw.js` exists
- `dist/favicon.ico`, `dist/icon-192.png`, `dist/icon-512.png` exist

**Step 4: Preview production build**

Run:
```bash
npm run preview
```
Expected: Server starts. Open http://localhost:4173 in browser - app loads with no console errors.

**Step 5: Commit (if any fixes were needed)**

```bash
git add -A && git commit -m "fix: resolve build issues"
```

---

## Task 2: Fix Critical Bug - Audio Element Memory Leak in audioService

**Files:**
- Modify: `services/audioService.ts`

**Step 1: Audit the tick sound memory leak**

Read `services/audioService.ts` and locate the `playTick()` method. The issue: every call creates a new `Audio()` element. These accumulate in memory because:
- The `currentAudio` reference only tracks the last one
- Previous Audio objects are orphaned (still loaded, never garbage collected until playback ends)
- The 200ms timeout to stop playback may not fire reliably

**Step 2: Fix playTick to reuse a single Audio element**

In `services/audioService.ts`, refactor `playTick()` to reuse a single persistent Audio element for tick sounds. Add a dedicated `tickAudio` property to the class:

```typescript
// Add as class property alongside currentAudio
private tickAudio: HTMLAudioElement | null = null;
```

In `playTick()`, reuse this element:
```typescript
private async playTick(): Promise<void> {
  try {
    if (!this.tickAudio) {
      this.tickAudio = new Audio('/sounds/tick.mp3');
      this.tickAudio.volume = this.volume;
    }
    this.tickAudio.currentTime = 0;
    this.tickAudio.volume = this.volume;
    await this.tickAudio.play();
    setTimeout(() => {
      if (this.tickAudio) {
        this.tickAudio.pause();
        this.tickAudio.currentTime = 0;
      }
    }, 200);
  } catch (err) {
    // Fallback to synthesized tick if file fails
    this.playSynthesizedTick();
  }
}
```

**Step 3: Fix playCustom to clean up previous audio**

In `playCustom()`, ensure previous custom audio is stopped before playing new one:
```typescript
async playCustom(url: string): Promise<void> {
  // Stop any currently playing custom audio first
  if (this.currentAudio) {
    this.currentAudio.pause();
    this.currentAudio.currentTime = 0;
    this.currentAudio = null;
  }
  // ... rest of implementation
}
```

**Step 4: Add stop() cleanup for tickAudio**

In the `stop()` method, also stop the tick audio:
```typescript
stop(): void {
  if (this.currentAudio) {
    this.currentAudio.pause();
    this.currentAudio.currentTime = 0;
    this.currentAudio = null;
  }
  if (this.tickAudio) {
    this.tickAudio.pause();
    this.tickAudio.currentTime = 0;
  }
}
```

**Step 5: Build and verify no TypeScript errors**

Run:
```bash
npm run build
```
Expected: Build succeeds with zero errors.

**Step 6: Commit**

```bash
git add services/audioService.ts
git commit -m "fix: prevent audio element memory leak in tick/custom playback"
```

---

## Task 3: Fix Critical Bug - Unhandled Promise in Timer Completion

**Files:**
- Modify: `components/FlipClockTimer.tsx`

**Step 1: Audit all unhandled audioService.playCustom() calls**

Read `components/FlipClockTimer.tsx`. Search for `playCustom`. These calls return Promises but are not awaited or caught. If the audio file fails to load (network error, 404), the promise rejection is unhandled. The user gets zero feedback that the timer completed.

Locations to fix (approximate lines):
- Countdown completion block (around line 328)
- Hybrid mode countdown-to-zero transition (around line 337)

**Step 2: Add error handling to playCustom calls**

Wrap each `audioService.playCustom()` call with `.catch()`:

```typescript
// Before (broken):
audioService.playCustom('/sounds/my-alarm.mp3');

// After (safe):
audioService.playCustom('/sounds/my-alarm.mp3').catch(() => {
  audioService.play('finish');
});
```

This ensures: if the custom sound file fails, the synthesized finish sound plays as fallback.

**Step 3: Build and verify**

Run:
```bash
npm run build
```
Expected: Zero errors.

**Step 4: Commit**

```bash
git add components/FlipClockTimer.tsx
git commit -m "fix: add fallback audio on custom sound failure during completion"
```

---

## Task 4: Fix Bug - Dark Mode Not Persisted Across Sessions

**Files:**
- Modify: `App.tsx`

**Step 1: Audit current dark mode behavior**

Read `App.tsx`. Current behavior:
- On mount, checks `prefers-color-scheme: dark` media query
- Sets state from system preference
- Does NOT save user's manual toggle to localStorage
- Does NOT listen for system preference changes after mount

Result: If user manually toggles dark mode, preference is lost on page reload.

**Step 2: Add localStorage persistence for dark mode**

```typescript
const [darkMode, setDarkMode] = useState<boolean>(() => {
  const saved = localStorage.getItem('chronoflip-darkmode');
  if (saved !== null) return saved === 'true';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
});
```

**Step 3: Save dark mode preference on toggle**

In the toggle handler or a useEffect watching `darkMode`:
```typescript
useEffect(() => {
  localStorage.setItem('chronoflip-darkmode', String(darkMode));
  // ... existing class manipulation
}, [darkMode]);
```

**Step 4: Add system preference change listener**

Only apply if user hasn't manually set a preference:
```typescript
useEffect(() => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e: MediaQueryListEvent) => {
    if (localStorage.getItem('chronoflip-darkmode') === null) {
      setDarkMode(e.matches);
    }
  };
  mediaQuery.addEventListener('change', handler);
  return () => mediaQuery.removeEventListener('change', handler);
}, []);
```

**Step 5: Build and verify**

Run:
```bash
npm run build
```
Expected: Zero errors.

**Step 6: Commit**

```bash
git add App.tsx
git commit -m "fix: persist dark mode preference in localStorage"
```

---

## Task 5: Fix Bug - FlipDigit and FlipClockDisplay Missing React.memo

**Files:**
- Modify: `components/FlipDigit.tsx`
- Modify: `components/FlipClockDisplay.tsx`

**Step 1: Audit current memoization**

Read both files. CLAUDE.md states both should use `React.memo()` for performance, but neither actually does. This means every parent re-render (100ms interval ticks) causes all digits to re-render even when their value hasn't changed.

**Step 2: Wrap FlipDigit in React.memo**

At the bottom of `FlipDigit.tsx`, change the export:
```typescript
// Before:
export default FlipDigit;

// After:
export default React.memo(FlipDigit);
```

**Step 3: Wrap FlipClockDisplay in React.memo**

At the bottom of `FlipClockDisplay.tsx`, change the export:
```typescript
// Before:
export default FlipClockDisplay;

// After:
export default React.memo(FlipClockDisplay);
```

**Step 4: Build and verify**

Run:
```bash
npm run build
```
Expected: Zero errors.

**Step 5: Commit**

```bash
git add components/FlipDigit.tsx components/FlipClockDisplay.tsx
git commit -m "perf: add React.memo to FlipDigit and FlipClockDisplay"
```

---

## Task 6: Fix Bug - Color Alert Sorting on Every Tick

**Files:**
- Modify: `components/FlipClockTimer.tsx`

**Step 1: Audit checkColorAlerts performance**

Read `FlipClockTimer.tsx`, find the `checkColorAlerts` useCallback. It sorts `config.colorAlerts` on every call (every 100ms tick). For 3 alerts this is negligible, but it's wasteful and easy to fix.

**Step 2: Memoize sorted alerts**

Add a useMemo above the checkColorAlerts callback:

```typescript
const sortedAlerts = useMemo(
  () => [...config.colorAlerts].sort((a, b) => a.timeInSeconds - b.timeInSeconds),
  [config.colorAlerts]
);
```

Then update `checkColorAlerts` to use `sortedAlerts` instead of sorting inline.

**Step 3: Build and verify**

Run:
```bash
npm run build
```
Expected: Zero errors.

**Step 4: Commit**

```bash
git add components/FlipClockTimer.tsx
git commit -m "perf: memoize sorted color alerts to avoid re-sorting on every tick"
```

---

## Task 7: PWA Manifest & Service Worker Verification

**Files:**
- Read: `public/manifest.webmanifest`
- Read: `public/sw.js`
- Read: `index.html`

**Step 1: Validate manifest fields**

Read `public/manifest.webmanifest`. Verify:
- [x] `name` and `short_name` are present and reasonable length
- [x] `start_url` is `/` (correct for Vercel)
- [x] `display` is `standalone`
- [x] `theme_color` and `background_color` are valid hex colors
- [x] Icons include both 192x192 and 512x512
- [x] Icon `purpose` includes `maskable`

**Known issue with manifest:** The `purpose` field uses `"any maskable"` (space-separated) which is valid per the W3C spec but some older tools flag it. Modern browsers handle this correctly.

**Step 2: Validate service worker caching strategy**

Read `public/sw.js`. Verify:
- Cache name is versioned (`chronoflip-v2`)
- Install event caches core routes (`/`, `/index.html`)
- Activate event cleans old caches
- Fetch handler only intercepts same-origin GET requests
- External CDN requests (Tailwind, Google Fonts) are NOT cached (correct - they have their own caching)

**Potential issue:** The service worker caches `/` and `/index.html` but NOT the JS/CSS bundles in `/assets/`. This means:
- First load: network fetches everything, caches index.html
- Offline: serves cached index.html, but JS/CSS may fail if not in browser cache
- This is actually fine for Vercel since Vercel handles caching at the CDN level

**Step 3: Verify all PWA meta tags in index.html**

Read `index.html` and verify these tags exist:
- `<meta name="theme-color">`
- `<meta name="mobile-web-app-capable">`
- `<meta name="apple-mobile-web-app-capable">`
- `<meta name="apple-mobile-web-app-status-bar-style">`
- `<link rel="manifest">`
- `<link rel="apple-touch-icon">`

**Step 4: Verify icon files exist and are valid**

Run:
```bash
ls -la C:\Users\yashr\Downloads\chronoflip\public\favicon.ico
ls -la C:\Users\yashr\Downloads\chronoflip\public\icon-192.png
ls -la C:\Users\yashr\Downloads\chronoflip\public\icon-512.png
```
Expected: All three files exist and have reasonable sizes (>0 bytes).

**Step 5: Verify sound files exist**

Run:
```bash
ls -la C:\Users\yashr\Downloads\chronoflip\public\sounds\
```
Expected: `tick.mp3` and `my-alarm.mp3` both exist.

**Step 6: Run Lighthouse PWA audit (manual)**

After build, preview the app and run Chrome DevTools > Lighthouse > PWA audit.
Check for:
- Installable (manifest + service worker)
- Offline capability
- Icons are correct size
- Theme color matches

**Step 7: Document findings**

No code changes expected for this task unless issues are found. If service worker needs updates, fix and commit.

---

## Task 8: Fix Service Worker - Cache JS/CSS Bundles

**Files:**
- Modify: `public/sw.js`

**Step 1: Audit current caching strategy**

The current service worker only pre-caches `/` and `/index.html`. JS/CSS bundles with hashed filenames (e.g., `assets/index-BrYqFM6Y.js`) are NOT cached. This means offline support is incomplete.

**Step 2: Update fetch handler to cache all same-origin assets**

The fix is in the fetch handler - cache successful responses for ALL same-origin requests (not just pre-cached ones). Read the current `sw.js` fetch handler and verify it already does `cache.put()` for successful responses. If it does, the issue is only with the initial pre-cache (which is fine - bundles get cached on first visit).

If the fetch handler does NOT cache responses dynamically:

```javascript
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
      return cached || fetchPromise;
    })
  );
});
```

This is a "stale-while-revalidate" approach:
- Serve from cache immediately if available
- Fetch from network in background and update cache
- If not cached, wait for network response

**Step 3: Bump cache version**

Change cache name from `chronoflip-v2` to `chronoflip-v3` to force re-caching.

**Step 4: Build and verify**

Run:
```bash
npm run build
```

**Step 5: Commit**

```bash
git add public/sw.js
git commit -m "fix: improve service worker caching for offline support"
```

---

## Task 9: Verify Timer Modes - Countdown

**Files:**
- Read: `components/FlipClockTimer.tsx` (lines 284-358, handleStart, handlePause, handleReset)

**Step 1: Trace countdown logic end-to-end**

Read the main timer tick effect (around lines 284-358). Verify:
1. `remaining = initialTimeRef.current - elapsedSeconds` is calculated correctly
2. Timer stops when `remaining <= 0`
3. Status transitions: `idle` -> `running` -> `completed`
4. `audioService.playCustom('/sounds/my-alarm.mp3')` is called on completion
5. Wake lock is released on completion
6. Tab title updates correctly at each phase

**Step 2: Verify alert triggering during countdown**

Trace `checkColorAlerts()` logic:
1. Alerts sorted ascending by `timeInSeconds`
2. For countdown: first alert where `currentTime <= alert.timeInSeconds` is used
3. Alert sound plays exactly once per alert (via `triggeredAlertsRef`)
4. Flash effect lasts 500ms

**Step 3: Verify pause/resume preserves timing accuracy**

Trace:
1. `handlePause()` records `pausedAtRef.current = Date.now()`
2. `handleResume()` adds pause duration: `totalPausedMsRef.current += Date.now() - pausedAtRef.current`
3. Main tick: `elapsedMs = Date.now() - startTimeRef - totalPausedMsRef`
4. This correctly excludes paused time from elapsed calculation

**Step 4: Verify reset clears all state**

Trace `handleReset()`:
1. `audioService.stop()` called first (stops alarm sound)
2. `startTimeRef`, `pausedAtRef`, `totalPausedMsRef` all cleared
3. Status set to `idle`
4. Color class and flashing cleared
5. Wake lock released

**Step 5: Document findings (no code changes unless bugs found)**

---

## Task 10: Verify Timer Modes - Countup & Hybrid

**Files:**
- Read: `components/FlipClockTimer.tsx`

**Step 1: Trace countup logic**

In the main timer tick effect, verify countup branch:
1. `timeInSeconds = elapsedSeconds` (counts up from 0)
2. No completion state (runs indefinitely)
3. No color alerts apply (countup has no thresholds)
4. Tab title shows elapsed time

**Step 2: Trace hybrid mode logic**

Verify hybrid mode:
1. Starts as countdown (hybridPhase = 'countdown')
2. When remaining reaches 0:
   - `hybridPhase` switches to 'countup'
   - Alarm sound plays
   - Color changes to blue (hybrid indicator)
   - `triggeredAlertsRef` cleared
   - `elapsedAfterZero` starts counting
3. After zero: display shows `elapsedAfterZero` (counting up)
4. Status labels: "Ready" -> "Presentation" -> "Q&A" -> "Paused"

**Step 3: Verify display time calculation for hybrid**

Trace `displayTime` logic (around line 195):
- During countdown phase: shows remaining time
- During countup phase: shows `elapsedAfterZero`
- Verify the transition doesn't show a flicker (0 -> 1 jump)

**Step 4: Document findings**

---

## Task 11: Verify Keyboard Shortcuts

**Files:**
- Read: `components/FlipClockTimer.tsx` (lines 609-692)

**Step 1: Audit keyboard handler**

Read the keyboard effect and verify each shortcut:

| Key | Expected Behavior | Verify |
|-----|-------------------|--------|
| `Space` | Start when idle, pause when running, resume when paused | Check status transitions |
| `R` (keydown) | Start long-press progress when running, instant reset when idle | Check `rKeyHeldRef` logic |
| `R` (keyup) | Cancel long-press if released early | Check `handleResetMouseUp` |
| `S` | Toggle settings modal (timer mode only) | Check `showSettings` toggle |
| `F` | Toggle fullscreen | Check `toggleFullscreen` |
| `B` | Toggle blackout (running + timer mode only) | Check conditions |
| `C` | Toggle clock/timer mode | Check `appMode` toggle |
| `Escape` | Exit blackout > close settings > exit fullscreen (priority order) | Check cascade |

**Step 2: Verify input field protection**

Check that keyboard shortcuts are blocked when focus is on input fields:
```typescript
if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
  return;
}
```
This prevents Space from starting the timer while typing in settings.

**Step 3: Verify R key long-press doesn't fire repeatedly**

Check that `keydown` handler has `rKeyHeldRef.current` guard:
```typescript
if (e.key === 'r' && !rKeyHeldRef.current) {
  rKeyHeldRef.current = true;
  // start progress
}
```
Without this guard, keyboard repeat would restart the progress animation continuously.

**Step 4: Verify modifier key blocking**

Check that `Ctrl+F` and `Ctrl+C` are NOT intercepted (browser defaults should work):
- `F` handler should check `!e.ctrlKey && !e.metaKey`
- `C` handler should check `!e.ctrlKey && !e.metaKey`

**Step 5: Document findings**

---

## Task 12: Verify Settings Persistence (localStorage)

**Files:**
- Read: `components/FlipClockTimer.tsx` (loadConfig, saveConfig, config useEffect)
- Read: `components/TimerSettings.tsx`

**Step 1: Verify config load from localStorage**

Trace `loadConfig()` function:
1. Reads `chronoflip-config` from localStorage
2. Parses JSON
3. Falls back to defaults if parsing fails
4. Merges with defaults (handles missing fields from old versions)

**Step 2: Verify config save to localStorage**

Trace the config persistence useEffect:
```typescript
useEffect(() => {
  localStorage.setItem('chronoflip-config', JSON.stringify(config));
}, [config]);
```
Verify it saves on every config change.

**Step 3: Verify settings modal save flow**

In TimerSettings.tsx:
1. Modal opens with local copy of config
2. User edits local copy
3. "Done" button calls `onSave(localConfig)`
4. Parent (`FlipClockTimer`) updates config state
5. useEffect saves to localStorage

**Step 4: Test edge case - corrupted localStorage**

Verify that `loadConfig()` handles:
- Missing key (returns defaults)
- Invalid JSON (returns defaults)
- Partial config (merges with defaults)

**Step 5: Document findings**

---

## Task 13: Verify Fullscreen, Blackout, and Wake Lock

**Files:**
- Read: `components/FlipClockTimer.tsx`

**Step 1: Verify fullscreen toggle**

Trace `toggleFullscreen()`:
1. Uses `document.documentElement.requestFullscreen()` to enter
2. Uses `document.exitFullscreen()` to exit
3. Listens for `fullscreenchange` event to sync state
4. `F` key and button both call same function
5. Escape key exits fullscreen (browser default + custom handler)

**Step 2: Verify blackout mode**

Trace blackout logic:
1. Only available when `status === 'running'` and `appMode === 'timer'`
2. Renders full-screen black overlay at z-index 100
3. Any keydown event exits blackout (useEffect listener)
4. Click on overlay exits blackout
5. Timer continues running underneath
6. Audio still plays through overlay

**Step 3: Verify wake lock lifecycle**

Trace all wake lock request/release points:
- **Request**: timer start, resume, delay end, scheduled start
- **Release**: pause, reset, completion
- **Re-acquire**: visibility change (tab becomes visible while running)

Verify no leaked wake locks:
- Every `requestWakeLock()` path must have a corresponding `releaseWakeLock()` path
- Check: does the delay phase end request wake lock? (It should, since timer starts running)

**Step 4: Document findings**

---

## Task 14: Fix Potential Bug - Alert Exact-Second Match Can Miss

**Files:**
- Modify: `components/FlipClockTimer.tsx`

**Step 1: Audit alert triggering condition**

Read the `checkColorAlerts` function. Current logic:
```typescript
if (!triggeredAlertsRef.current.has(alert.id) && currentTime === alert.timeInSeconds)
```

This uses exact equality (`===`). If the timer interval skips a second (e.g., due to heavy CPU load, browser throttle recovery), the alert is missed entirely.

**Step 2: Fix with range-based triggering**

Change the trigger condition to use `<=` with a guard:

```typescript
if (!triggeredAlertsRef.current.has(alert.id) && currentTime <= alert.timeInSeconds) {
  triggeredAlertsRef.current.add(alert.id);
  // ... play sound, flash, etc.
}
```

Wait - this would trigger ALL alerts immediately if the timer starts above their thresholds. The correct fix is:

```typescript
// Trigger alert when time crosses the threshold (first time we see currentTime <= threshold)
if (!triggeredAlertsRef.current.has(alert.id) && currentTime <= alert.timeInSeconds && currentTime >= alert.timeInSeconds - 1) {
  triggeredAlertsRef.current.add(alert.id);
  // ... play sound, flash, etc.
}
```

Actually, the simplest correct fix: trigger when time is at OR just past the threshold:
```typescript
if (!triggeredAlertsRef.current.has(alert.id) && currentTime <= alert.timeInSeconds) {
  triggeredAlertsRef.current.add(alert.id);
  // Only play sound/flash for alerts at or just past their threshold
  if (alert.sound && config.playAlertSound) {
    audioService.play(alert.timeInSeconds <= 10 ? 'warning' : 'alert');
  }
  if (alert.flash) {
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 500);
  }
}
```

The `triggeredAlertsRef` prevents re-triggering, so `<=` is safe. The alert fires the first time the timer reaches or passes the threshold.

**Step 3: Build and verify**

Run:
```bash
npm run build
```
Expected: Zero errors.

**Step 4: Commit**

```bash
git add components/FlipClockTimer.tsx
git commit -m "fix: use range-based alert triggering to prevent missed alerts"
```

---

## Task 15: Fix Potential Bug - Color Alert ID Collision

**Files:**
- Modify: `components/TimerSettings.tsx`

**Step 1: Audit alert ID generation**

Read `TimerSettings.tsx`, find the "Add Alert" handler. Current ID generation:
```typescript
id: Date.now().toString()
```

If user clicks "Add Alert" twice in the same millisecond (fast double-click), both alerts get the same ID. This breaks `triggeredAlertsRef` (Set-based) and could cause the second alert to never trigger.

**Step 2: Fix with crypto.randomUUID or counter**

```typescript
id: crypto.randomUUID()
```

`crypto.randomUUID()` is supported in all modern browsers and generates a proper UUID v4. If targeting older browsers:
```typescript
id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
```

**Step 3: Build and verify**

Run:
```bash
npm run build
```
Expected: Zero errors.

**Step 4: Commit**

```bash
git add components/TimerSettings.tsx
git commit -m "fix: use crypto.randomUUID for alert IDs to prevent collisions"
```

---

## Task 16: Vercel Deployment Configuration

**Files:**
- Create: `vercel.json` (if needed)
- Read: `vite.config.ts`
- Read: `package.json`

**Step 1: Verify Vite build output is Vercel-compatible**

Vite outputs to `dist/` by default. Vercel auto-detects Vite projects and uses:
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

No `vercel.json` is needed for basic Vite deployments.

**Step 2: Verify no server-side config is needed**

ChronoFlip is a fully static SPA. Verify:
- No API routes
- No server-side rendering
- No environment variables needed at runtime
- All assets are in `public/` (copied to `dist/` at build time)

**Step 3: Check for SPA routing needs**

ChronoFlip is a single-page app with no client-side routing (no React Router). Every request should serve `index.html`. Vercel handles this automatically for Vite projects.

However, if the service worker or manifest requests fail with 404, create `vercel.json`:
```json
{
  "rewrites": [
    { "source": "/((?!assets|sounds|manifest|sw|icon|favicon).*)", "destination": "/index.html" }
  ]
}
```

Only create this if testing reveals 404s on direct navigation.

**Step 4: Verify environment variables**

Check `.env.local` - should NOT contain any required runtime variables. All config should be in code or localStorage.

Run:
```bash
cat .env.local
```
Expected: Empty or only development-time variables.

**Step 5: Verify .gitignore excludes sensitive files**

```bash
cat .gitignore
```
Verify `.env.local`, `node_modules/`, `dist/` are excluded.

**Step 6: Do a final production build**

```bash
npm run build
```
Expected: Clean build, no warnings, no errors.

**Step 7: Commit (if vercel.json was created)**

```bash
git add vercel.json
git commit -m "chore: add Vercel deployment config"
```

---

## Task 17: Final Integration Smoke Test

**Files:**
- All files (read-only verification)

**Step 1: Build and preview**

```bash
npm run build && npm run preview
```

**Step 2: Manual smoke test checklist**

Open the app at the preview URL and verify each item:

**Timer Basics:**
- [ ] App loads without console errors
- [ ] Default timer shows 05:00 (5 minutes)
- [ ] Preset buttons work (5m, 10m, 15m, 20m, 30m, 45m, 60m)
- [ ] Clicking 60m auto-enables hours display
- [ ] Start button begins countdown
- [ ] Pause button pauses (time freezes)
- [ ] Resume continues from paused time (no time skip)
- [ ] Reset (when idle) resets to initial time
- [ ] Reset (when running) requires 1.5s long-press
- [ ] Timer completion plays alarm sound
- [ ] Timer completion shows "Complete" status

**Timer Modes:**
- [ ] Countdown mode: counts down to 0, then stops
- [ ] Countup mode: counts up from 0 indefinitely
- [ ] Hybrid mode: countdown to 0, then switches to countup
- [ ] Hybrid shows "Presentation" during countdown, "Q&A" after zero

**Color Alerts (set a 1-minute timer):**
- [ ] At 10 seconds: red color, flash effect, sound
- [ ] Colors apply to all digits

**Audio:**
- [ ] Tick sound plays each second (when enabled)
- [ ] Alarm sound plays on completion
- [ ] Sounds can be toggled in settings
- [ ] Reset immediately stops alarm sound

**Keyboard Shortcuts:**
- [ ] Space: start/pause/resume
- [ ] R: reset (long-press when running)
- [ ] S: toggle settings
- [ ] F: toggle fullscreen
- [ ] B: toggle blackout (when running)
- [ ] C: toggle clock mode
- [ ] Escape: exit blackout/settings/fullscreen

**Clock Mode:**
- [ ] Shows current time
- [ ] Updates every second
- [ ] Tab title shows clock time

**Settings:**
- [ ] Modal opens/closes
- [ ] Time can be adjusted
- [ ] Mode can be changed
- [ ] Alerts can be added/removed/edited
- [ ] Settings persist after page reload

**Dark Mode:**
- [ ] Toggle works
- [ ] Preference survives page reload (after Task 4 fix)

**PWA:**
- [ ] No Lighthouse PWA errors
- [ ] manifest.webmanifest loads correctly (check Network tab)
- [ ] Service worker registers (check Application tab)
- [ ] App is installable (check install prompt)

**Tab Title:**
- [ ] Shows timer state when running
- [ ] Shows "ChronoFlip Premium" when idle
- [ ] Updates in real-time

**Step 3: Document any remaining issues**

If issues are found during smoke test, create targeted fix commits.

**Step 4: Final commit**

```bash
git add -A && git commit -m "chore: pre-deployment verification complete"
```

---

## Summary of Bug Fixes in This Plan

| Task | Severity | Description |
|------|----------|-------------|
| 2 | **Critical** | Audio element memory leak - tick sounds create unbounded Audio objects |
| 3 | **Critical** | Unhandled promise on custom audio failure - no completion feedback |
| 4 | **Medium** | Dark mode not persisted across sessions |
| 5 | **Medium** | Missing React.memo on FlipDigit and FlipClockDisplay |
| 6 | **Low** | Color alerts re-sorted on every 100ms tick |
| 8 | **Medium** | Service worker doesn't cache JS/CSS bundles |
| 14 | **Medium** | Alert exact-second match can miss on frame skip |
| 15 | **Low** | Alert ID collision on rapid double-click |

## Verification-Only Tasks (No Code Changes Expected)

| Task | Area |
|------|------|
| 1 | Build & dependency audit |
| 7 | PWA manifest & service worker audit |
| 9 | Countdown timer logic trace |
| 10 | Countup & hybrid timer logic trace |
| 11 | Keyboard shortcuts audit |
| 12 | Settings persistence audit |
| 13 | Fullscreen, blackout, wake lock audit |
| 16 | Vercel deployment config |
| 17 | Final integration smoke test |
