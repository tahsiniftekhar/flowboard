'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import type { User } from '@/types';
import { SESSION_EXPIRED_EVENT, TOKEN_KEY, USER_KEY } from './constants';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  /** False until the client has hydrated and localStorage has been read. */
  isReady: boolean;
  sessionExpired: boolean;
  signIn: (token: string, user: User) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const emptySubscribe = () => () => {};

function useIsHydrated() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

function readStoredAuth(): { token: string | null; user: User | null } {
  if (typeof window === 'undefined') return { token: null, user: null };
  const token = localStorage.getItem(TOKEN_KEY);
  const stored = localStorage.getItem(USER_KEY);
  if (!token || !stored) return { token: null, user: null };
  try {
    return { token, user: JSON.parse(stored) as User };
  } catch {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const isReady = useIsHydrated();
  const [auth, setAuth] = useState(readStoredAuth);
  const [sessionExpired, setSessionExpired] = useState(false);

  const clear = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setAuth({ token: null, user: null });
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    const handleExpired = () => {
      clear();
      setSessionExpired(true);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
  }, [clear]);

  const signIn = useCallback((token: string, user: User) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setAuth({ token, user });
    setSessionExpired(false);
  }, []);

  const signOut = useCallback(() => {
    clear();
    setSessionExpired(false);
  }, [clear]);

  const value = useMemo<AuthContextValue>(
    () => ({ ...auth, isReady, sessionExpired, signIn, signOut }),
    [auth, isReady, sessionExpired, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

/** Only allow same-origin relative paths as post-login redirect targets. */
export function safeNextPath(next: string | null | undefined, fallback = '/boards') {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) {
    return fallback;
  }
  return next;
}
