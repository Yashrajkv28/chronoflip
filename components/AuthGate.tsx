import React, { useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { AuthProvider } from '../hooks/AuthContext';
import LoginScreen from './screens/LoginScreen';

interface AuthGateProps {
  children: React.ReactNode;
}

const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const auth = useAuth();

  // useMemo MUST be called before any early returns (Rules of Hooks)
  const authValue = useMemo(
    () => ({ user: auth.user, loading: auth.loading, signOut: auth.signOut, refreshUser: auth.refreshUser }),
    [auth.user, auth.loading, auth.signOut, auth.refreshUser]
  );

  if (auth.loading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-bg-primary">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-[3px] border-border-soft border-t-accent-slate rounded-full animate-spin mx-auto" />
          <p className="text-text-muted text-sm">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!auth.user) {
    return <LoginScreen onLoginSuccess={auth.refreshUser} />;
  }

  return <AuthProvider value={authValue}>{children}</AuthProvider>;
};

export default AuthGate;
