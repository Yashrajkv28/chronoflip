import React, { useState, useEffect } from 'react';
import { signIn, signOut, completeNewPasswordChallenge, getAuthErrorMessage } from '../../services/authService';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

type Lang = 'en' | 'jp';

const LANG_KEY = 'chronoflip-lang';

const STRINGS = {
  en: {
    brandTag: 'SPEECH TIMER PLATFORM',
    headline: 'Precision timing for every speaker',
    subhead: 'Run multi-segment sessions with live colour alerts and real-time audience sync.',
    features: [
      'Multi-segment event timing',
      'Real-time viewer sync',
      'Per-segment colour alerts',
      'QR sharing for your audience',
    ],
    welcome: 'Welcome back',
    welcomeSub: 'Sign in to your administrator account',
    newPwTitle: 'Set a new password',
    newPwSub: 'Choose a password to finish setting up your account',
    email: 'Email',
    password: 'Password',
    emailPlaceholder: 'you@company.com',
    passwordPlaceholder: 'Enter your password',
    login: 'Login',
    signingIn: 'Signing in...',
    newPassword: 'New Password',
    confirmPassword: 'Confirm Password',
    newPwPlaceholder: 'Min 8 characters',
    confirmPwPlaceholder: 'Re-enter new password',
    pwHint: 'Requires uppercase, lowercase, number, and symbol',
    pwMismatch: 'Passwords do not match',
    setPassword: 'Set Password & Sign In',
    settingPassword: 'Setting password...',
    backToSignIn: 'Back to sign in',
    footer: 'Contact your administrator for account access',
    showPw: 'Show password',
    hidePw: 'Hide password',
    lockedFor: (s: number) => `Too many attempts. Try again in ${s}s.`,
    lockedNow: 'Too many failed attempts. Locked for 30 seconds.',
    mismatchError: 'Passwords do not match.',
  },
  jp: {
    brandTag: 'スピーチタイマー プラットフォーム',
    headline: 'すべての登壇者に、正確な時間管理を',
    subhead: '複数セグメントのセッションを、カラーアラートとリアルタイム同期で運営できます。',
    features: [
      '複数セグメントのイベント管理',
      'ビューアーのリアルタイム同期',
      'セグメントごとのカラーアラート',
      'QRコードで観客と共有',
    ],
    welcome: 'おかえりなさい',
    welcomeSub: '管理者アカウントでサインインしてください',
    newPwTitle: '新しいパスワードを設定',
    newPwSub: 'アカウント設定を完了するにはパスワードを設定してください',
    email: 'メールアドレス',
    password: 'パスワード',
    emailPlaceholder: 'you@company.com',
    passwordPlaceholder: 'パスワードを入力',
    login: 'ログイン',
    signingIn: 'サインイン中...',
    newPassword: '新しいパスワード',
    confirmPassword: 'パスワードの確認',
    newPwPlaceholder: '8文字以上',
    confirmPwPlaceholder: '新しいパスワードを再入力',
    pwHint: '大文字・小文字・数字・記号が必要です',
    pwMismatch: 'パスワードが一致しません',
    setPassword: 'パスワードを設定してサインイン',
    settingPassword: 'パスワードを設定中...',
    backToSignIn: 'サインインに戻る',
    footer: 'アカウントについては管理者にお問い合わせください',
    showPw: 'パスワードを表示',
    hidePw: 'パスワードを非表示',
    lockedFor: (s: number) => `試行回数が多すぎます。${s}秒後に再試行してください。`,
    lockedNow: 'サインインに繰り返し失敗しました。30秒間ロックされます。',
    mismatchError: 'パスワードが一致しません。',
  },
} as const;

const LangToggle: React.FC<{ lang: Lang; onChange: (l: Lang) => void; onDark?: boolean }> = ({ lang, onChange, onDark }) => (
  <div className={`inline-flex rounded-lg p-1 ${onDark ? 'bg-white/10' : 'bg-bg-secondary border border-border-soft'}`}>
    {(['en', 'jp'] as const).map((l) => (
      <button
        key={l}
        type="button"
        onClick={() => onChange(l)}
        aria-pressed={lang === l}
        className={`px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider transition-colors duration-200 ${
          lang === l
            ? 'bg-success text-white'
            : onDark
              ? 'text-white/60 hover:text-white'
              : 'text-text-muted hover:text-text-secondary'
        }`}
      >
        {l}
      </button>
    ))}
  </div>
);

const CheckIcon = () => (
  <svg className="w-5 h-5 shrink-0 text-success" fill="none" viewBox="0 0 24 24" strokeWidth="2"
       stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [needsNewPassword, setNeedsNewPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [lang, setLang] = useState<Lang>(() =>
    (localStorage.getItem(LANG_KEY) === 'jp' ? 'jp' : 'en')
  );
  const [loginAttempts, setLoginAttempts] = useState(() =>
    parseInt(sessionStorage.getItem('cf-login-attempts') || '0', 10)
  );
  const [lockedUntil, setLockedUntil] = useState(() =>
    parseInt(sessionStorage.getItem('cf-locked-until') || '0', 10)
  );

  const t = STRINGS[lang];
  const passwordsMatch = newPassword === confirmPassword;

  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang);
  }, [lang]);

  // Sync rate limiting to sessionStorage (survives page refresh)
  useEffect(() => {
    sessionStorage.setItem('cf-login-attempts', String(loginAttempts));
  }, [loginAttempts]);
  useEffect(() => {
    sessionStorage.setItem('cf-locked-until', String(lockedUntil));
  }, [lockedUntil]);

  // Live countdown when locked out
  useEffect(() => {
    if (lockedUntil <= Date.now()) return;
    const id = setInterval(() => {
      const remaining = lockedUntil - Date.now();
      if (remaining <= 0) {
        setError('');
        clearInterval(id);
      } else {
        setError(t.lockedFor(Math.ceil(remaining / 1000)));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [lockedUntil, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = Date.now();
    if (lockedUntil > now) {
      const seconds = Math.ceil((lockedUntil - now) / 1000);
      setError(t.lockedFor(seconds));
      return;
    }

    setError('');
    setLoading(true);

    try {
      const result = await signIn(email, password);

      if (result.needsNewPassword) {
        setPassword('');
        setNeedsNewPassword(true);
        return;
      }

      setPassword('');
      setEmail('');
      setLoginAttempts(0);
      setLockedUntil(0);
      onLoginSuccess();
    } catch (err: unknown) {
      const nextAttempts = loginAttempts + 1;
      setLoginAttempts(nextAttempts);
      if (nextAttempts >= 5) {
        setLockedUntil(Date.now() + 30000);
        setLoginAttempts(0);
        setPassword('');
        setError(t.lockedNow);
      } else {
        setError(getAuthErrorMessage(err, lang));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordsMatch) {
      setError(t.mismatchError);
      return;
    }
    setError('');
    setLoading(true);

    try {
      await completeNewPasswordChallenge(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      onLoginSuccess();
    } catch (err: unknown) {
      setNewPassword('');
      setConfirmPassword('');
      setError(getAuthErrorMessage(err, lang));
    } finally {
      setLoading(false);
    }
  };

  const handleBackToSignIn = async () => {
    // Cancel the pending Cognito challenge by signing out
    try { await signOut(); } catch (err) { console.warn('Challenge cancel sign-out failed:', err instanceof Error ? err.name : 'unknown'); }
    setNeedsNewPassword(false);
    setNewPassword('');
    setConfirmPassword('');
    setError('');
  };

  const inputClass = "w-full px-4 py-3 rounded-xl bg-white border border-border-soft text-text-primary text-sm outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue/30 transition-all";
  const labelClass = "block text-xs font-semibold text-text-secondary mb-1.5";

  return (
    <div className="h-[100dvh] grid lg:grid-cols-2 overflow-hidden">
      {/* Brand panel - desktop only */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-text-primary">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-success flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M13 2L4.09 12.97a1 1 0 00.77 1.63H11l-1 7.4 8.91-10.97a1 1 0 00-.77-1.63H12l1-7.4z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight leading-none">ChronoFlip</h1>
              <p className="text-[11px] font-bold text-success uppercase tracking-[0.15em] mt-1.5">{t.brandTag}</p>
            </div>
          </div>
          <LangToggle lang={lang} onChange={setLang} onDark />
        </div>

        <div className="max-w-lg">
          <h2 className="text-5xl font-bold text-white tracking-tight leading-[1.1]">{t.headline}</h2>
          <p className="text-lg text-white/60 mt-6 leading-relaxed">{t.subhead}</p>

          <ul className="mt-12 space-y-5">
            {t.features.map((f) => (
              <li key={f} className="flex items-center gap-4">
                <CheckIcon />
                <span className="text-white font-medium">{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-white/40">© 2026 ChronoFlip</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 bg-bg-primary overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Mobile-only brand + language row */}
          <div className="flex items-center justify-between mb-8 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-success flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M13 2L4.09 12.97a1 1 0 00.77 1.63H11l-1 7.4 8.91-10.97a1 1 0 00-.77-1.63H12l1-7.4z" />
                </svg>
              </div>
              <span className="text-lg font-bold text-text-primary tracking-tight">ChronoFlip</span>
            </div>
            <LangToggle lang={lang} onChange={setLang} />
          </div>

          <h2 className="text-3xl font-bold text-text-primary tracking-tight">
            {needsNewPassword ? t.newPwTitle : t.welcome}
          </h2>
          <p className="text-text-secondary mt-2 mb-8">
            {needsNewPassword ? t.newPwSub : t.welcomeSub}
          </p>

          {needsNewPassword ? (
            <form onSubmit={handleNewPassword} className="space-y-5" aria-busy={loading}>
              <div>
                <label htmlFor="new-password" className={labelClass}>
                  {t.newPassword}
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoFocus
                  autoComplete="new-password"
                  minLength={8}
                  className={inputClass}
                  placeholder={t.newPwPlaceholder}
                  aria-describedby="new-password-hint"
                />
                <p id="new-password-hint" className="text-[10px] text-text-muted mt-1">
                  {t.pwHint}
                </p>
              </div>

              <div>
                <label htmlFor="confirm-password" className={labelClass}>
                  {t.confirmPassword}
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  minLength={8}
                  className={inputClass}
                  placeholder={t.confirmPwPlaceholder}
                  aria-invalid={confirmPassword.length > 0 && !passwordsMatch}
                />
                <div aria-live="polite">
                  {confirmPassword && !passwordsMatch && (
                    <p className="text-[10px] text-error mt-1">{t.pwMismatch}</p>
                  )}
                </div>
              </div>

              {error && (
                <p role="alert" className="text-xs text-error bg-error/10 border border-error/30 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || newPassword.length < 8 || !passwordsMatch}
                className="w-full py-3.5 rounded-xl text-sm font-bold bg-text-primary text-white border border-text-primary shadow-hard-sm hover:shadow-hard disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-200"
              >
                {loading ? t.settingPassword : t.setPassword}
              </button>

              <button
                type="button"
                onClick={handleBackToSignIn}
                className="w-full text-center text-xs text-accent-blue hover:underline mt-2 focus-visible:ring-2 focus-visible:ring-accent-blue rounded px-1 py-2"
              >
                {t.backToSignIn}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" aria-busy={loading}>
              <div>
                <label htmlFor="email" className={labelClass}>
                  {t.email}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="email"
                  className={inputClass}
                  placeholder={t.emailPlaceholder}
                />
              </div>

              <div>
                <label htmlFor="password" className={labelClass}>
                  {t.password}
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className={`${inputClass} pr-12`}
                    placeholder={t.passwordPlaceholder}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? t.hidePw : t.showPw}
                    title={showPassword ? t.hidePw : t.showPw}
                    className="absolute inset-y-0 right-0 px-4 flex items-center text-text-muted hover:text-text-secondary transition-colors"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2"
                           stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M9.88 9.88a3 3 0 104.24 4.24" />
                        <path d="M10.73 5.08A10.43 10.43 0 0112 5c7 0 10 7 10 7a13.16 13.16 0 01-1.67 2.68" />
                        <path d="M6.61 6.61A13.53 13.53 0 002 12s3 7 10 7a9.74 9.74 0 005.39-1.61" />
                        <path d="M2 2l20 20" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2"
                           stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <p role="alert" className="text-xs text-error bg-error/10 border border-error/30 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !email.trim() || !password}
                className="w-full py-3.5 rounded-xl text-sm font-bold bg-text-primary text-white border border-text-primary shadow-hard-sm hover:shadow-hard disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-200"
              >
                {loading ? t.signingIn : t.login}
              </button>
            </form>
          )}

          <p className="text-center text-xs text-text-muted mt-8">
            {t.footer}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
