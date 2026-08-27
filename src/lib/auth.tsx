'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { authClient, getAccessToken } from '@/lib/authBrowser';
import { LoginModal } from '@/app/components/LoginModal';

export { getAccessToken };

export interface AuthUser {
  id: string;
  email: string;
}

interface AuthState {
  ready: boolean;
  authenticated: boolean;
  user: AuthUser | null;
  /** Die abgeleitete Solana-Adresse des Kontos, aus /api/me. */
  walletAddress: string | undefined;
  login: (opts?: { onComplete?: () => void }) => void;
  logout: () => Promise<void>;
  getAccessToken: typeof getAccessToken;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionResolved, setSessionResolved] = useState(false);
  // Die Adresse wird zusammen mit der Nutzer-ID gehalten, zu der sie gehoert.
  // Daraus laesst sich ableiten, ob sie zur aktuellen Sitzung passt — sonst
  // muesste ein Effekt sie beim Abmelden synchron zuruecksetzen, und genau das
  // erzeugt die kaskadierenden Renders, vor denen der Lint warnt.
  const [wallet, setWallet] = useState<{ userId: string; address?: string } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const onComplete = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    const supabase = authClient();
    let cancelled = false;

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setSessionResolved(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setSessionResolved(true);
    });

    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  const userId = session?.user.id;

  useEffect(() => {
    if (!userId || wallet?.userId === userId) return;

    let cancelled = false;
    void (async () => {
      let address: string | undefined;
      try {
        const token = session?.access_token;
        const res = await fetch('/api/me', {
          headers: { Authorization: `Bearer ${token ?? ''}` },
          cache: 'no-store',
        });
        if (res.ok) address = ((await res.json()) as { walletAddress: string }).walletAddress;
      } catch {
        // Kein Netz: die Sitzung gilt trotzdem, nur ohne Adresse. `ready` wird
        // gesetzt, sonst haengt jede Seite im Ladezustand fest.
      }
      // Auch im Fehlerfall schreiben, damit der Zustand aufgeloest ist.
      if (!cancelled) setWallet({ userId, address });
    })();

    return () => { cancelled = true; };
  }, [userId, session, wallet]);

  // Abgeleitet statt gespeichert: beim Abmelden faellt beides von selbst weg.
  const walletMatches = !!userId && wallet?.userId === userId;
  const walletAddress = walletMatches ? wallet?.address : undefined;
  const walletResolved = !session || walletMatches;

  const login = useCallback((opts?: { onComplete?: () => void }) => {
    onComplete.current = opts?.onComplete;
    setModalOpen(true);
  }, []);

  const logout = useCallback(async () => {
    await authClient().auth.signOut();
    setSession(null);
  }, []);

  const value = useMemo<AuthState>(() => ({
    ready: sessionResolved && walletResolved,
    authenticated: !!session,
    user: session?.user ? { id: session.user.id, email: session.user.email ?? '' } : null,
    walletAddress,
    login,
    logout,
    getAccessToken,
  }), [sessionResolved, walletResolved, session, walletAddress, login, logout]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {modalOpen && <LoginModal
        onClose={() => setModalOpen(false)}
        onSuccess={() => {
          setModalOpen(false);
          const cb = onComplete.current;
          onComplete.current = undefined;
          cb?.();
        }}
      />}
    </Ctx.Provider>
  );
}

function useAuthState(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth muss innerhalb von <AuthProvider> stehen');
  return ctx;
}

/** Ersetzt `usePrivy()` und liefert bewusst dieselben Felder. */
export function useAuth(): AuthState {
  return useAuthState();
}

/** Ersetzt `useLogout({ onSuccess })`. */
export function useLogout(opts?: { onSuccess?: () => void }): { logout: () => Promise<void> } {
  const { logout } = useAuthState();
  return {
    logout: async () => {
      await logout();
      opts?.onSuccess?.();
    },
  };
}

/** Ersetzt `useLogin({ onComplete })`. */
export function useLogin(opts?: { onComplete?: () => void }): { login: () => void } {
  const { login } = useAuthState();
  return { login: () => login(opts) };
}

/**
 * Ersetzt `useWallets()` / `useSolanaWallets()` und behaelt deren Form, damit
 * die 45 Aufrufstellen mit `wallets[0]?.address` unveraendert bleiben. Die
 * Adresse ist jetzt die serverseitig abgeleitete, nicht die des Anbieters.
 */
export function useWallets(): { wallets: { address: string }[] } {
  const { walletAddress } = useAuthState();
  return { wallets: walletAddress ? [{ address: walletAddress }] : [] };
}
