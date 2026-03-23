import {
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  getCurrentUser as amplifyGetCurrentUser,
  fetchAuthSession,
  confirmSignIn,
} from 'aws-amplify/auth';

export interface AuthUser {
  userId: string;
  email: string;
}

export interface SignInResult {
  isSignedIn: boolean;
  needsNewPassword: boolean;
}

// Map Cognito error names to user-safe messages (prevents user enumeration)
const FRIENDLY_AUTH_ERRORS: Record<string, string> = {
  UserNotFoundException: 'Incorrect email or password.',
  NotAuthorizedException: 'Incorrect email or password.',
  PasswordResetRequiredException: 'A password reset is required. Contact your administrator.',
  UserNotConfirmedException: 'Account not confirmed. Contact your administrator.',
  TooManyRequestsException: 'Too many attempts. Please wait and try again.',
  LimitExceededException: 'Too many attempts. Please wait and try again.',
  InvalidPasswordException: 'Password does not meet requirements: 8+ characters with uppercase, lowercase, number, and symbol.',
  InvalidParameterException: 'Invalid input. Please check your details.',
};

export function getAuthErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const name = err.name;
    if (name && FRIENDLY_AUTH_ERRORS[name]) return FRIENDLY_AUTH_ERRORS[name];
    // Never leak raw Amplify/Cognito error messages to the UI
    console.warn('Unmapped auth error:', name);
  }
  return 'An unexpected error occurred. Please try again.';
}

export async function signIn(email: string, password: string): Promise<SignInResult> {
  // Clear any lingering sign-in state (e.g., an abandoned NEW_PASSWORD challenge)
  try { await amplifySignOut(); } catch { /* no session to clear — expected */ }
  const result = await amplifySignIn({ username: email.trim(), password });

  if (result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
    return { isSignedIn: false, needsNewPassword: true };
  }

  if (result.isSignedIn) {
    return { isSignedIn: true, needsNewPassword: false };
  }

  // Don't leak the raw signInStep value to the UI
  throw new Error('An additional verification step is required. Contact your administrator.');
}

export async function signOut(): Promise<void> {
  await amplifySignOut();
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const user = await amplifyGetCurrentUser();
    const session = await fetchAuthSession();
    const email = (session.tokens?.idToken?.payload?.email as string) ?? user.signInDetails?.loginId;
    if (!email) {
      console.warn('getCurrentUser: email could not be resolved');
      return null;
    }
    return { userId: user.userId, email };
  } catch (err: unknown) {
    // Only silently return null for expected "not authenticated" errors
    const name = err instanceof Error ? ((err as Record<string, unknown>).name as string | undefined) : undefined;
    if (name === 'UserUnAuthenticatedException' || name === 'AuthError') {
      return null;
    }
    console.warn('getCurrentUser failed unexpectedly:', err instanceof Error ? err.name : 'unknown');
    return null;
  }
}

export async function completeNewPasswordChallenge(newPassword: string): Promise<SignInResult> {
  // Do not trim passwords — spaces may be intentional
  if (!newPassword || newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }
  const result = await confirmSignIn({ challengeResponse: newPassword });
  if (result.isSignedIn) {
    return { isSignedIn: true, needsNewPassword: false };
  }
  // Don't leak the raw signInStep value to the UI
  throw new Error('An additional verification step is required. Contact your administrator.');
}
