# AWS for Yashraj — Everything You Need to Know

> This document explains every AWS concept relevant to ChronoFlip in plain language.
> No jargon without explanation. Read this once and you'll know what's going on.

---

## What is AWS?

**Amazon Web Services** is Amazon's cloud platform. Instead of buying your own servers, databases, and networking equipment, you rent them from Amazon by the hour/month. They manage the hardware, you configure the software.

Think of it like this:
- **Before cloud:** You buy a computer, put it in a room, install software, connect it to the internet, and hope it doesn't break at 3am.
- **With AWS:** You click a button, Amazon gives you a virtual computer (or database, or whatever) running in their data center. They handle the hardware, power, cooling, and security guards.

AWS has 200+ services. We're using 4.

---

## The 4 Services We're Using

### 1. Cognito — "The Bouncer"

**What it is:** A user authentication service. It handles signups, logins, passwords, and security tokens.

**Why we need it:** Right now, anyone can open ChronoFlip and use it. Your boss wants a login screen so only your team can create/manage events.

**How it works:**
```
User types email + password
        |
        v
Cognito checks: "Is this correct?"
        |
    YES |          NO
        v          v
Returns tokens    "Wrong password"
(like a wristband
at a concert)
```

**What are tokens?** When you log in, Cognito gives your browser 3 tokens (small text strings):
- **ID Token** — proves who you are (like an ID card)
- **Access Token** — proves what you can do (like a keycard)
- **Refresh Token** — lets you stay logged in without re-entering your password (lasts 30 days)

The Amplify SDK stores these in the browser automatically. You never handle them manually.

**What is a User Pool?** A "User Pool" is just Cognito's word for "a list of users." We create one User Pool for ChronoFlip, and all your team's accounts live in it. Think of it like a spreadsheet of users with their hashed passwords.

**What is an App Client?** When your web app talks to Cognito, it needs to identify itself. An "App Client" is like an API key that says "I'm the ChronoFlip web app." It's safe to put in your frontend code — it's not a secret, it just identifies which app is making the request.

---

### 2. DynamoDB — "The Notebook"

**What it is:** A database. It stores your events and segments in the cloud.

**Why we need it:** Right now, everything is saved in `localStorage` — which means your events only exist in YOUR browser. If you open ChronoFlip on a different device, your events aren't there. DynamoDB stores them in the cloud so they're available everywhere.

**How it works:** DynamoDB is a "NoSQL" database. Don't worry about that term — it just means:

| Traditional SQL (like Excel) | DynamoDB (like a filing cabinet) |
|---|---|
| Fixed columns: Name, Age, Email | Each item can have different fields |
| Tables with rows and columns | Tables with items and attributes |
| Need to define schema upfront | Flexible — add fields anytime |

**Our tables:**

**Table 1: `chronoflip-events`** — Your saved events
```
Each item looks like:
{
  userId: "abc-123",          <-- WHO owns this event
  eventId: "evt-456",         <-- WHICH event
  data: { title: "TED Talk", segments: [...] },
  updatedAt: 1710000000000    <-- WHEN it was last changed
}
```

**Table 2: `chronoflip-shared`** — Live shared timer sessions
```
Each item looks like:
{
  shareId: "AbC123xY",        <-- The code from the QR/share link
  field: "timerState",        <-- What kind of data (timerState, event, command)
  data: { status: "running", timeInSeconds: 42, ... },
  ttl: 1710086400             <-- Auto-delete after 24 hours
}
```

**What is a Primary Key (PK) and Sort Key (SK)?** Every DynamoDB table needs a way to find items:
- **PK (Partition Key):** The main identifier. Like the drawer label in a filing cabinet.
- **SK (Sort Key):** The secondary identifier. Like the folder name inside that drawer.

Together, PK + SK uniquely identify one item. Example:
- PK = `userId: "abc-123"` (the drawer)
- SK = `eventId: "evt-456"` (the folder inside)

**What is TTL?** "Time To Live." You set an expiration timestamp on an item, and DynamoDB automatically deletes it when that time passes. We use this for shared timer sessions — they auto-clean after 24 hours so we don't accumulate garbage data.

**What are RCU and WCU?** "Read Capacity Units" and "Write Capacity Units." This is how DynamoDB measures throughput:
- 1 RCU = 1 read per second (up to 4KB)
- 1 WCU = 1 write per second (up to 1KB)

Free tier gives you 25 of each — way more than we need. You'll never think about this.

---

### 3. AppSync — "The Messenger"

**What it is:** A managed GraphQL API with real-time subscriptions. It's the replacement for Firebase's real-time database.

**Why we need it:** When the organiser starts a timer, viewers watching on their phones need to see the countdown update in real-time. Firebase did this with `onValue` listeners. AppSync does it with GraphQL subscriptions over WebSockets.

**What is GraphQL?** A way to ask a server for exactly the data you need:

```
// REST API (traditional):
GET /api/shared/AbC123xY/timerState    → returns everything

// GraphQL:
query {
  getTimerState(shareId: "AbC123xY") {
    status            ← I only want these 2 fields
    timeInSeconds     ←
  }
}
```

You write "queries" (read data), "mutations" (write data), and "subscriptions" (listen for changes in real-time).

**What is a subscription?** A persistent connection between the browser and the server. Instead of asking "has anything changed?" every second (polling), the server pushes updates to you the moment they happen:

```
Polling (bad):                    Subscriptions (good):
Browser: "Any updates?"           Browser: "Tell me when timer changes"
Server: "No"                      Server: "OK, I'll push updates to you"
Browser: "Any updates?"           ...
Server: "No"                      Server: "Timer changed! Here's the new state"
Browser: "Any updates?"           Server: "Changed again! Here you go"
Server: "Yes! Here's the data"
```

Firebase's `onValue` was a subscription. AppSync subscriptions work the same way, just with GraphQL syntax.

**What is a resolver?** When AppSync receives a query, it needs to know WHERE to get the data. A "resolver" is the instruction that says "when someone asks for `getTimerState`, go to DynamoDB table X, look up item with PK=shareId." Think of it as the wiring between the API and the database.

**Auth modes in AppSync:**
- **Cognito auth:** "Only logged-in users can do this" — used for publishing timer state, creating events
- **API Key auth:** "Anyone can do this" — used for viewers watching a shared timer (they don't need to log in)

---

### 4. Amplify Hosting — "The Stage"

**What it is:** A hosting service that builds and deploys your web app from a GitHub repo. Like Vercel or Netlify.

**Why we need it:** You're currently on Vercel. Since we're going full AWS, hosting moves to Amplify.

**How it works:**
```
You push code to GitHub
        |
        v
Amplify detects the push
        |
        v
Amplify runs: npm ci → npm run build
        |
        v
Takes the dist/ folder and puts it on AWS's CDN
        |
        v
Your site is live at your custom domain with HTTPS
```

**What is a CDN?** "Content Delivery Network." Your website files get copied to servers around the world (called "edge locations"). When someone in Tokyo visits your site, they get files from a server in Tokyo — not from a server in Virginia. This makes the site fast everywhere.

**What is SPA routing?** ChronoFlip is a Single Page Application — there's only one HTML file (`index.html`), and React handles routing in the browser. When someone visits `/view/AbC123xY`, the server needs to return `index.html` (not look for a file called `AbC123xY`). Amplify handles this with a rewrite rule:
```
Any URL → serve index.html → React reads the URL and shows the right screen
```

---

## Concepts You'll Hear About

### IAM — "The Permission System"

**IAM (Identity and Access Management)** controls who can do what in your AWS account. Think of it like file permissions on a computer, but for cloud services.

- **Root account:** The account your boss created when signing up for AWS. Has unlimited power. NEVER use this for daily work.
- **IAM User:** A sub-account with limited permissions. Your boss should create one for you.
- **IAM Role:** A set of permissions that a service (not a person) can assume. Example: "AppSync is allowed to read from DynamoDB."
- **IAM Policy:** A document that says what's allowed. Example: "Allow `dynamodb:GetItem` on table `chronoflip-events`."

**You probably won't write IAM policies manually.** Amplify and the AWS Console generate them for you. But when you see "permission denied" errors, it's always IAM.

---

### Regions — "Where Your Stuff Lives"

AWS has data centers around the world. Each location is called a "Region":

| Region Code | Location |
|---|---|
| `us-east-1` | Virginia, USA (most services launch here first) |
| `ap-southeast-1` | Singapore |
| `ap-northeast-1` | Tokyo |
| `eu-west-1` | Ireland |

**Important:** Each service you create lives in ONE region. Your DynamoDB table in Singapore can't magically talk to an AppSync in Tokyo. **Keep everything in the same region.**

For ChronoFlip, we'll use `ap-southeast-1` (Singapore) — closest to both Japan and Southeast Asia.

---

### Environment Variables — "Secret Settings"

Your app needs to know things like "where is my Cognito User Pool?" and "what's the AppSync endpoint?" These are **environment variables** — settings that change between environments (dev vs production) but shouldn't be hardcoded in your source code.

In Vite, env vars that start with `VITE_` are available in your frontend code:

```ts
// In your code:
const region = import.meta.env.VITE_AWS_REGION;  // "ap-southeast-1"

// These are set in:
// - .env file (local development)
// - Amplify Console (production)
```

**Are these secret?** No! Frontend env vars are bundled into your JavaScript — anyone can see them in browser DevTools. That's fine. Cognito Pool IDs and AppSync endpoints are designed to be public. The security comes from Cognito tokens and IAM permissions, not from hiding these values.

---

### SSL/HTTPS — "The Lock Icon"

When you see the padlock in your browser's address bar, that means the connection is encrypted with SSL/TLS. Nobody between you and the server (your ISP, public WiFi hackers) can read the traffic.

Amplify Hosting gives you HTTPS automatically. You don't need to do anything.

---

### Cron Jobs — "Scheduled Tasks"

**What is a cron job?** A task that runs automatically on a schedule. The name comes from Unix's `cron` daemon (a background process that runs scheduled commands).

Examples:
```
"Every night at 3am, clean up expired sessions"
"Every Monday, send a usage report"
"Every 5 minutes, check if the server is healthy"
```

**The format:**
```
* * * * *
| | | | |
| | | | +-- Day of week (0=Sunday, 6=Saturday)
| | | +---- Month (1-12)
| | +------ Day of month (1-31)
| +-------- Hour (0-23)
+---------- Minute (0-59)
```

Examples:
```
0 3 * * *     = "At 3:00 AM every day"
*/5 * * * *   = "Every 5 minutes"
0 9 * * 1     = "At 9:00 AM every Monday"
```

**Do we need cron jobs for ChronoFlip?** Not really. DynamoDB's TTL handles cleanup automatically (expired shared sessions delete themselves). If we ever need scheduled tasks, AWS has **EventBridge** (formerly CloudWatch Events) — it's like cron but in the cloud. You define a schedule and it triggers a Lambda function.

---

### Lambda — "Code Without a Server"

**What is Lambda?** A service that runs your code without you managing a server. You upload a function, and AWS runs it when triggered.

```
Something happens (API call, schedule, etc.)
        |
        v
AWS spins up a tiny container
        |
        v
Your function runs (e.g., "process this data")
        |
        v
Container shuts down (you stop paying)
```

**Do we need Lambda for ChronoFlip?** AppSync can connect directly to DynamoDB without Lambda (using "direct resolvers"). So for now, no Lambda needed. If we add complex server-side logic later (like sending email notifications), we'd use Lambda.

**What is a "cold start"?** The first time Lambda runs your function (or if it hasn't run in ~15 minutes), it takes 1-3 seconds to start up the container. After that, subsequent calls are fast (~50ms). This matters for real-time features, which is why we chose AppSync (always-on) over Lambda for timer sync.

---

### CloudFormation / CDK — "Infrastructure as Code"

Instead of clicking buttons in the AWS Console to create services, you can describe your infrastructure in code:

- **CloudFormation:** AWS's template language (YAML/JSON files)
- **CDK (Cloud Development Kit):** Write infrastructure in TypeScript/Python instead of YAML

Example in CDK:
```ts
const table = new dynamodb.Table(this, 'Events', {
  partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
});
```

**Do we need this?** For the initial migration, no — we'll set up services through the AWS Console (click-and-configure). But for a production app long-term, CDK is better because:
- Your infrastructure is version-controlled (in git)
- You can recreate everything from scratch with one command
- No "I forgot what settings I used" problems

We can add CDK later as a follow-up.

---

## How It All Fits Together

Here's the full flow of what happens when someone uses ChronoFlip after migration:

### Organiser opens the app
```
1. Browser loads chronoflip from Amplify Hosting (CDN)
2. React app starts, checks: "Is user logged in?"
3. No → Show LoginScreen
4. User enters email + password
5. Cognito validates → returns tokens → stores in browser
6. App loads → fetches events from DynamoDB (via AppSync)
7. Also loads events from localStorage cache (instant)
8. Merges: cloud version wins if newer
9. User sees their events
```

### Organiser starts a timer and shares it
```
1. User clicks "Start" on an event
2. Timer begins counting
3. Every second, app calls AppSync mutation: publishTimerState
4. AppSync writes to DynamoDB (shared table)
5. AppSync pushes update to all subscribers (viewers)
```

### Viewer opens shared link
```
1. Someone scans QR code → opens /view/AbC123xY
2. Browser loads app from Amplify Hosting
3. React sees the /view/ route → renders ViewerScreen
4. NO LOGIN NEEDED (API key auth)
5. ViewerScreen subscribes to AppSync: onTimerStateUpdate(shareId: "AbC123xY")
6. Real-time updates flow in via WebSocket
7. Viewer sees the live countdown
```

### Viewer sends a command (remote control)
```
1. Viewer taps "Pause" button
2. App calls AppSync mutation: publishCommand(type: "pause")
3. AppSync pushes to organiser via onCommandUpdate subscription
4. Organiser's app receives command → pauses timer
```

---

## Common "Wait, What?" Moments

**Q: If env vars are public, how is anything secure?**
A: Security comes from Cognito tokens, not hidden config. Think of it like a bank: the address is public (env var), but you still need your ID and PIN (Cognito tokens) to access your account. AppSync checks your token on every request.

**Q: What if DynamoDB goes down?**
A: AWS guarantees 99.999% uptime for DynamoDB. It's replicated across multiple data centers automatically. In the extremely unlikely event it goes down, your app still works locally (localStorage cache) — you just can't sync until it's back.

**Q: What if I accidentally delete something in AWS Console?**
A: DynamoDB has point-in-time recovery (can restore to any second in the last 35 days). Cognito users can be re-created. AppSync schema is in our code. The most important thing is: your infrastructure setup should eventually be in CDK (code), so you can recreate everything.

**Q: How do I see logs and errors?**
A: AWS CloudWatch is where all logs go. Every service (AppSync, Cognito, DynamoDB) sends logs there. In the AWS Console, go to CloudWatch → Log Groups → find the service you're debugging.

**Q: How much will this cost?**
A: Nothing for our usage level. See the cost table in `aws.md`. If somehow you exceed free tier, you'll get a billing alert (set one up in AWS Budgets — set to $1 so you're notified immediately).

---

## Glossary

| Term | Plain English |
|------|---------------|
| **ARN** | "Amazon Resource Name" — a unique ID for any AWS resource, like `arn:aws:dynamodb:ap-southeast-1:123456:table/chronoflip-events` |
| **SDK** | "Software Development Kit" — a library you install (`aws-amplify`) that handles talking to AWS services |
| **API** | "Application Programming Interface" — a way for your code to talk to a service over the internet |
| **Endpoint** | The URL where a service lives, like `https://xxx.appsync-api.ap-southeast-1.amazonaws.com/graphql` |
| **WebSocket** | A persistent two-way connection between browser and server (used for real-time subscriptions) |
| **Mutation** | GraphQL term for "write/change data" (like POST in REST) |
| **Query** | GraphQL term for "read data" (like GET in REST) |
| **Subscription** | GraphQL term for "listen for real-time changes" (like Firebase `onValue`) |
| **Resolver** | The code/config that connects a GraphQL operation to a data source (DynamoDB) |
| **Token** | A short-lived string that proves you're authenticated (like a concert wristband) |
| **CDN** | "Content Delivery Network" — copies your files to servers worldwide for fast access |
| **Edge Location** | One of AWS's 600+ CDN servers around the world |
| **SPA** | "Single Page Application" — one HTML file, JavaScript handles all routing |
| **TTL** | "Time To Live" — automatic expiration/deletion of data |
| **Cold Start** | The delay when Lambda spins up a container for the first time |
| **Provisioned** | You pre-set capacity (fixed cost). Opposite: "on-demand" (pay per use) |
| **Free Tier** | Services that are free up to a certain usage level. Some are "always free," others are "12 months free" |

---

## Your Next Steps

1. **Read `aws.md`** — the technical architecture doc (for reference during implementation)
2. **Get AWS Console access** — ask your boss for an IAM user with admin permissions
3. **Set up AWS CLI** — `npm install -g aws-cdk` and `aws configure` with your access keys
4. **Set a billing alarm** — AWS Console → Budgets → create a $1 alert so you're never surprised
5. **We build it together** — I'll walk you through every step during implementation
