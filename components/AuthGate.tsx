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
      <div className="h-[100dvh] flex items-center justify-center light-mesh-bg">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-[3px] border-zinc-300 border-t-zinc-600 rounded-full animate-spin mx-auto" />
          <p className="text-zinc-400 text-sm">Checking authentication...</p>
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
