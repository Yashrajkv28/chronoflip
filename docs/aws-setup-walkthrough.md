# AWS Setup Walkthrough — ChronoFlip

> Follow this step by step with the AWS Console open in another tab.
> Every click is described. Nothing is skipped.

---

## Before You Start

### What you need
- Access to your boss's AWS account (or your own)
- A browser (Chrome recommended)
- Your ChronoFlip project open in a terminal

### How long this takes
- ~30-40 minutes if you follow each step carefully

### What you'll create
1. A Cognito User Pool (login system)
2. Two DynamoDB tables (database)
3. An AppSync API (real-time sync)
4. A test user account
5. A `.env` file with all the IDs
6. Amplify Hosting (deployment)

---

## Step 0: Log into AWS Console

1. Open https://console.aws.amazon.com/
2. Sign in with your IAM user or root account
3. **IMPORTANT:** In the top-right corner, you'll see a region name (like "N. Virginia" or "Tokyo")
4. Click on it and select **Asia Pacific (Singapore) — `ap-southeast-1`**
5. **Keep this region for EVERYTHING.** Every service must be in the same region.

> If you don't see Singapore, any region works — just be consistent. We'll use `ap-southeast-1` in all examples below. Replace with your region if different.

---

## Step 1: Create Cognito User Pool

This creates the login system.

### 1.1 — Navigate to Cognito

1. In the search bar at the top of the AWS Console, type **Cognito**
2. Click **Amazon Cognito** from the results
3. You should see a page that says "User pools" on the left sidebar
4. Click the orange **Create user pool** button

### 1.2 — Configure sign-in experience

You should see "Step 1 of 6" or a similar wizard.

**Authentication providers:**
- Provider types: Keep **Cognito user pool** selected (default)

**Cognito user pool sign-in options:**
- Check **Email** only
- Do NOT check User name or Phone number

Click **Next**

### 1.3 — Configure security requirements

**Password policy:**
- Keep **Cognito defaults** selected
  - (Minimum 8 characters, requires uppercase, lowercase, number, symbol)

**Multi-factor authentication:**
- Select **No MFA**
  - (We can add this later if needed)

**User account recovery:**
- Keep defaults (Enable self-service account recovery, Email only)

Click **Next**

### 1.4 — Configure sign-up experience

**Self-registration:**
- **UNCHECK** "Enable self-registration"
- This is important! We don't want random people creating accounts
- Only admins (you) will create user accounts manually

**Attribute verification and user account confirmation:**
- Keep defaults

**Required attributes:**
- Make sure **email** is listed as required (it should be by default)
- Don't add any other required attributes

Click **Next**

### 1.5 — Configure message delivery

**Email provider:**
- Select **Send email with Cognito** (the simpler option)
  - This uses AWS's built-in email sender
  - Free for up to 50 emails/day (more than enough)

**FROM email address:**
- Keep the default `no-reply@verificationemail.com`

Click **Next**

### 1.6 — Integrate your app

**User pool name:**
- Type: `chronoflip-users`

**Hosted authentication pages:**
- **Don't use the Cognito Hosted UI** — uncheck this if it's checked
  - We have our own login screen (LoginScreen.tsx)

**App type:**
- Select **Public client**

**App client name:**
- Type: `chronoflip-web`

**Client secret:**
- Select **Don't generate a client secret**
  - SPAs (browser apps) can't keep secrets — this is correct and expected

**Advanced app client settings:**
- Leave everything as default

Click **Next**

### 1.7 — Review and create

- Review everything looks right
- Click **Create user pool**

### 1.8 — Copy the IDs you need

After creation, you'll be taken to the user pool page.

1. **User Pool ID:**
   - You'll see it at the top of the page, something like: `ap-southeast-1_AbCdEf123`
   - Copy this → you'll paste it into `.env` as `VITE_COGNITO_USER_POOL_ID`

2. **App Client ID:**
   - Click on the **App integration** tab (at the top of the user pool page)
   - Scroll down to **App clients and analytics**
   - You'll see `chronoflip-web` listed
   - Click on it
   - Copy the **Client ID** — it looks like: `1a2b3c4d5e6f7g8h9i0j1k2l3m`
   - This goes into `.env` as `VITE_COGNITO_CLIENT_ID`

**Write both of these down somewhere — you'll need them in Step 4.**

---

## Step 2: Create DynamoDB Tables

This creates the database.

### 2.1 — Navigate to DynamoDB

1. In the search bar at the top, type **DynamoDB**
2. Click **Amazon DynamoDB** from the results
3. Click **Tables** in the left sidebar (if not already there)
4. Click the orange **Create table** button

### 2.2 — Create Table 1: `chronoflip-events`

This table stores user events (your saved speeches/timers).

**Table details:**
- Table name: `chronoflip-events`
- Partition key: `userId` (type: **String**)
- Sort key: `eventId` (type: **String**) — **check the "Sort key" checkbox first!**

**Table settings:**
- Select **Customize settings**
- Under **Read/write capacity settings**, select **On-demand**
  - This means you only pay per request (and free tier covers 200M requests/month)
  - Don't use "Provisioned" — that pre-allocates capacity you don't need

**Everything else:** Leave as default

Click **Create table**

Wait for the status to change from "Creating" to "Active" (~10-30 seconds).

### 2.3 — Create Table 2: `chronoflip-shared`

1. Click **Create table** again

**Table details:**
- Table name: `chronoflip-shared`
- Partition key: `shareId` (type: **String**)
- Sort key: `field` (type: **String**) — **check the "Sort key" checkbox first!**

**Table settings:**
- Select **Customize settings**
- Under **Read/write capacity settings**, select **On-demand**

Click **Create table**

### 2.4 — Enable TTL on the shared table

TTL (Time To Live) automatically deletes expired shared sessions.

1. Wait for the table to become "Active"
2. Click on `chronoflip-shared` in the table list
3. Click the **Additional settings** tab
4. Find **Time to Live (TTL)** section
5. Click **Turn on**
6. TTL attribute name: `ttl`
7. Click **Turn on TTL**

Done! You now have 2 tables. Nothing to copy — we reference tables by name in AppSync.

---

## Step 3: Create AppSync API

This is the most involved step. AppSync replaces Firebase for real-time sync.

### 3.1 — Navigate to AppSync

1. In the search bar at the top, type **AppSync**
2. Click **AWS AppSync** from the results
3. Click **Create API**

### 3.2 — Choose API type

- Select **GraphQL API**
- Click **Next**

### 3.3 — Configure API

**API name:** `chronoflip-api`

**Contact details:** Optional, skip it

**Private API:** Leave unchecked

**API configuration:**
- Select **Start from scratch** (NOT "Start with a sample" or "Use a type from DynamoDB")

Click **Next**

### 3.4 — Create the GraphQL schema

You'll see a code editor with a default schema. **Delete everything in the editor** and paste this entire schema:

```graphql
schema {
  query: Query
  mutation: Mutation
  subscription: Subscription
}

type TimerState @aws_api_key @aws_cognito_user_pools {
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

type SharedEvent @aws_api_key @aws_cognito_user_pools {
  id: String!
  title: String!
  segments: [SharedSegment!]!
  scheduledStartTime: Float
}

type SharedSegment @aws_api_key @aws_cognito_user_pools {
  id: String!
  name: String!
  durationSeconds: Int!
  mode: String!
  color: String!
}

type Command @aws_api_key @aws_cognito_user_pools {
  shareId: String!
  type: String!
  timestamp: Float!
}

type UserEvent @aws_cognito_user_pools {
  userId: String!
  eventId: String!
  data: AWSJSON!
  updatedAt: Float!
}

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

type Query {
  getSharedEvent(shareId: String!): SharedEvent @aws_api_key
  getTimerState(shareId: String!): TimerState @aws_api_key
  listUserEvents(userId: String!): [UserEvent!]! @aws_cognito_user_pools
}

type Mutation {
  publishEvent(shareId: String!, event: SharedEventInput!): SharedEvent @aws_cognito_user_pools
  publishTimerState(input: TimerStateInput!): TimerState @aws_cognito_user_pools
  publishCommand(input: CommandInput!): Command @aws_api_key @aws_cognito_user_pools
  clearCommand(shareId: String!): Command @aws_cognito_user_pools
  removeSharedEvent(shareId: String!): Boolean @aws_cognito_user_pools
  saveUserEvent(input: UserEventInput!): UserEvent @aws_cognito_user_pools
  deleteUserEvent(userId: String!, eventId: String!): Boolean @aws_cognito_user_pools
}

type Subscription {
  onTimerStateUpdate(shareId: String!): TimerState
    @aws_subscribe(mutations: ["publishTimerState"])
  onCommandUpdate(shareId: String!): Command
    @aws_subscribe(mutations: ["publishCommand", "clearCommand"])
}
```

Click **Next**

### 3.5 — Create resources

On this step it might ask you to create DynamoDB resources. **Skip this** — we already created our tables manually. Just click **Next** or **Create API**.

Wait for the API to be created (~30 seconds).

### 3.6 — Note the API URL and API Key

After creation, you'll land on the API's dashboard page.

1. **API URL (endpoint):**
   - Look for "API URL" on the page
   - It looks like: `https://abc123xyz.appsync-api.ap-southeast-1.amazonaws.com/graphql`
   - Copy this → goes into `.env` as `VITE_APPSYNC_ENDPOINT`

2. **API Key:**
   - In the left sidebar, click **Settings**
   - Under **Default authorization mode**, you should see "API key"
   - The API key looks like: `da2-abcdefghijklmnopqrstuvwx`
   - Copy this → goes into `.env` as `VITE_APPSYNC_API_KEY`

> If there's no API key, click **Create key** and give it any name (like "default"). Set expiry to 365 days.

**Write both of these down — you'll need them in Step 4.**

### 3.7 — Add Cognito as additional auth mode

1. In the left sidebar, click **Settings**
2. Find **Additional authorization modes**
3. Click **Add authorization mode** (or similar button)
4. Select **Amazon Cognito user pool**
5. For "User pool", select the `chronoflip-users` pool you created in Step 1
   - If you don't see it, make sure you're in the same region (ap-southeast-1)
6. **Default action:** Select **ALLOW**
7. Click **Save**

### 3.8 — Create the Data Source (connect AppSync to DynamoDB)

We need to tell AppSync where to read/write data. We'll create 2 data sources.

1. In the left sidebar, click **Data sources**
2. Click **Create data source**

**Data source 1: Events table**
- Data source name: `EventsTable`
- Data source type: **Amazon DynamoDB table**
- Region: `ap-southeast-1` (same region)
- Table name: Select `chronoflip-events`
- **Create or use an existing role:** Select **New role** (AppSync will auto-create permissions)
- Click **Create**

3. Click **Create data source** again

**Data source 2: Shared table**
- Data source name: `SharedTable`
- Data source type: **Amazon DynamoDB table**
- Region: `ap-southeast-1`
- Table name: Select `chronoflip-shared`
- **Create or use an existing role:** Select **New role**
- Click **Create**

### 3.9 — Create Resolvers (the wiring)

This is the most tedious part but it's just clicking and pasting. Resolvers tell AppSync what to do when a query/mutation comes in.

Go to the left sidebar and click **Schema**. You'll see your GraphQL schema on the left and a "Resolvers" panel on the right. For each operation listed, you'll click **Attach** to add a resolver.

---

#### Resolver 1: `Query.getSharedEvent`

1. Find `getSharedEvent(...)` under "Query" in the Resolvers panel
2. Click **Attach**
3. Data source: **SharedTable**
4. **Enable or switch to VTL (Velocity Template Language) resolvers** if given the option. If asked to choose between "pipeline" and "unit", pick **unit resolver**.

**Request mapping template:**
```json
{
  "version": "2017-02-28",
  "operation": "GetItem",
  "key": {
    "shareId": { "S": "$ctx.args.shareId" },
    "field": { "S": "event" }
  }
}
```

**Response mapping template:**
```
#if($ctx.result)
  #set($data = $ctx.result.data)
  $util.toJson($data)
#else
  null
#end
```

Click **Save** (or **Create**)

---

#### Resolver 2: `Query.getTimerState`

1. Find `getTimerState(...)` under "Query"
2. Click **Attach**
3. Data source: **SharedTable**

**Request mapping template:**
```json
{
  "version": "2017-02-28",
  "operation": "GetItem",
  "key": {
    "shareId": { "S": "$ctx.args.shareId" },
    "field": { "S": "timerState" }
  }
}
```

**Response mapping template:**
```
#if($ctx.result)
  $util.toJson($ctx.result.data)
#else
  null
#end
```

Click **Save**

---

#### Resolver 3: `Query.listUserEvents`

1. Find `listUserEvents(...)` under "Query"
2. Click **Attach**
3. Data source: **EventsTable**

**Request mapping template:**
```json
{
  "version": "2017-02-28",
  "operation": "Query",
  "query": {
    "expression": "userId = :userId",
    "expressionValues": {
      ":userId": { "S": "$ctx.identity.sub" }
    }
  }
}
```

**Response mapping template:**
```
$util.toJson($ctx.result.items)
```

Click **Save**

---

#### Resolver 4: `Mutation.publishEvent`

1. Find `publishEvent(...)` under "Mutation"
2. Click **Attach**
3. Data source: **SharedTable**

**Request mapping template:**
```json
{
  "version": "2017-02-28",
  "operation": "PutItem",
  "key": {
    "shareId": { "S": "$ctx.args.shareId" },
    "field": { "S": "event" }
  },
  "attributeValues": {
    "data": $util.dynamodb.toMapValuesJson($ctx.args.event),
    "ttl": { "N": "${ (java.lang.System.currentTimeMillis() / 1000).intValue() + 86400 }" }
  }
}
```

**Response mapping template:**
```
$util.toJson($ctx.args.event)
```

Click **Save**

---

#### Resolver 5: `Mutation.publishTimerState`

1. Find `publishTimerState(...)` under "Mutation"
2. Click **Attach**
3. Data source: **SharedTable**

**Request mapping template:**
```json
{
  "version": "2017-02-28",
  "operation": "PutItem",
  "key": {
    "shareId": { "S": "$ctx.args.input.shareId" },
    "field": { "S": "timerState" }
  },
  "attributeValues": {
    "data": $util.dynamodb.toMapValuesJson($ctx.args.input),
    "ttl": { "N": "${ (java.lang.System.currentTimeMillis() / 1000).intValue() + 86400 }" }
  }
}
```

**Response mapping template:**
```
$util.toJson($ctx.args.input)
```

Click **Save**

---

#### Resolver 6: `Mutation.publishCommand`

1. Find `publishCommand(...)` under "Mutation"
2. Click **Attach**
3. Data source: **SharedTable**

**Request mapping template:**
```json
{
  "version": "2017-02-28",
  "operation": "PutItem",
  "key": {
    "shareId": { "S": "$ctx.args.input.shareId" },
    "field": { "S": "command" }
  },
  "attributeValues": {
    "data": $util.dynamodb.toMapValuesJson($ctx.args.input),
    "ttl": { "N": "${ (java.lang.System.currentTimeMillis() / 1000).intValue() + 86400 }" }
  }
}
```

**Response mapping template:**
```
$util.toJson($ctx.args.input)
```

Click **Save**

---

#### Resolver 7: `Mutation.clearCommand`

1. Find `clearCommand(...)` under "Mutation"
2. Click **Attach**
3. Data source: **SharedTable**

**Request mapping template:**
```json
{
  "version": "2017-02-28",
  "operation": "DeleteItem",
  "key": {
    "shareId": { "S": "$ctx.args.shareId" },
    "field": { "S": "command" }
  }
}
```

**Response mapping template:**
```
$util.toJson($ctx.result)
```

Click **Save**

---

#### Resolver 8: `Mutation.removeSharedEvent`

1. Find `removeSharedEvent(...)` under "Mutation"
2. Click **Attach**
3. Data source: **SharedTable**

**Request mapping template:**
```json
{
  "version": "2017-02-28",
  "operation": "DeleteItem",
  "key": {
    "shareId": { "S": "$ctx.args.shareId" },
    "field": { "S": "event" }
  }
}
```

**Response mapping template:**
```
true
```

Click **Save**

---

#### Resolver 9: `Mutation.saveUserEvent`

1. Find `saveUserEvent(...)` under "Mutation"
2. Click **Attach**
3. Data source: **EventsTable**

**Request mapping template:**
```json
{
  "version": "2017-02-28",
  "operation": "PutItem",
  "key": {
    "userId": { "S": "$ctx.identity.sub" },
    "eventId": { "S": "$ctx.args.input.eventId" }
  },
  "attributeValues": {
    "data": { "S": "$util.escapeJavaScript($ctx.args.input.data)" },
    "updatedAt": { "N": "$ctx.args.input.updatedAt" }
  }
}
```

**Response mapping template:**
```
$util.toJson($ctx.result)
```

Click **Save**

---

#### Resolver 10: `Mutation.deleteUserEvent`

1. Find `deleteUserEvent(...)` under "Mutation"
2. Click **Attach**
3. Data source: **EventsTable**

**Request mapping template:**
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

**Response mapping template:**
```
true
```

Click **Save**

---

#### Subscriptions — NO resolvers needed

`onTimerStateUpdate` and `onCommandUpdate` are subscriptions. They use the `@aws_subscribe` directive which means **AppSync handles them automatically**. You do NOT need to attach resolvers to subscriptions. They fire whenever the linked mutations run.

---

### 3.10 — Verify the API works

1. In the left sidebar, click **Queries**
2. You'll see a GraphQL query editor (like a playground)
3. Make sure the auth mode dropdown (top of the editor) is set to **API_KEY** (this should be the default)
4. Paste this test query:

```graphql
query {
  getSharedEvent(shareId: "test") {
    id
    title
  }
}
```

5. Click the orange **Run** button (play icon)
6. You should get a response like:

```json
{
  "data": {
    "getSharedEvent": null
  }
}
```

`null` is correct — there's no shared event with ID "test". The point is that it returned data without errors, which means the API, resolver, and DynamoDB connection all work.

> **Why not test `listUserEvents`?** That query requires Cognito auth (not API key), so it would fail here. You'll test it when you log into the app in Step 6.

If you see an error instead of `null`, check:
- Is the schema saved correctly?
- Are all resolvers attached?
- Is the data source pointing to the correct table?

---

## Step 4: Create your .env file

Now that all services are created, let's connect them to your code.

1. Open your terminal in the ChronoFlip project folder
2. Copy the example file:

```bash
cp .env.example .env
```

3. Open `.env` in your editor and fill in the values:

```env
VITE_AWS_REGION=ap-southeast-1
VITE_COGNITO_USER_POOL_ID=ap-southeast-1_XXXXXXX
VITE_COGNITO_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_APPSYNC_ENDPOINT=https://XXXXX.appsync-api.ap-southeast-1.amazonaws.com/graphql
VITE_APPSYNC_API_KEY=da2-XXXXXXXXXXXXXXXXXXXXXXXX
```

Replace each `XXX` with the actual values you copied:
- **VITE_COGNITO_USER_POOL_ID** → from Step 1.8 (looks like `ap-southeast-1_AbCdEf123`)
- **VITE_COGNITO_CLIENT_ID** → from Step 1.8 (looks like `1a2b3c4d5e6f7g8h9i0j1k2l3m`)
- **VITE_APPSYNC_ENDPOINT** → from Step 3.6 (the full URL ending in `/graphql`)
- **VITE_APPSYNC_API_KEY** → from Step 3.6 (starts with `da2-`)

4. Save the file

---

## Step 5: Create a test user

1. Go back to **Cognito** in the AWS Console
2. Click on your `chronoflip-users` user pool
3. Click the **Users** tab
4. Click **Create user**

**User details:**
- **Invitation message:** Send an email invitation (or "Don't send invitation" if you want to set password manually)
- **Email address:** Your email (e.g., `yashraj@example.com`)
- **Mark email as verified:** **CHECK THIS** (important!)
- **Temporary password:** Set a password you'll remember (e.g., `TempPass123!`)
  - Must meet the password policy: 8+ chars, uppercase, lowercase, number, symbol

Click **Create user**

> When you log in for the first time, Cognito will force you to set a new permanent password. That's what the "Set your new password" screen in our LoginScreen handles.

---

## Step 6: Test locally

1. In your terminal:

```bash
npm run dev
```

2. Open http://localhost:3000 in your browser
3. You should see the **login screen** (ChronoFlip title + email/password form)
4. Enter your email and the **temporary password** from Step 5
5. You'll be prompted to set a **new password** — set it
6. After setting the password, you should be logged in and see the event list
7. Create an event, add a segment, refresh the page — it should persist

**If something doesn't work:**
- Open browser DevTools (F12) → Console tab
- Look for error messages
- Common issues:
  - "User pool does not exist" → wrong VITE_COGNITO_USER_POOL_ID
  - "Network error" → wrong VITE_APPSYNC_ENDPOINT
  - "Unauthorized" → API key or Cognito auth mode not set up correctly

---

## Step 7: Set up Amplify Hosting

This replaces Vercel with AWS hosting.

### 7.1 — Navigate to Amplify

1. In the search bar, type **Amplify**
2. Click **AWS Amplify**

### 7.2 — Create new app

1. Click **New app** → **Host web app** (or just "Get started" if it's your first app)
2. **Source provider:** Select **GitHub**
3. Click **Connect with GitHub**
4. Authorize AWS Amplify to access your GitHub account
5. Select the repository: **chronoflip**
6. Select the branch: **main**
7. Click **Next**

### 7.3 — Configure build settings

Amplify should auto-detect that this is a Vite app (because of `amplify.yml`).

**Build and test settings:**
- Make sure it shows the build commands from `amplify.yml`
- If it shows a different build config, click "Edit" and paste:
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

**Environment variables:**
- Click **Advanced settings** (or look for "Environment variables")
- Add each variable:

| Variable | Value |
|----------|-------|
| `VITE_AWS_REGION` | `ap-southeast-1` |
| `VITE_COGNITO_USER_POOL_ID` | (your value from Step 1.8) |
| `VITE_COGNITO_CLIENT_ID` | (your value from Step 1.8) |
| `VITE_APPSYNC_ENDPOINT` | (your value from Step 3.6) |
| `VITE_APPSYNC_API_KEY` | (your value from Step 3.6) |

Click **Next**

### 7.4 — Review and deploy

- Review everything
- Click **Save and deploy**
- Amplify will now pull your code, build it, and deploy it
- This takes 2-5 minutes

### 7.5 — Add SPA rewrite rule

After deployment completes:

1. In the left sidebar, click **Rewrites and redirects** (under "Hosting")
2. Click **Manage redirects** (or **Edit**)
3. Add a new rule:
   - **Source:** `</^[^.]+$|\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webp|mp3|webmanifest)$)([^.]+$)/>`
   - **Target:** `/index.html`
   - **Type:** `200 (Rewrite)`

   > If that regex is confusing, you can also use the simpler version:
   > - Source: `/<*>`
   > - Target: `/index.html`
   > - Type: `200 (Rewrite)`

4. Click **Save**

### 7.6 — (Optional) Add custom domain

1. In the left sidebar, click **Domain management**
2. Click **Add domain**
3. Enter your domain name
4. Follow the DNS configuration instructions Amplify gives you
5. Amplify auto-provisions an SSL certificate

### 7.7 — Get your deployed URL

After deployment finishes, Amplify gives you a URL like:

```
https://main.d1a2b3c4d5e6f.amplifyapp.com
```

Open it. You should see the login screen!

---

## Step 8: Final verification checklist

Test each of these:

- [ ] **Login works:** Open the URL → see login screen → enter email + password → get in
- [ ] **Events persist:** Create an event → refresh page → event still there
- [ ] **Cloud sync works:** Log in on a different device/browser → same events appear
- [ ] **Share works:** Create an event with segments → tap QR icon → copy the `/view/` URL
- [ ] **Viewer works:** Open the `/view/` URL in incognito (no login needed) → see the timer
- [ ] **Real-time works:** Start a timer → viewer sees countdown updating live
- [ ] **Commands work:** Viewer taps Pause → organiser's timer pauses
- [ ] **Logout works:** Tap logout icon (bottom-right) → returns to login screen

---

## Troubleshooting

### "User pool does not exist" error
- Wrong `VITE_COGNITO_USER_POOL_ID` in `.env`
- Make sure the region in the ID matches your actual region

### "Network error" on login or sync
- Wrong `VITE_APPSYNC_ENDPOINT` in `.env`
- Make sure AppSync API is in the same region

### "Unauthorized" or "Not authorized" errors
- Make sure Cognito is added as an additional auth mode in AppSync (Step 3.7)
- Make sure the API key exists and isn't expired (Step 3.6)

### Timer sync not working (viewer doesn't update)
- Check AppSync subscriptions are working: go to AppSync → Queries → try a subscription
- Make sure the `publishTimerState` resolver is attached (Step 3.9, Resolver 5)

### Events not saving to cloud
- Check AppSync → Queries → run the `listUserEvents` query with your userId
- Make sure `saveUserEvent` resolver is attached (Step 3.9, Resolver 9)

### Build fails on Amplify
- Check the build logs in Amplify Console
- Make sure all env vars are set (Step 7.3)
- Make sure the `amplify.yml` file is committed to git

### "Cannot read properties of undefined" in browser console
- Usually means the `.env` values are missing or wrong
- Check that all 5 env vars are set correctly
- Restart the dev server after changing `.env` (`Ctrl+C` then `npm run dev`)

---

## Quick Reference: All the values you need

Keep this filled in for reference:

```
Region:              ap-southeast-1
Cognito User Pool ID: ___________________________________
Cognito Client ID:    ___________________________________
AppSync Endpoint:     ___________________________________
AppSync API Key:      ___________________________________
Amplify App URL:      ___________________________________
```
