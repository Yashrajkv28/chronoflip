# AWS Setup: Real-Time Event Sync (Subscriptions)

This guide adds real-time sync so that when you save/delete an event on one browser, the other browser updates automatically — no refresh needed.

**Time required:** ~10 minutes
**Prerequisites:** Your AppSync API (`chronoflip-api`) is already set up with all existing resolvers working.

---

## What You're Doing

You're adding a new **subscription** (`onUserEventChange`) that fires whenever `saveUserEvent` or `deleteUserEvent` runs. This lets all browsers for the same user get notified in real-time via WebSocket.

You also need to update the `deleteUserEvent` mutation return type (currently returns `Boolean`, needs to return a proper type so the subscription can read the fields).

---

## Step 1: Update the GraphQL Schema

1. Go to the **AWS Console** → **AppSync** → **chronoflip-api**
2. In the left sidebar, click **Schema**
3. You need to make **3 changes** to the schema:

### 1a. Add the `UserEventChange` type

Find the section with your types (near `UserEvent`). Add this new type right after `UserEvent`:

```graphql
type UserEventChange @aws_cognito_user_pools {
  userId: String!
  eventId: String!
  updatedAt: Float
  deleted: Boolean
}
```

### 1b. Update `deleteUserEvent` return type

Find this line in the `Mutation` type:

```graphql
deleteUserEvent(userId: String!, eventId: String!): Boolean @aws_cognito_user_pools
```

**Change it to:**

```graphql
deleteUserEvent(userId: String!, eventId: String!): UserEventChange @aws_cognito_user_pools
```

### 1c. Add the subscription

Find the `Subscription` type (at the bottom of the schema). Add the new subscription inside it:

**Before:**
```graphql
type Subscription {
  onTimerStateUpdate(shareId: String!): TimerState
    @aws_subscribe(mutations: ["publishTimerState"])
  onCommandUpdate(shareId: String!): Command
    @aws_subscribe(mutations: ["publishCommand", "clearCommand"])
}
```

**After:**
```graphql
type Subscription {
  onTimerStateUpdate(shareId: String!): TimerState
    @aws_subscribe(mutations: ["publishTimerState"])
  onCommandUpdate(shareId: String!): Command
    @aws_subscribe(mutations: ["publishCommand", "clearCommand"])
  onUserEventChange(userId: String!): UserEventChange
    @aws_subscribe(mutations: ["saveUserEvent", "deleteUserEvent"])
}
```

4. Click **Save Schema** (top right)

---

## Step 2: Update the `saveUserEvent` Resolver Response

The `saveUserEvent` resolver currently returns the raw DynamoDB result. We need it to also return `deleted: false` so the subscription knows this was a save, not a delete.

1. In the left sidebar, click **Schema**
2. Scroll down to **Resolvers** section
3. Find `Mutation` → `saveUserEvent` and click on its resolver
4. Find the **Response mapping template** (it currently says):

```
$util.toJson($ctx.result)
```

5. **Replace it with:**

```json
{
  "userId": "$ctx.result.userId",
  "eventId": "$ctx.result.eventId",
  "data": $util.toJson($ctx.result.data),
  "updatedAt": $ctx.result.updatedAt,
  "deleted": false
}
```

6. Click **Save**

---

## Step 3: Update the `deleteUserEvent` Resolver Response

The `deleteUserEvent` resolver currently returns `true`. We need it to return the proper `UserEventChange` shape so the subscription can tell which event was deleted, and for which user.

1. Find `Mutation` → `deleteUserEvent` and click on its resolver
2. The **Request mapping template** stays the same (no changes):

```json
{
  "version": "2017-02-28",
  "operation": "DeleteItem",
  "key": {
    "userId": { "S": "$ctx.identity.sub" },
    "eventId": { "S": "$ctx.args.eventId" }
  }
}
```

3. Find the **Response mapping template** (it currently says):

```
true
```

4. **Replace it with:**

```json
{
  "userId": "$ctx.identity.sub",
  "eventId": "$ctx.args.eventId",
  "deleted": true
}
```

5. Click **Save**

---

## Step 4: Verify — NO Resolver Needed for the Subscription

Just like `onTimerStateUpdate` and `onCommandUpdate`, the new `onUserEventChange` subscription uses `@aws_subscribe` — **AppSync handles it automatically**. You do NOT need to attach a resolver to it.

---

## Step 5: Test in the AppSync Console

1. In the left sidebar, click **Queries**
2. Open **two tabs** of the AppSync query editor

### Tab 1: Start the subscription

Set auth mode to **Amazon Cognito User Pools** (log in with your test user), then run:

```graphql
subscription {
  onUserEventChange(userId: "305c798c-40d1-70d1-3af0-5122e7a97a9b") {
    userId
    eventId
    updatedAt
    deleted
  }
}
```

(Replace the userId with your actual Cognito `sub` — you can find it in the console logs: `[SYNC] Fetching cloud events for userId: ...`)

The subscription should show "Listening..." or similar.

### Tab 2: Trigger a save

In the other tab (also authenticated as Cognito user), run:

```graphql
mutation {
  saveUserEvent(input: {
    userId: "305c798c-40d1-70d1-3af0-5122e7a97a9b"
    eventId: "test-realtime-123"
    data: "{\"test\": true}"
    updatedAt: 1234567890
  }) {
    userId
    eventId
    updatedAt
    deleted
  }
}
```

### Expected result

- **Tab 2** should return `{ userId, eventId, updatedAt, deleted: false }`
- **Tab 1** (subscription) should receive a notification with the same data

### Clean up the test event

Still in Tab 2:

```graphql
mutation {
  deleteUserEvent(userId: "305c798c-40d1-70d1-3af0-5122e7a97a9b", eventId: "test-realtime-123") {
    userId
    eventId
    deleted
  }
}
```

Tab 1 should receive `{ userId, eventId, deleted: true }`.

---

## Step 6: Test in the App

1. Hard refresh (Ctrl+Shift+R) both browsers
2. Check the console — you should see: `[REALTIME] Subscribed to event changes for user: ...`
3. Create or edit an event on Browser A
4. Browser B should automatically update within 2-3 seconds (500ms subscription debounce + 2s save debounce)
5. Delete an event on Browser A — Browser B should remove it automatically

---

## Troubleshooting

**"Subscription error" in console:**
- Make sure the schema changes are saved (Step 1)
- Make sure you're using Cognito auth (subscriptions for user events require authentication)

**Subscription connects but no notifications:**
- Check that the `saveUserEvent` response template (Step 2) returns the `userId` field — the subscription filters by `userId`, so it must be in the response
- Check that the `deleteUserEvent` response template (Step 3) returns `userId` — same reason

**Events still require refresh:**
- Hard refresh to get the latest code
- Check console for `[REALTIME] Subscribed to event changes` — if missing, the subscription didn't connect

---

## Summary of All Changes

| What | Where | Change |
|------|-------|--------|
| `UserEventChange` type | AppSync Schema | New type added |
| `deleteUserEvent` return type | AppSync Schema | `Boolean` → `UserEventChange` |
| `onUserEventChange` subscription | AppSync Schema | New subscription added |
| `saveUserEvent` response template | AppSync Resolver | Returns `deleted: false` |
| `deleteUserEvent` response template | AppSync Resolver | Returns `{userId, eventId, deleted: true}` |
| Subscription resolver | — | Not needed (`@aws_subscribe` handles it) |
