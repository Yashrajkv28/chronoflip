import React, { useState, useEffect } from 'react';
import { signIn, signOut, completeNewPasswordChallenge, getAuthErrorMessage } from '../../services/authService';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [needsNewPassword, setNeedsNewPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(() =>
    parseInt(sessionStorage.getItem('cf-login-attempts') || '0', 10)
  );
  const [lockedUntil, setLockedUntil] = useState(() =>
    parseInt(sessionStorage.getItem('cf-locked-until') || '0', 10)
  );

  const passwordsMatch = newPassword === confirmPassword;

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
        setError(`Too many attempts. Try again in ${Math.ceil(remaining / 1000)}s.`);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = Date.now();
    if (lockedUntil > now) {
      const seconds = Math.ceil((lockedUntil - now) / 1000);
      setError(`Too many attempts. Try again in ${seconds}s.`);
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
        setError('Too many failed attempts. Locked for 30 seconds.');
      } else {
        setError(getAuthErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordsMatch) {
      setError('Passwords do not match.');
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
      setError(getAuthErrorMessage(err));
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
            <form onSubmit={handleNewPassword} className="space-y-4" aria-busy={loading}>
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
                  autoComplete="new-password"
                  minLength={8}
                  className="w-full px-4 py-3 rounded-xl bg-white/60 border border-zinc-200/60 text-zinc-800 text-sm outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                  placeholder="Min 8 characters"
                  aria-describedby="new-password-hint"
                />
                <p id="new-password-hint" className="text-[10px] text-zinc-400 mt-1">
                  Requires uppercase, lowercase, number, and symbol
                </p>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                  Confirm Password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  minLength={8}
                  className="w-full px-4 py-3 rounded-xl bg-white/60 border border-zinc-200/60 text-zinc-800 text-sm outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                  placeholder="Re-enter new password"
                  aria-invalid={confirmPassword.length > 0 && !passwordsMatch}
                />
                <div aria-live="polite">
                  {confirmPassword && !passwordsMatch && (
                    <p className="text-[10px] text-red-400 mt-1">Passwords do not match</p>
                  )}
                </div>
              </div>

              {error && (
                <p role="alert" className="text-xs text-red-500 bg-red-50/50 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || newPassword.length < 8 || !passwordsMatch}
                className="w-full py-3.5 rounded-xl text-sm font-bold bg-blue-500/20 text-blue-600 border border-blue-500/30 hover:bg-blue-500/30 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              >
                {loading ? 'Setting password...' : 'Set Password & Sign In'}
              </button>

              <button
                type="button"
                onClick={handleBackToSignIn}
                className="w-full text-center text-xs text-blue-500 hover:underline mt-2 focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1 py-2"
              >
                Back to sign in
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" aria-busy={loading}>
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
                <p role="alert" className="text-xs text-red-500 bg-red-50/50 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !email.trim() || !password}
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
