# Future: MongoDB Migration Guide

## Current Architecture

Real-time sync uses **Firebase Realtime Database** via `services/syncService.ts`. This file is the only Firebase dependency outside of `services/firebaseConfig.ts`.

### syncService.ts Interface

| Function | Purpose |
|----------|---------|
| `publishEvent(event)` | Stores event data, returns `shareId` |
| `publishTimerState(shareId, state)` | Pushes live timer state (called ~1/sec) |
| `subscribeToTimerState(shareId, cb)` | Subscribes viewer to live updates, returns unsubscribe |
| `fetchSharedEvent(shareId)` | Fetches event data for viewer |
| `removeSharedEvent(shareId)` | Cleans up shared data |

### Data Shape in Firebase

```
shared/
  {shareId}/
    event/     → SpeechEvent (id, title, segments, scheduledStartTime)
    timerState/ → TimerSyncState (status, time, segment info, alert color)
```

## How to Migrate to Express + MongoDB + Socket.io

### 1. Backend (new Express server)

```
POST   /api/events          → Create shared event, return shareId
GET    /api/events/:shareId → Fetch event data
DELETE /api/events/:shareId → Remove shared event
```

For real-time: use Socket.io rooms keyed by `shareId`.

### 2. MongoDB Schema

**Collection: `sharedEvents`**
```json
{
  "_id": "shareId",
  "event": { /* SpeechEvent data */ },
  "timerState": { /* TimerSyncState data */ },
  "createdAt": "ISODate",
  "expiresAt": "ISODate"  // TTL index for auto-cleanup
}
```

### 3. Replace syncService.ts

Rewrite `syncService.ts` to:
- `publishEvent` → `POST /api/events`
- `publishTimerState` → `socket.emit('timerState', { shareId, state })`
- `subscribeToTimerState` → `socket.on('timerState', callback)` after joining room
- `fetchSharedEvent` → `GET /api/events/:shareId`
- `removeSharedEvent` → `DELETE /api/events/:shareId`

### 4. What Stays the Same

- `types.ts` — `TimerSyncState` and `SpeechEvent` types unchanged
- `QRCodeModal.tsx` — no changes needed
- `ViewerScreen.tsx` — no changes needed (consumes same interface)
- `TimerRunningScreen.tsx` — no changes needed (calls same functions)
- `EventSettingsScreen.tsx` — no changes needed

### 5. Delete After Migration

- `services/firebaseConfig.ts`
- `firebase` npm dependency
