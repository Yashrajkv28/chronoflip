# Chat Context — March 3, 2026

## What Was Done This Session

### 1. QR Code Sharing & Real-Time Viewer (Full Feature)
Added the ability for organizers to share a live timer with participants via QR code.

**Flow:**
1. Organizer opens event settings → taps purple Share button
2. Event is published to Firebase Realtime Database → gets a `shareId`
3. QR code modal shows with the viewer URL: `speechtimer-pi.vercel.app/view/{shareId}`
4. Participant scans QR → ViewerScreen loads → subscribes to live timer state
5. Organizer starts timer → state pushes to Firebase every ~300ms → viewer updates in real-time
6. Start/pause/resume/complete publish immediately (no debounce delay)
7. Deleting an event cleans up Firebase data and shows "Timer Ended" to viewers

### 2. Security Hardening
- Share IDs use `crypto.getRandomValues()` instead of `Math.random()`
- All share IDs validated with regex `/^[A-Za-z0-9]{4,16}$/` before any Firebase operation
- Firebase data validated with `isValidSharedEvent()` and `isValidTimerState()` with length bounds
- URL path regex restricted in `index.tsx` to prevent path traversal
- Firebase subscription only starts after event loads successfully (no resource leak)
- `removeSharedEvent()` called on event deletion (cleanup)
- Firebase Security Rules replaced: only `shared/` path accessible, with schema validation

### 3. Performance Optimization
- Code-split ViewerScreen with `React.lazy()` — phones load ~53KB gzipped instead of 163KB
- Firebase SDK split into separate chunk via Vite `manualChunks`
- Sync debounce reduced from 900ms to 300ms
- Status changes (start/pause/resume/complete) publish immediately

## Files Created
| File | Purpose |
|------|---------|
| `services/firebaseConfig.ts` | Firebase initialization (project: speechtimer-ceb4b) |
| `services/syncService.ts` | Abstracted sync layer — publish/subscribe/fetch/remove |
| `components/ui/QRCodeModal.tsx` | Glassmorphic QR code + copy link modal |
| `components/screens/ViewerScreen.tsx` | Read-only live timer viewer for participants |
| `vercel.json` | SPA routing rewrites for `/view/:shareId` |
| `future.md` | MongoDB migration guide |
| `user-reminder.md` | Firebase test mode expiry reminder (~April 2, 2026) |
| `oldchatcontext.md` | This file |

## Files Modified
| File | Change |
|------|--------|
| `types.ts` | Added `TimerSyncState` interface, `shareId` on `SpeechEvent` |
| `index.tsx` | URL routing for `/view/:id`, React.lazy code-split |
| `App.tsx` | `deleteEvent` calls `removeSharedEvent` for cleanup |
| `EventSettingsScreen.tsx` | Share button, QR modal trigger, `publishEvent` integration |
| `TimerRunningScreen.tsx` | Pushes timer state to Firebase with debounced + immediate sync |
| `vite.config.ts` | Firebase manual chunk splitting |
| `package.json` | Added `firebase`, `qrcode.react` |

## Firebase Configuration
- **Project:** speechtimer-ceb4b
- **Region:** Asia Southeast
- **Database URL:** https://speechtimer-ceb4b-default-rtdb.asia-southeast1.firebasedatabase.app
- **Security Rules:** Scoped to `shared/` path only, with `.validate` rules on event and timerState
- **IMPORTANT:** Rules do NOT expire (replaced the 30-day test mode rules), but if anything breaks, check Firebase Console > Realtime Database > Rules

## Deployment
- **Live URL:** https://speechtimer-pi.vercel.app
- **Vercel project:** speechtimer (yashrajs-projects-82d81fc8)
- **Deploy command:** `npx vercel --prod`
- **Git:** All committed and pushed to `main` branch on GitHub

## What's Left / Future Work
- MongoDB migration (see `future.md` for guide)
- Authentication (deferred — no login/auth currently)
- Firebase could be swapped out by replacing only `syncService.ts` and `firebaseConfig.ts`
- `newer version/` folder contains client revision request docs (docx + reference image)

## Architecture Notes
- No React Router — uses `window.location.pathname` check in `index.tsx`
- Navigation is state-based via `AppState.currentScreen` in `App.tsx`
- Firebase is isolated in `services/` — only `syncService.ts` and `firebaseConfig.ts` touch it
- Timer hook (`useTimer.ts`) is timestamp-based (immune to browser throttling)
