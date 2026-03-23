# AWS Migration Architecture — ChronoFlip

> Quick-reference for the full AWS migration. Structured so Claude (or any dev) can understand the architecture and swap any component fast.

---

## Current Stack → Target Stack

| Layer | Current | Target | AWS Service |
|-------|---------|--------|-------------|
| **Auth** | None (open access) | Email+password login | **Cognito User Pool** |
| **Database** | localStorage only | Cloud + local cache | **DynamoDB** + localStorage |
| **Real-time sync** | Firebase RTDB (`onValue`) | GraphQL subscriptions | **AppSync** |
| **Shared timer** | Firebase RTDB (`set`/`get`) | GraphQL mutations/queries | **AppSync** + DynamoDB |
| **Hosting** | Vercel (git deploy) | Git-push deploy | **Amplify Hosting** |
| **SDK** | `firebase` npm package | `aws-amplify` v6 | **Amplify JS SDK** |

---

## Architecture Diagram

```
                    +-----------------+
                    |   Amplify       |
                    |   Hosting       |
                    |   (S3+CDN)      |
                    +--------+--------+
                             |
                    serves   |   static SPA
                             v
                    +--------+--------+
                    |   Browser App   |
                    |   (React SPA)   |
                    +--+---------+----+
                       |         |
            Auth       |         |  Data + Real-time
                       v         v
              +--------+--+  +--+----------+
              |  Cognito   |  |  AppSync    |
              |  User Pool |  |  (GraphQL)  |
              +------------+  +--+----------+
                                 |
                          +------+------+
                          |  DynamoDB   |
                          |  (2 tables) |
                          +-------------+
```

---

## Service Details

### 1. Cognito (Auth)

**What it does:** Handles user signup, login, password reset, token management.

**Config needed:**
- User Pool (region: `ap-southeast-1` or closest to users)
- App Client (no secret — SPA client)
- Email verification enabled

**Key SDK calls:**
```ts
import { signIn, signOut, getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';

await signIn({ username: email, password });
await signOut();
const user = await getCurrentUser();     // { userId, username }
const session = await fetchAuthSession(); // tokens for API calls
```

**Files that use it:**
- `services/authService.ts` (new) — wraps Cognito calls
- `components/screens/LoginScreen.tsx` (new) — login UI
- `index.tsx` — auth gate (check session before rendering App)

**To swap Cognito for something else:**
1. Replace `services/authService.ts` with new auth provider
2. Update `index.tsx` auth gate to use new session check
3. Update AppSync auth mode if moving away from Cognito tokens
4. Keep the same interface: `{ signIn, signOut, getCurrentUser, isAuthenticated }`

---

### 2. DynamoDB (Database)

**What it does:** Stores user events (replaces localStorage as source of truth) and shared timer sessions.

**Table: `chronoflip-events`**
| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| `userId` | String | **PK** | Cognito user sub (`sub` claim) |
| `eventId` | String | **SK** | Event UUID |
| `data` | Map | — | Full `SpeechEvent` JSON |
| `updatedAt` | Number | — | Epoch ms, for conflict resolution |

**Table: `chronoflip-shared`**
| Attribute | Type | Key | Description |
|-----------|------|-----|-------------|
| `shareId` | String | **PK** | 8-char share code |
| `field` | String | **SK** | `event` / `timerState` / `command` |
| `data` | Map | — | Payload JSON |
| `ttl` | Number | — | Auto-expire epoch (24h after last update) |

**Access patterns:**
| Operation | Query |
|-----------|-------|
| Get all events for user | PK = `userId` |
| Get one event | PK = `userId`, SK = `eventId` |
| Get shared event | PK = `shareId`, SK = `event` |
| Get timer state | PK = `shareId`, SK = `timerState` |

**Files that use it:**
- `hooks/usePersistence.ts` — rewritten to save/load from DynamoDB + localStorage cache
- `services/syncService.ts` — rewritten, shared table accessed via AppSync resolvers

**To swap DynamoDB for something else:**
1. Replace AppSync resolver mapping templates to point to new data source
2. Update `hooks/usePersistence.ts` if changing event storage
3. Keep the same GraphQL schema — only resolvers change
4. DynamoDB-specific: TTL is a DynamoDB feature; if moving to Postgres etc., add a cron/scheduled cleanup

---

### 3. AppSync (Real-time Sync)

**What it does:** Replaces Firebase RTDB. Provides GraphQL API with WebSocket-based subscriptions.

**GraphQL Schema:**
```graphql
type TimerState {
  shareId: String!
  status: String!
  currentSegmentIndex: Int!
  timeInSeconds: Int!
  segmentName: String
  segmentMode: String
  totalSegments: Int
  activeAlertColor: String
  isFlashing: Boolean
  lastUpdatedAt: Float!
  eventTitle: String
  scheduledStartTime: Float
}

type SharedEvent {
  id: String!
  title: String!
  segments: [SharedSegment!]!
  scheduledStartTime: Float
}

type SharedSegment {
  id: String!
  name: String!
  durationSeconds: Int!
  mode: String!
  color: String!
}

type Command {
  shareId: String!
  type: String!
  timestamp: Float!
}

type UserEvent {
  userId: String!
  eventId: String!
  data: AWSJSON!
  updatedAt: Float!
}

# --- Input Types ---
input SharedEventInput {
  id: String!
  title: String!
  segments: [SharedSegmentInput!]!
  scheduledStartTime: Float
}

input SharedSegmentInput {
  id: String!
  name: String!
  durationSeconds: Int!
  mode: String!
  color: String!
}

input TimerStateInput {
  shareId: String!
  status: String!
  currentSegmentIndex: Int!
  timeInSeconds: Int!
  segmentName: String
  segmentMode: String
  totalSegments: Int
  activeAlertColor: String
  isFlashing: Boolean
  lastUpdatedAt: Float!
  eventTitle: String
  scheduledStartTime: Float
}

input CommandInput {
  shareId: String!
  type: String!
  timestamp: Float!
}

input UserEventInput {
  userId: String!
  eventId: String!
  data: AWSJSON!
  updatedAt: Float!
}

# --- Queries ---
type Query {
  getSharedEvent(shareId: String!): SharedEvent
  getTimerState(shareId: String!): TimerState
  listUserEvents(userId: String!): [UserEvent!]!
}

# --- Mutations ---
type Mutation {
  publishEvent(shareId: String!, event: SharedEventInput!): SharedEvent
  publishTimerState(input: TimerStateInput!): TimerState
  publishCommand(input: CommandInput!): Command
  clearCommand(shareId: String!): Boolean
  removeSharedEvent(shareId: String!): Boolean
  saveUserEvent(input: UserEventInput!): UserEvent
  deleteUserEvent(userId: String!, eventId: String!): Boolean
}

# --- Subscriptions (real-time) ---
type Subscription {
  onTimerStateUpdate(shareId: String!): TimerState
    @aws_subscribe(mutations: ["publishTimerState"])
  onCommandUpdate(shareId: String!): Command
    @aws_subscribe(mutations: ["publishCommand", "clearCommand"])
}
```

**Auth modes:**
- **Cognito User Pool** — for mutations (only logged-in organisers can publish)
- **API Key** — for viewer queries and subscriptions (public, read-only)

**Firebase → AppSync mapping:**
| Firebase call | AppSync equivalent |
|---|---|
| `onValue(ref(db, 'shared/X/timerState'), cb)` | `subscribe({ query: onTimerStateUpdate, variables: { shareId: 'X' } })` |
| `set(ref(db, 'shared/X/timerState'), data)` | `mutate({ query: publishTimerState, variables: { input: data } })` |
| `get(ref(db, 'shared/X/event'))` | `query({ query: getSharedEvent, variables: { shareId: 'X' } })` |
| `remove(ref(db, 'shared/X'))` | `mutate({ query: removeSharedEvent, variables: { shareId: 'X' } })` |
| `set(ref(db, 'shared/X/command'), cmd)` | `mutate({ query: publishCommand, variables: { input: cmd } })` |
| `onValue(ref(db, 'shared/X/command'), cb)` | `subscribe({ query: onCommandUpdate, variables: { shareId: 'X' } })` |
| `remove(ref(db, 'shared/X/command'))` | `mutate({ query: clearCommand, variables: { shareId: 'X' } })` |

**Files that use it:**
- `services/syncService.ts` — full rewrite, all functions use AppSync client
- `services/awsConfig.ts` (new) — Amplify.configure() with AppSync endpoint

**To swap AppSync for something else (e.g., API Gateway WebSocket, Supabase, Pusher):**
1. Replace `services/syncService.ts` — keep the same exported function signatures
2. Subscriptions: replace GraphQL subscriptions with new WebSocket/SSE implementation
3. The rest of the app imports from `syncService.ts` — no other files need to change
4. The interface to preserve:
   ```ts
   publishEvent(event): Promise<string>
   publishTimerState(shareId, state): Promise<void>
   subscribeToTimerState(shareId, callback): Unsubscribe
   fetchSharedEvent(shareId): Promise<SpeechEvent | null>
   removeSharedEvent(shareId): Promise<void>
   publishCommand(shareId, command): Promise<void>
   subscribeToCommand(shareId, callback): Unsubscribe
   clearCommand(shareId): Promise<void>
   ```

---

### 4. Amplify Hosting

**What it does:** Git-push deploys, like Vercel. Builds Vite app, serves via CloudFront.

**Setup:**
1. Amplify Console → New App → Connect GitHub repo
2. Build settings auto-detected from Vite
3. Add rewrite rule: `/<*>` → `/index.html` (status 200) for SPA routing
4. Custom domain: add in Amplify Console, auto-provisions SSL

**Build settings (`amplify.yml` if needed):**
```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: dist
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

**Environment variables (set in Amplify Console):**
```
VITE_AWS_REGION=ap-southeast-1
VITE_COGNITO_USER_POOL_ID=ap-southeast-1_XXXXXXX
VITE_COGNITO_CLIENT_ID=XXXXXXXXXXXXXXXX
VITE_APPSYNC_ENDPOINT=https://XXXXX.appsync-api.ap-southeast-1.amazonaws.com/graphql
VITE_APPSYNC_API_KEY=da2-XXXXXXXXXXXXXXX
```

**To swap Amplify Hosting for something else:**
1. The app is a static SPA — any static host works (S3+CloudFront, Vercel, Netlify, Cloudflare Pages)
2. Just ensure SPA routing (all paths → `index.html`)
3. Set the same env vars in the new host
4. See `docs/aws-deployment-guide.md` for the manual S3+CloudFront setup

---

## File Change Map

| File | Action | Description |
|------|--------|-------------|
| `services/firebaseConfig.ts` | **DELETE** | Replaced by awsConfig.ts |
| `services/awsConfig.ts` | **NEW** | `Amplify.configure()` with Cognito + AppSync |
| `services/authService.ts` | **NEW** | `signIn`, `signOut`, `getCurrentUser`, `isAuthenticated` |
| `services/syncService.ts` | **REWRITE** | Firebase → AppSync (same exports) |
| `hooks/usePersistence.ts` | **REWRITE** | localStorage + DynamoDB cloud sync |
| `index.tsx` | **MODIFY** | Add auth check, redirect to login if not authed |
| `App.tsx` | **MODIFY** | Add logout button, receive user prop |
| `types.ts` | **MODIFY** | Add `AuthUser` type (re-exported from authService) |
| `components/screens/LoginScreen.tsx` | **NEW** | Email + password form |
| `package.json` | **MODIFY** | Remove `firebase`, add `aws-amplify` |

---

## Migration Sequence (order matters)

```
1. Create AWS resources (Cognito, DynamoDB, AppSync) — AWS Console or CDK
       ↓
2. Add aws-amplify SDK, create awsConfig.ts
       ↓
3. Build LoginScreen + authService (can test independently)
       ↓
4. Rewrite syncService.ts (Firebase → AppSync)
       ↓
5. Rewrite usePersistence.ts (add DynamoDB sync)
       ↓
6. Wire auth gate into index.tsx
       ↓
7. Test full flow: login → create event → share → viewer
       ↓
8. Set up Amplify Hosting, deploy
       ↓
9. Remove firebase package + firebaseConfig.ts
       ↓
10. Verify, cleanup, done
```

---

## Rollback Plan

If anything goes wrong mid-migration:

| Scenario | Rollback |
|----------|----------|
| AppSync subscriptions unreliable | Keep `firebase` as dependency, revert `syncService.ts` to Firebase version (git checkout) |
| Cognito issues | Remove auth gate from `index.tsx`, app works without login (current state) |
| DynamoDB sync bugs | `usePersistence.ts` falls back to localStorage-only (current behavior) |
| Amplify Hosting issues | Deploy to Vercel (current setup still works) or S3+CloudFront (see `docs/aws-deployment-guide.md`) |
| Full rollback | `git revert` the migration commits, redeploy to Vercel |

**Key principle:** Each layer is independent. You can swap any single service without touching the others, as long as you keep the same interface in the service files.

---

## Cost (Free Tier)

| Service | Free Tier | Our Usage | Paid? |
|---------|-----------|-----------|-------|
| Cognito | 10,000 MAU forever | <50 users | No |
| DynamoDB | 25GB + 25 RCU/WCU forever | <1MB | No |
| AppSync | 250K queries/month (12mo) | <10K/month | No |
| Amplify Hosting | 1000 build-min + 15GB/month (12mo) | <5 builds/month | No |

After the 12-month free tier expires for AppSync and Amplify Hosting, cost would be ~$1-2/month at this scale.

---

## Quick Commands

```bash
# Install AWS Amplify SDK
npm install aws-amplify

# Remove Firebase
npm uninstall firebase

# Build + deploy (if using Amplify CLI)
npx amplify push

# Or just push to GitHub — Amplify auto-builds
git push origin main
```

---

## Swapping Any Component — TL;DR

| Want to change... | Touch these files only | Keep this interface |
|---|---|---|
| Auth provider | `authService.ts`, `LoginScreen.tsx`, `index.tsx` | `{ signIn, signOut, getCurrentUser, isAuthenticated }` |
| Database | `usePersistence.ts`, AppSync resolvers | `{ loadAppState, saveEvents }` |
| Real-time sync | `syncService.ts` | See 8 exported functions above |
| Hosting | Amplify Console / deploy config | Just a static SPA, any host works |
| Everything | All of the above | TypeScript interfaces in `types.ts` stay the same |
