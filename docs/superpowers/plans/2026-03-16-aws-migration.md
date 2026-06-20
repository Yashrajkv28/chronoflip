# AWS Migration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate ChronoFlip from Firebase + Vercel to AWS (Cognito + AppSync + DynamoDB + Amplify Hosting) and add email+password login for organisers.

**Architecture:** Full Amplify stack. Cognito authenticates organisers (email+password). AppSync provides GraphQL API with real-time subscriptions (replacing Firebase `onValue`). DynamoDB stores events and shared timer state. localStorage caches events for instant loads. Viewers stay anonymous (API key auth).

**Tech Stack:** React 19, TypeScript 5.8, Vite 6, aws-amplify v6, AWS Cognito, AWS AppSync, AWS DynamoDB, AWS Amplify Hosting

**Spec:** See `aws.md` (architecture) and `yashraj.md` (concepts) in project root.

---

## File Structure

### New files
| File | Responsibility |
|------|----------------|
| `services/awsConfig.ts` | Single `Amplify.configure()` call with all AWS service config |
| `services/authService.ts` | Wraps Cognito: `signIn`, `signOut`, `getCurrentUser`, `isAuthenticated`, `completeNewPasswordChallenge` |
| `services/graphql/mutations.ts` | GraphQL mutation strings for AppSync |
| `services/graphql/queries.ts` | GraphQL query strings for AppSync |
| `services/graphql/subscriptions.ts` | GraphQL subscription strings for AppSync |
| `components/screens/LoginScreen.tsx` | Email+password login form (glassmorphic, matches app style) |
| `hooks/useAuth.ts` | React hook: auth state, loading, user object |
| `.env.example` | Template for required env vars |

### Modified files
| File | Changes |
|------|---------|
| `services/syncService.ts` | Full rewrite: Firebase → AppSync (same 8 exported functions) |
| `hooks/usePersistence.ts` | Rewrite: add DynamoDB sync + localStorage cache |
| `index.tsx` | Add auth gate: check session → render LoginScreen or App |
| `App.tsx` | Add logout button in header, receive `onLogout` prop |
| `types.ts` | Add `AuthUser` type |
| `package.json` | Remove `firebase`, add `aws-amplify` |
| `vite.config.ts` | Remove firebase chunk, add aws-amplify chunk |

### Deleted files
| File | Reason |
|------|--------|
| `services/firebaseConfig.ts` | Replaced by `services/awsConfig.ts` |

---

## Chunk 1: AWS SDK Setup + Auth Service

### Task 1: Install aws-amplify, remove firebase

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install aws-amplify**

```bash
npm install aws-amplify
```

Expected: `aws-amplify` added to `dependencies` in package.json.

- [ ] **Step 2: Verify install succeeded**

```bash
npm ls aws-amplify
```

Expected: Shows aws-amplify version (v6.x).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add aws-amplify dependency"
```

---

### Task 2: Create .env.example and .env

**Files:**
- Create: `.env.example`
- Create: `.env` (gitignored)

- [ ] **Step 1: Create .env.example with all required vars**

```env
# AWS Region (e.g., ap-southeast-1)
VITE_AWS_REGION=

# Cognito User Pool
VITE_COGNITO_USER_POOL_ID=
VITE_COGNITO_CLIENT_ID=

# AppSync GraphQL API
VITE_APPSYNC_ENDPOINT=
VITE_APPSYNC_API_KEY=
```

- [ ] **Step 2: Create .env with actual values**

Copy `.env.example` to `.env` and fill in the real values from the AWS Console. These values are obtained after completing the AWS Console setup (Task 3).

- [ ] **Step 3: Verify .env is in .gitignore**

Check that `.gitignore` contains `.env`. If not, add it.

- [ ] **Step 4: Commit**

```bash
git add .env.example .gitignore
git commit -m "chore: add env var template for AWS config"
```

---

### Task 3: Create AWS resources in Console

> This task is done in the AWS Console (browser), not in code.

- [ ] **Step 1: Create Cognito User Pool**

1. AWS Console → Cognito → Create User Pool
2. Sign-in: Email only
3. Password policy: Cognito defaults (8+ chars, upper, lower, number, symbol)
4. MFA: No MFA (for now)
5. Self-registration: **Disabled** (admin creates accounts only — shared team credentials)
6. Email: Send with Cognito (free tier)
7. App client: `chronoflip-web` (no client secret — SPA)
8. Region: `ap-southeast-1`

Note the **User Pool ID** and **App Client ID**.

- [ ] **Step 2: Create DynamoDB tables**

**Table 1: `chronoflip-events`**
- Partition key: `userId` (String)
- Sort key: `eventId` (String)
- Settings: On-demand capacity
- No TTL needed

**Table 2: `chronoflip-shared`**
- Partition key: `shareId` (String)
- Sort key: `field` (String)
- Settings: On-demand capacity
- TTL: Enable on attribute `ttl`

- [ ] **Step 3: Create AppSync API**

1. AWS Console → AppSync → Create API → "Build from scratch"
2. API name: `chronoflip-api`
3. Auth mode: **API Key** (default, for viewers)
4. Additional auth: **Amazon Cognito User Pool** (for organisers)
5. Add the GraphQL schema from `aws.md` section 3
6. Create resolvers connecting mutations/queries to DynamoDB tables
7. Set auth directives:
   - Queries: `@aws_api_key` (public)
   - Mutations that write shared data: `@aws_cognito_user_pools` (organisers) + `@aws_api_key` (for viewer commands like publishCommand)
   - Subscriptions: `@aws_api_key` (public)

Note the **AppSync endpoint URL** and **API Key**.

- [ ] **Step 4: Create IAM role for AppSync → DynamoDB**

AppSync needs permission to read/write DynamoDB. When creating resolvers in the AppSync console, it offers to create a role automatically. Accept the auto-generated role.

- [ ] **Step 5: Fill in .env with values from steps 1-3**

```env
VITE_AWS_REGION=ap-southeast-1
VITE_COGNITO_USER_POOL_ID=ap-southeast-1_XXXXXXX
VITE_COGNITO_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_APPSYNC_ENDPOINT=https://XXXXX.appsync-api.ap-southeast-1.amazonaws.com/graphql
VITE_APPSYNC_API_KEY=da2-XXXXXXXXXXXXXXXXXXXXXXXX
```

- [ ] **Step 6: Create a test user in Cognito**

AWS Console → Cognito → User Pool → Users → Create User
- Email: your team email
- Temporary password: set one, you'll be forced to change on first login

---

### Task 4: Create awsConfig.ts

**Files:**
- Create: `services/awsConfig.ts`

- [ ] **Step 1: Write the Amplify configuration file**

```ts
import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
    },
  },
  API: {
    GraphQL: {
      endpoint: import.meta.env.VITE_APPSYNC_ENDPOINT,
      defaultAuthMode: 'apiKey',
      apiKey: import.meta.env.VITE_APPSYNC_API_KEY,
      region: import.meta.env.VITE_AWS_REGION,
    },
  },
});
```

- [ ] **Step 2: Verify it compiles**

```bash
npm run build
```

If there's a type error for `import.meta.env`, ensure `vite/client` types are included in tsconfig (should already be present).

- [ ] **Step 3: Commit**

```bash
git add services/awsConfig.ts
git commit -m "feat: add AWS Amplify configuration"
```

---

### Task 5: Create authService.ts

**Files:**
- Create: `services/authService.ts`

- [ ] **Step 1: Write the auth service**

```ts
import {
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  getCurrentUser as amplifyGetCurrentUser,
  fetchAuthSession,
  type SignInOutput,
} from 'aws-amplify/auth';

export interface AuthUser {
  userId: string;
  email: string;
}

export async function signIn(email: string, password: string): Promise<SignInOutput> {
  return amplifySignIn({ username: email, password });
}

export async function signOut(): Promise<void> {
  await amplifySignOut();
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const user = await amplifyGetCurrentUser();
    const session = await fetchAuthSession();
    const email = (session.tokens?.idToken?.payload?.email as string) ?? user.signInDetails?.loginId ?? '';
    return {
      userId: user.userId,
      email,
    };
  } catch {
    return null;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  try {
    await amplifyGetCurrentUser();
    return true;
  } catch {
    return false;
  }
}

export async function completeNewPasswordChallenge(newPassword: string): Promise<SignInOutput> {
  // Amplify v6 handles NEW_PASSWORD_REQUIRED via confirmSignIn
  const { confirmSignIn } = await import('aws-amplify/auth');
  return confirmSignIn({ challengeResponse: newPassword });
}
```

- [ ] **Step 2: Commit**

```bash
git add services/authService.ts
git commit -m "feat: add auth service wrapping Cognito"
```

---

### Task 6: Add AuthUser type to types.ts

**Files:**
- Modify: `types.ts`

- [ ] **Step 1: Add AuthUser type at end of types section**

After the `ViewerCommand` interface (line 56), add:

```ts
// ========== Auth ==========

export type { AuthUser } from './services/authService';
```

- [ ] **Step 2: Commit**

```bash
git add types.ts
git commit -m "feat: re-export AuthUser type from types.ts"
```

---

### Task 7: Create useAuth hook

**Files:**
- Create: `hooks/useAuth.ts`

- [ ] **Step 1: Write the auth hook**

```ts
import { useState, useEffect, useCallback } from 'react';
import type { AuthUser } from '../services/authService';
import { getCurrentUser, signOut as authSignOut } from '../services/authService';
import { Hub } from 'aws-amplify/utils';

interface UseAuthReturn {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();

    // Listen for Amplify auth events (sign in, sign out, token refresh)
    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      switch (payload.event) {
        case 'signedIn':
          refreshUser();
          break;
        case 'signedOut':
          setUser(null);
          break;
      }
    });

    return unsubscribe;
  }, [refreshUser]);

  const handleSignOut = useCallback(async () => {
    await authSignOut();
    setUser(null);
  }, []);

  return { user, loading, signOut: handleSignOut, refreshUser };
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/useAuth.ts
git commit -m "feat: add useAuth hook for auth state management"
```

---

## Chunk 2: Login Screen + Auth Gate

### Task 8: Create LoginScreen

**Files:**
- Create: `components/screens/LoginScreen.tsx`

- [ ] **Step 1: Write the login screen component**

This matches the existing glassmorphic style of ChronoFlip. It handles:
- Email + password form
- Loading state during sign-in
- Error display
- NEW_PASSWORD_REQUIRED challenge (first login with temp password)

```tsx
import React, { useState } from 'react';
import { signIn, completeNewPasswordChallenge } from '../../services/authService';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [needsNewPassword, setNeedsNewPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn(email, password);

      if (result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        setNeedsNewPassword(true);
        setLoading(false);
        return;
      }

      if (result.isSignedIn) {
        onLoginSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Sign in failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await completeNewPasswordChallenge(newPassword);
      if (result.isSignedIn) {
        onLoginSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to set new password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] flex items-center justify-center p-6 light-mesh-bg">
      <div className="w-full max-w-sm">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-zinc-800 tracking-tight">ChronoFlip</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {needsNewPassword ? 'Set your new password' : 'Sign in to continue'}
          </p>
        </div>

        {/* Glass card */}
        <div className="p-6 rounded-2xl bg-white/40 backdrop-blur-2xl border border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
          {needsNewPassword ? (
            <form onSubmit={handleNewPassword} className="space-y-4">
              <div>
                <label htmlFor="new-password" className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoFocus
                  minLength={8}
                  className="w-full px-4 py-3 rounded-xl bg-white/60 border border-zinc-200/60 text-zinc-800 text-sm outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                  placeholder="Min 8 characters"
                />
              </div>

              {error && (
                <p className="text-xs text-red-500 bg-red-50/50 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !newPassword}
                className="w-full py-3.5 rounded-xl text-sm font-bold bg-blue-500/20 text-blue-600 border border-blue-500/30 hover:bg-blue-500/30 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              >
                {loading ? 'Setting password...' : 'Set Password & Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="email"
                  className="w-full px-4 py-3 rounded-xl bg-white/60 border border-zinc-200/60 text-zinc-800 text-sm outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                  placeholder="you@company.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-3 rounded-xl bg-white/60 border border-zinc-200/60 text-zinc-800 text-sm outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                  placeholder="Enter your password"
                />
              </div>

              {error && (
                <p className="text-xs text-red-500 bg-red-50/50 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full py-3.5 rounded-xl text-sm font-bold bg-emerald-500/20 text-emerald-600 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-[10px] text-zinc-400 mt-6">
          Contact your administrator for account access
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;
```

- [ ] **Step 2: Commit**

```bash
git add components/screens/LoginScreen.tsx
git commit -m "feat: add login screen with glassmorphic UI"
```

---

### Task 9: Wire auth gate into index.tsx

**Files:**
- Modify: `index.tsx`

- [ ] **Step 1: Rewrite index.tsx with auth gate**

Replace the entire content of `index.tsx` with:

```tsx
import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import './services/awsConfig'; // Must be first — configures Amplify
import App from './App';
import './styles.css';

const ViewerScreen = React.lazy(() => import('./components/screens/ViewerScreen'));
const AuthGate = React.lazy(() => import('./components/AuthGate'));

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const path = window.location.pathname;
const viewMatch = path.match(/^\/view\/([A-Za-z0-9]{4,16})$/);

const loadingSpinner = (
  <div className="h-[100dvh] flex items-center justify-center light-mesh-bg">
    <div className="text-center space-y-4">
      <div className="w-10 h-10 border-[3px] border-zinc-300 border-t-zinc-600 rounded-full animate-spin mx-auto" />
      <p className="text-zinc-400 text-sm">Loading...</p>
    </div>
  </div>
);

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {viewMatch ? (
      <Suspense fallback={loadingSpinner}>
        <ViewerScreen shareId={viewMatch[1]} />
      </Suspense>
    ) : (
      <Suspense fallback={loadingSpinner}>
        <AuthGate>
          <App />
        </AuthGate>
      </Suspense>
    )}
  </React.StrictMode>
);
```

- [ ] **Step 2: Create AuthGate component**

Create `components/AuthGate.tsx`:

```tsx
import React from 'react';
import { useAuth } from '../hooks/useAuth';
import LoginScreen from './screens/LoginScreen';

interface AuthGateProps {
  children: React.ReactNode;
}

const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const { user, loading, refreshUser } = useAuth();

  if (loading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center light-mesh-bg">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-[3px] border-zinc-300 border-t-zinc-600 rounded-full animate-spin mx-auto" />
          <p className="text-zinc-400 text-sm">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLoginSuccess={refreshUser} />;
  }

  return <>{children}</>;
};

export default AuthGate;
```

- [ ] **Step 3: Verify the app builds**

```bash
npm run build
```

Expected: Build succeeds. At this point the app will show the login screen when visiting `/`, and the viewer still works without login at `/view/:shareId`.

- [ ] **Step 4: Commit**

```bash
git add index.tsx components/AuthGate.tsx
git commit -m "feat: add auth gate — login required for organiser app"
```

---

### Task 10: Add logout button to App.tsx

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Import useAuth and add logout to EventListScreen header area**

At the top of `App.tsx`, add import:

```ts
import { useAuth } from './hooks/useAuth';
```

Inside the `App` component, add after the existing state declarations:

```ts
const { user, signOut: handleLogout } = useAuth();
```

- [ ] **Step 2: Add logout button to the global UI section**

In the `{showGlobalUI && (` block (around line 230), add a logout button next to the help button:

```tsx
{showGlobalUI && (
  <>
    <button
      type="button"
      onClick={handleLogout}
      title="Sign out"
      aria-label="Sign out"
      className="fixed bottom-6 right-6 z-50 p-3 rounded-full
                 bg-white/20 backdrop-blur-md
                 border border-white/20
                 shadow-lg hover:scale-110 transition-all duration-200"
    >
      <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
    </button>
    <button
      type="button"
      onClick={() => setShowHelp(true)}
      title="Help & Keyboard Shortcuts"
      aria-label="Open help and keyboard shortcuts"
      className="fixed bottom-6 left-6 z-50 p-3 rounded-full
                 bg-white/20 backdrop-blur-md
                 border border-white/20
                 shadow-lg hover:scale-110 transition-all duration-200"
    >
      <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" />
      </svg>
    </button>
  </>
)}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add App.tsx
git commit -m "feat: add logout button to global UI"
```

---

## Chunk 3: GraphQL Schema + Sync Service Rewrite

### Task 11: Create GraphQL operation strings

**Files:**
- Create: `services/graphql/queries.ts`
- Create: `services/graphql/mutations.ts`
- Create: `services/graphql/subscriptions.ts`

- [ ] **Step 1: Create queries.ts**

```ts
export const getSharedEvent = /* GraphQL */ `
  query GetSharedEvent($shareId: String!) {
    getSharedEvent(shareId: $shareId) {
      id
      title
      segments {
        id
        name
        durationSeconds
        mode
        color
      }
      scheduledStartTime
    }
  }
`;

export const getTimerState = /* GraphQL */ `
  query GetTimerState($shareId: String!) {
    getTimerState(shareId: $shareId) {
      shareId
      status
      currentSegmentIndex
      timeInSeconds
      segmentName
      segmentMode
      totalSegments
      activeAlertColor
      isFlashing
      lastUpdatedAt
      eventTitle
      scheduledStartTime
    }
  }
`;

export const listUserEvents = /* GraphQL */ `
  query ListUserEvents($userId: String!) {
    listUserEvents(userId: $userId) {
      userId
      eventId
      data
      updatedAt
    }
  }
`;
```

- [ ] **Step 2: Create mutations.ts**

```ts
export const publishEventMutation = /* GraphQL */ `
  mutation PublishEvent($shareId: String!, $event: SharedEventInput!) {
    publishEvent(shareId: $shareId, event: $event) {
      id
      title
    }
  }
`;

export const publishTimerStateMutation = /* GraphQL */ `
  mutation PublishTimerState($input: TimerStateInput!) {
    publishTimerState(input: $input) {
      shareId
      status
      timeInSeconds
      lastUpdatedAt
    }
  }
`;

export const publishCommandMutation = /* GraphQL */ `
  mutation PublishCommand($input: CommandInput!) {
    publishCommand(input: $input) {
      shareId
      type
      timestamp
    }
  }
`;

export const clearCommandMutation = /* GraphQL */ `
  mutation ClearCommand($shareId: String!) {
    clearCommand(shareId: $shareId)
  }
`;

export const removeSharedEventMutation = /* GraphQL */ `
  mutation RemoveSharedEvent($shareId: String!) {
    removeSharedEvent(shareId: $shareId)
  }
`;

export const saveUserEventMutation = /* GraphQL */ `
  mutation SaveUserEvent($input: UserEventInput!) {
    saveUserEvent(input: $input) {
      userId
      eventId
      updatedAt
    }
  }
`;

export const deleteUserEventMutation = /* GraphQL */ `
  mutation DeleteUserEvent($userId: String!, $eventId: String!) {
    deleteUserEvent(userId: $userId, eventId: $eventId)
  }
`;
```

- [ ] **Step 3: Create subscriptions.ts**

```ts
export const onTimerStateUpdate = /* GraphQL */ `
  subscription OnTimerStateUpdate($shareId: String!) {
    onTimerStateUpdate(shareId: $shareId) {
      shareId
      status
      currentSegmentIndex
      timeInSeconds
      segmentName
      segmentMode
      totalSegments
      activeAlertColor
      isFlashing
      lastUpdatedAt
      eventTitle
      scheduledStartTime
    }
  }
`;

export const onCommandUpdate = /* GraphQL */ `
  subscription OnCommandUpdate($shareId: String!) {
    onCommandUpdate(shareId: $shareId) {
      shareId
      type
      timestamp
    }
  }
`;
```

- [ ] **Step 4: Commit**

```bash
git add services/graphql/
git commit -m "feat: add GraphQL operation strings for AppSync"
```

---

### Task 12: Rewrite syncService.ts (Firebase → AppSync)

**Files:**
- Rewrite: `services/syncService.ts`

This is the most critical file. The exported function signatures MUST remain identical so no other file needs to change.

- [ ] **Step 1: Replace entire syncService.ts**

```ts
import { generateClient } from 'aws-amplify/api';
import type { SpeechEvent, TimerSyncState, ViewerCommand } from '../types';
import { getSharedEvent } from './graphql/queries';
import {
  publishEventMutation,
  publishTimerStateMutation,
  publishCommandMutation,
  clearCommandMutation,
  removeSharedEventMutation,
} from './graphql/mutations';
import { onTimerStateUpdate, onCommandUpdate } from './graphql/subscriptions';

const client = generateClient();

// Allowed characters in share IDs (alphanumeric, no ambiguous chars)
const SHARE_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const SHARE_ID_RE = /^[A-Za-z0-9]{4,16}$/;

type Unsubscribe = () => void;

function generateShareId(): string {
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  return Array.from(array, b => SHARE_ID_CHARS[b % SHARE_ID_CHARS.length]).join('');
}

function validateShareId(shareId: string): boolean {
  return SHARE_ID_RE.test(shareId);
}

export async function publishEvent(event: SpeechEvent): Promise<string> {
  const shareId = event.shareId || generateShareId();

  await client.graphql({
    query: publishEventMutation,
    variables: {
      shareId,
      event: {
        id: event.id,
        title: event.title,
        segments: event.segments.map(s => ({
          id: s.id,
          name: s.name,
          durationSeconds: s.durationSeconds,
          mode: s.mode,
          color: s.color,
        })),
        scheduledStartTime: event.scheduledStartTime ?? null,
      },
    },
    authMode: 'userPool',
  });

  return shareId;
}

export async function publishTimerState(shareId: string, state: TimerSyncState): Promise<void> {
  if (!validateShareId(shareId)) return;
  await client.graphql({
    query: publishTimerStateMutation,
    variables: {
      input: { shareId, ...state },
    },
    authMode: 'userPool',
  });
}

export function subscribeToTimerState(
  shareId: string,
  callback: (state: TimerSyncState | null) => void,
): Unsubscribe {
  if (!validateShareId(shareId)) {
    callback(null);
    return () => {};
  }

  const sub = client.graphql({
    query: onTimerStateUpdate,
    variables: { shareId },
    authMode: 'apiKey',
  }).subscribe({
    next: ({ data }: any) => {
      const val = data?.onTimerStateUpdate;
      callback(val ?? null);
    },
    error: (err: any) => {
      console.error('Timer state subscription error:', err);
      callback(null);
    },
  });

  return () => sub.unsubscribe();
}

export async function fetchSharedEvent(shareId: string): Promise<SpeechEvent | null> {
  if (!validateShareId(shareId)) return null;
  try {
    const result: any = await client.graphql({
      query: getSharedEvent,
      variables: { shareId },
      authMode: 'apiKey',
    });
    return result.data?.getSharedEvent ?? null;
  } catch {
    return null;
  }
}

export async function removeSharedEvent(shareId: string): Promise<void> {
  if (!validateShareId(shareId)) return;
  await client.graphql({
    query: removeSharedEventMutation,
    variables: { shareId },
    authMode: 'userPool',
  });
}

export async function publishCommand(shareId: string, command: ViewerCommand): Promise<void> {
  if (!validateShareId(shareId)) return;
  await client.graphql({
    query: publishCommandMutation,
    variables: {
      input: { shareId, ...command },
    },
    authMode: 'apiKey', // Viewers can send commands without login
  });
}

export function subscribeToCommand(
  shareId: string,
  callback: (command: ViewerCommand | null) => void,
): Unsubscribe {
  if (!validateShareId(shareId)) {
    callback(null);
    return () => {};
  }

  const sub = client.graphql({
    query: onCommandUpdate,
    variables: { shareId },
    authMode: 'apiKey',
  }).subscribe({
    next: ({ data }: any) => {
      const val = data?.onCommandUpdate;
      if (val && typeof val.type === 'string' && typeof val.timestamp === 'number') {
        callback(val as ViewerCommand);
      } else {
        callback(null);
      }
    },
    error: (err: any) => {
      console.error('Command subscription error:', err);
      callback(null);
    },
  });

  return () => sub.unsubscribe();
}

export async function clearCommand(shareId: string): Promise<void> {
  if (!validateShareId(shareId)) return;
  await client.graphql({
    query: clearCommandMutation,
    variables: { shareId },
    authMode: 'userPool',
  });
}
```

- [ ] **Step 2: Verify no import errors in consuming files**

The following files import from syncService — verify they still compile:
- `components/screens/TimerRunningScreen.tsx` — imports `publishTimerState`, `subscribeToCommand`, `clearCommand`
- `components/screens/ViewerScreen.tsx` — imports `fetchSharedEvent`, `subscribeToTimerState`, `publishCommand`
- `components/screens/EventSettingsScreen.tsx` — imports `publishEvent`
- `App.tsx` — imports `removeSharedEvent`

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add services/syncService.ts
git commit -m "feat: rewrite syncService from Firebase to AppSync"
```

---

## Chunk 4: Persistence Rewrite (DynamoDB + localStorage)

### Task 13: Rewrite usePersistence.ts

**Files:**
- Rewrite: `hooks/usePersistence.ts`

- [ ] **Step 1: Replace entire usePersistence.ts**

```ts
import { generateClient } from 'aws-amplify/api';
import type { SpeechEvent, AppState } from '../types';
import { listUserEvents } from '../services/graphql/queries';
import {
  saveUserEventMutation,
  deleteUserEventMutation,
} from '../services/graphql/mutations';

const EVENTS_KEY = 'chronoflip-v2-events';
const client = generateClient();

// ========== localStorage (cache layer) ==========

function loadEventsFromCache(): SpeechEvent[] {
  try {
    const data = localStorage.getItem(EVENTS_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed.map((event: any) => ({
          ...event,
          segments: (event.segments || []).map((seg: any) => ({
            ...seg,
            color: seg.color ?? seg.colorAlerts?.[0]?.color ?? '#3B82F6',
            tickEnabled: seg.tickEnabled ?? false,
          })),
        }));
      }
    }
  } catch (e) {
    console.warn('Failed to load events from cache:', e);
  }
  return [];
}

function saveEventsToCache(events: SpeechEvent[]): void {
  try {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  } catch (e) {
    console.warn('Failed to save events to cache:', e);
  }
}

// ========== DynamoDB (source of truth) ==========

export async function fetchEventsFromCloud(userId: string): Promise<SpeechEvent[]> {
  try {
    const result: any = await client.graphql({
      query: listUserEvents,
      variables: { userId },
      authMode: 'userPool',
    });
    const items = result.data?.listUserEvents ?? [];
    return items.map((item: any) => {
      const event = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
      return event as SpeechEvent;
    });
  } catch (e) {
    console.warn('Failed to fetch events from cloud:', e);
    return [];
  }
}

export async function saveEventToCloud(userId: string, event: SpeechEvent): Promise<void> {
  try {
    await client.graphql({
      query: saveUserEventMutation,
      variables: {
        input: {
          userId,
          eventId: event.id,
          data: JSON.stringify(event),
          updatedAt: Date.now(),
        },
      },
      authMode: 'userPool',
    });
  } catch (e) {
    console.warn('Failed to save event to cloud:', e);
  }
}

export async function deleteEventFromCloud(userId: string, eventId: string): Promise<void> {
  try {
    await client.graphql({
      query: deleteUserEventMutation,
      variables: { userId, eventId },
      authMode: 'userPool',
    });
  } catch (e) {
    console.warn('Failed to delete event from cloud:', e);
  }
}

// ========== Sync: merge cloud ← → cache ==========

export async function syncEvents(userId: string, localEvents: SpeechEvent[]): Promise<SpeechEvent[]> {
  const cloudEvents = await fetchEventsFromCloud(userId);

  if (cloudEvents.length === 0 && localEvents.length > 0) {
    // First cloud sync — upload all local events
    for (const event of localEvents) {
      await saveEventToCloud(userId, event);
    }
    return localEvents;
  }

  if (cloudEvents.length > 0) {
    // Cloud wins — use cloud events, save to cache
    saveEventsToCache(cloudEvents);
    return cloudEvents;
  }

  return localEvents;
}

// ========== Public API (same interface as before) ==========

export function loadAppState(): AppState {
  const events = loadEventsFromCache();
  return {
    events,
    currentScreen: 'eventList',
    activeEventId: null,
    activeSegmentId: null,
    runningEventId: null,
    runningSegmentIndex: 0,
  };
}

export function saveEvents(events: SpeechEvent[]): void {
  saveEventsToCache(events);
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add hooks/usePersistence.ts
git commit -m "feat: rewrite persistence with DynamoDB + localStorage cache"
```

---

### Task 14: Wire cloud sync into App.tsx

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Add cloud sync on app load**

Add imports at top of `App.tsx`:

```ts
import { syncEvents, saveEventToCloud, deleteEventFromCloud } from './hooks/usePersistence';
```

Also add `useRef` to the React import if not already present:

```ts
import React, { useState, useEffect, useCallback, useRef } from 'react';
```

Note: `useAuth` is already imported from Task 10.

Inside the App component, after `const { user, signOut: handleLogout } = useAuth();`, add:

```ts
// Cloud sync on mount
useEffect(() => {
  if (!user) return;
  syncEvents(user.userId, appState.events).then(synced => {
    if (synced !== appState.events) {
      setAppState(prev => ({ ...prev, events: synced }));
    }
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [user?.userId]); // Intentionally sync only on login, not on every events change
```

- [ ] **Step 2: Add debounced cloud save when events change**

Modify the existing `saveEvents` effect to also save to cloud (debounced to avoid excessive writes):

```ts
const cloudSaveTimeoutRef = useRef<number | null>(null);

useEffect(() => {
  saveEvents(appState.events);

  // Debounce cloud save — wait 2s after last change before syncing
  if (user) {
    if (cloudSaveTimeoutRef.current) clearTimeout(cloudSaveTimeoutRef.current);
    cloudSaveTimeoutRef.current = window.setTimeout(() => {
      for (const event of appState.events) {
        saveEventToCloud(user.userId, event);
      }
    }, 2000);
  }

  return () => {
    if (cloudSaveTimeoutRef.current) clearTimeout(cloudSaveTimeoutRef.current);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [appState.events]);
```

- [ ] **Step 3: Add cloud delete in deleteEvent callback**

In the `deleteEvent` callback, after the existing `removeSharedEvent` call, add cloud delete:

```ts
const deleteEvent = useCallback((eventId: string) => {
  setAppState(prev => {
    const deleted = prev.events.find(e => e.id === eventId);
    if (deleted?.shareId) {
      removeSharedEvent(deleted.shareId).catch(() => {});
    }
    if (user) {
      deleteEventFromCloud(user.userId, eventId).catch(() => {});
    }
    return {
      ...prev,
      events: prev.events.filter(e => e.id !== eventId),
      activeEventId: prev.activeEventId === eventId ? null : prev.activeEventId,
    };
  });
}, [user]);
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add App.tsx
git commit -m "feat: wire DynamoDB cloud sync into App"
```

---

## Chunk 5: Cleanup + Build Config

### Task 15: Delete Firebase config, remove firebase dependency

**Files:**
- Delete: `services/firebaseConfig.ts`
- Modify: `package.json`

- [ ] **Step 1: Delete firebaseConfig.ts**

```bash
rm services/firebaseConfig.ts
```

- [ ] **Step 2: Verify no file imports from firebaseConfig**

```bash
grep -r "firebaseConfig" --include="*.ts" --include="*.tsx" .
```

Expected: No results (syncService.ts no longer imports it after Task 12).

- [ ] **Step 3: Remove firebase dependency**

```bash
npm uninstall firebase
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove firebase dependency and config"
```

---

### Task 16: Update vite.config.ts

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Replace firebase chunk with aws-amplify chunk**

Change the `manualChunks` section from:

```ts
manualChunks: {
  firebase: ['firebase/app', 'firebase/database'],
},
```

To:

```ts
manualChunks: {
  'aws-amplify': ['aws-amplify', 'aws-amplify/auth', 'aws-amplify/api'],
},
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: Build succeeds, output shows `aws-amplify` chunk in the bundle.

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "chore: update vite chunks from firebase to aws-amplify"
```

---

### Task 17: Update SpeechEvent comment in types.ts

**Files:**
- Modify: `types.ts`

- [ ] **Step 1: Update the shareId comment**

Change line 32 from:

```ts
  shareId?: string;              // Firebase share ID for QR code viewing
```

To:

```ts
  shareId?: string;              // Share ID for QR code viewing
```

- [ ] **Step 2: Commit**

```bash
git add types.ts
git commit -m "chore: update shareId comment (no longer Firebase-specific)"
```

---

## Chunk 6: Amplify Hosting Setup

### Task 18: Create amplify.yml build config

**Files:**
- Create: `amplify.yml`

- [ ] **Step 1: Create amplify.yml**

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

- [ ] **Step 2: Commit**

```bash
git add amplify.yml
git commit -m "chore: add Amplify Hosting build config"
```

---

### Task 19: Set up Amplify Hosting in AWS Console

> This task is done in the AWS Console, not in code.

- [ ] **Step 1: Connect repo to Amplify**

1. AWS Console → Amplify → New App → Host web app
2. Connect GitHub → select `chronoflip` repo → select `main` branch
3. Build settings: Amplify auto-detects `amplify.yml`
4. Add environment variables:
   ```
   VITE_AWS_REGION=ap-southeast-1
   VITE_COGNITO_USER_POOL_ID=<from Task 3>
   VITE_COGNITO_CLIENT_ID=<from Task 3>
   VITE_APPSYNC_ENDPOINT=<from Task 3>
   VITE_APPSYNC_API_KEY=<from Task 3>
   ```
5. Deploy

- [ ] **Step 2: Add SPA rewrite rule**

Amplify Console → App → Rewrites and Redirects → Add rule:
- Source: `/<*>`
- Target: `/index.html`
- Type: `200 (Rewrite)`

- [ ] **Step 3: (Optional) Add custom domain**

Amplify Console → App → Domain Management → Add domain

- [ ] **Step 4: Verify deployment**

Visit the Amplify URL. Confirm:
1. Login screen appears at `/`
2. Can sign in with the test user from Task 3
3. Events load after sign in
4. Viewer URL `/view/:shareId` works without login

---

## Chunk 7: End-to-End Verification

### Task 20: Full integration test

- [ ] **Step 1: Test login flow**

1. Open app at deployed URL
2. Should see login screen
3. Enter test user email + temporary password
4. Should be prompted to set new password
5. After setting password, should be redirected to event list

- [ ] **Step 2: Test event CRUD + cloud sync**

1. Create a new event with 2 segments
2. Refresh the page — event should persist (loaded from cloud)
3. Open in incognito/different browser — login again — event should be there
4. Delete the event — should disappear from both browsers

- [ ] **Step 3: Test timer + viewer**

1. Create an event with a segment
2. Share it (QR code button) — note the share URL
3. Open the share URL in a different browser (no login required)
4. Start the timer in the organiser view
5. Viewer should see real-time countdown updates
6. Viewer sends pause command — organiser timer pauses
7. Test restart command from viewer

- [ ] **Step 4: Test logout**

1. Click logout button (bottom-right)
2. Should return to login screen
3. Refresh — should still be on login screen (session cleared)

- [ ] **Step 5: Test viewer without auth**

1. Open `/view/invalidcode` — should show "Timer Not Found"
2. Open a valid `/view/:shareId` — should work without login

---

### Task 21: Final cleanup commit

- [ ] **Step 1: Run final build check**

```bash
npm run build
```

- [ ] **Step 2: Check for any remaining Firebase references**

```bash
grep -ri "firebase" --include="*.ts" --include="*.tsx" --include="*.json" . | grep -v node_modules | grep -v ".git"
```

Expected: No results (all Firebase references removed).

- [ ] **Step 3: Check for console.log/debug statements**

```bash
grep -rn "console.log" --include="*.ts" --include="*.tsx" . | grep -v node_modules
```

Remove any debug logs that shouldn't be in production (keep `console.warn` and `console.error` for error handling).

- [ ] **Step 4: Push to main and trigger Amplify deploy**

```bash
git push origin main
```

Amplify auto-builds and deploys.

- [ ] **Step 5: Verify production deployment**

Visit the deployed URL and repeat the smoke tests from Task 20.
