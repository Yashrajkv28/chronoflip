import { useState, useEffect, useCallback, useRef } from 'react';
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
  const mountedRef = useRef(true);

  // Track mount status for all async callbacks
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Single effect for initial load + Hub listener (stable [] deps, no re-registration)
  useEffect(() => {
    let cancelled = false;

    const loadUser = async () => {
      // setLoading(true) only matters on Hub re-triggers (initial state is already true)
      if (!cancelled) setLoading(true);
      try {
        const currentUser = await getCurrentUser();
        if (!cancelled) setUser(currentUser);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadUser();

    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      if (cancelled) return;
      switch (payload.event) {
        case 'signedIn':
          loadUser();
          break;
        case 'signedOut':
        case 'tokenRefresh_failure':
          setUser(null);
          setLoading(false);
          break;
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // Exposed for manual refresh (e.g., after LoginScreen success)
  // Guarded by mountedRef to prevent stale writes on unmount
  const refreshUser = useCallback(async () => {
    if (!mountedRef.current) return;
    setLoading(true);
    try {
      const currentUser = await getCurrentUser();
      if (mountedRef.current) setUser(currentUser);
    } catch {
      if (mountedRef.current) setUser(null);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    console.log('[AUTH] signOut called, mountedRef:', mountedRef.current);
    if (!mountedRef.current) return;
    setLoading(true);
    try {
      await authSignOut();
      console.log('[AUTH] signOut succeeded');
    } catch (e) {
      console.error('[AUTH] signOut error:', e);
    } finally {
      console.log('[AUTH] signOut finally, mountedRef:', mountedRef.current);
      if (mountedRef.current) {
        setUser(null);
        setLoading(false);
      }
    }
  }, []);

  return { user, loading, signOut: handleSignOut, refreshUser };
}
