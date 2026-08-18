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

export type AuthLang = 'en' | 'jp';

// Errors this module raises itself. Named so they can be localised like Cognito's.
export const EXTRA_STEP_ERROR = 'ExtraVerificationStepRequired';
export const PASSWORD_TOO_SHORT_ERROR = 'PasswordTooShort';

// Map error names to user-safe messages (prevents user enumeration)
const FRIENDLY_AUTH_ERRORS: Record<AuthLang, Record<string, string>> = {
  en: {
    UserNotFoundException: 'Incorrect email or password.',
    NotAuthorizedException: 'Incorrect email or password.',
    PasswordResetRequiredException: 'A password reset is required. Contact your administrator.',
    UserNotConfirmedException: 'Account not confirmed. Contact your administrator.',
    TooManyRequestsException: 'Too many attempts. Please wait and try again.',
    LimitExceededException: 'Too many attempts. Please wait and try again.',
    InvalidPasswordException: 'Password does not meet requirements: 8+ characters with uppercase, lowercase, number, and symbol.',
    InvalidParameterException: 'Invalid input. Please check your details.',
    [EXTRA_STEP_ERROR]: 'An additional verification step is required. Contact your administrator.',
    [PASSWORD_TOO_SHORT_ERROR]: 'Password must be at least 8 characters.',
  },
  jp: {
    UserNotFoundException: 'メールアドレスまたはパスワードが正しくありません。',
    NotAuthorizedException: 'メールアドレスまたはパスワードが正しくありません。',
    PasswordResetRequiredException: 'パスワードの再設定が必要です。管理者にお問い合わせください。',
    UserNotConfirmedException: 'アカウントが確認されていません。管理者にお問い合わせください。',
    TooManyRequestsException: '試行回数が多すぎます。しばらく待ってから再試行してください。',
    LimitExceededException: '試行回数が多すぎます。しばらく待ってから再試行してください。',
    InvalidPasswordException: 'パスワードが要件を満たしていません。8文字以上で、大文字・小文字・数字・記号を含めてください。',
    InvalidParameterException: '入力内容が正しくありません。ご確認ください。',
    [EXTRA_STEP_ERROR]: '追加の認証手続きが必要です。管理者にお問い合わせください。',
    [PASSWORD_TOO_SHORT_ERROR]: 'パスワードは8文字以上で入力してください。',
  },
};

const FALLBACK_AUTH_ERROR: Record<AuthLang, string> = {
  en: 'An unexpected error occurred. Please try again.',
  jp: '予期しないエラーが発生しました。もう一度お試しください。',
};

/** Build a named Error so getAuthErrorMessage can localise it. */
function namedError(name: string): Error {
  const e = new Error(name);
  e.name = name;
  return e;
}

export function getAuthErrorMessage(err: unknown, lang: AuthLang = 'en'): string {
  if (err instanceof Error) {
    const name = err.name;
    if (name && FRIENDLY_AUTH_ERRORS[lang][name]) return FRIENDLY_AUTH_ERRORS[lang][name];
    // Never leak raw Amplify/Cognito error messages to the UI
    console.warn('Unmapped auth error:', name);
  }
  return FALLBACK_AUTH_ERROR[lang];
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
  throw namedError(EXTRA_STEP_ERROR);
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
    throw namedError(PASSWORD_TOO_SHORT_ERROR);
  }
  const result = await confirmSignIn({ challengeResponse: newPassword });
  if (result.isSignedIn) {
    return { isSignedIn: true, needsNewPassword: false };
  }
  // Don't leak the raw signInStep value to the UI
  throw namedError(EXTRA_STEP_ERROR);
}
