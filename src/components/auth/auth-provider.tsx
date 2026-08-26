'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  isSignInWithEmailLink,
  linkWithCredential,
  linkWithPopup,
  onIdTokenChanged,
  sendSignInLinkToEmail,
  signInAnonymously,
  signInWithEmailLink,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { appConfig } from '@/config';
import { clientAuth } from '@/lib/firebase/client';
import { api } from '@/lib/client/api-client';
import type { Actor } from '@/types/domain';

/**
 * Identity.
 *
 * Everyone gets a Firebase uid: code-only visitors sign in anonymously so the wall's live
 * Firestore listeners have an identity to authorize, and upgrading to a real account uses
 * `link*` rather than a fresh sign-in — which keeps the same uid, so a guest's membership
 * and their posts survive signing in.
 *
 * The ID token is exchanged for an httpOnly session cookie and then dropped. Nothing
 * durable and stealable is left in browser-readable storage.
 */

interface AuthContextValue {
  user: User | null;
  actor: Actor | null;
  loading: boolean;
  isAnonymous: boolean;
  signInAsGuest: () => Promise<void>;
  upgradeWithGoogle: () => Promise<void>;
  sendEmailLink: (email: string) => Promise<void>;
  completeEmailLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshActor: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const EMAIL_LINK_STORAGE_KEY = 'wallboard:pending-email';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [actor, setActor] = useState<Actor | null>(null);
  // Two independent things have to settle before we know who the visitor is: the server
  // session and the Firebase client SDK. Tracking them separately stops the UI from
  // deciding "nobody is signed in" while one of them is still catching up.
  const [sessionChecked, setSessionChecked] = useState(false);
  const [firebaseChecked, setFirebaseChecked] = useState(false);
  const exchangingRef = useRef(false);

  /** Trades the current ID token for a server session cookie. */
  const exchangeSession = useCallback(async (nextUser: User | null) => {
    if (!nextUser) {
      setActor(null);
      return;
    }
    if (exchangingRef.current) return;
    exchangingRef.current = true;
    try {
      const idToken = await nextUser.getIdToken();
      const result = await api.post<{ actor: Actor | null }>('/api/session', { idToken });
      setActor(result.actor);
    } catch {
      setActor(null);
    } finally {
      exchangingRef.current = false;
    }
  }, []);

  /**
   * Hydrate from the server session first.
   *
   * The httpOnly session cookie is what actually authorizes every API call, so it — not
   * the client SDK's local state — is the source of truth for identity. They can diverge:
   * the SDK keeps its state in IndexedDB, which a privacy mode, a cleared site, or a
   * different device will not have even though the cookie is still valid. Asking the
   * server first stops a signed-in host from being quietly downgraded to a guest.
   */
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await api.get<{ actor: Actor | null }>('/api/session');
        if (!cancelled && result.actor) setActor(result.actor);
      } catch {
        // No session, or it has expired. Either way there is nobody to restore.
      } finally {
        if (!cancelled) setSessionChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // onIdTokenChanged rather than onAuthStateChanged: it also fires on token refresh and
    // after linkWithCredential, which is exactly when the session cookie needs reminting.
    const unsubscribe = onIdTokenChanged(clientAuth(), async (nextUser) => {
      setUser(nextUser);
      // A null user here means the SDK has no local state — which does not imply the
      // server session is gone, so the restored actor is left alone.
      if (nextUser) await exchangeSession(nextUser);
      setFirebaseChecked(true);
    });
    return unsubscribe;
  }, [exchangeSession]);

  /**
   * No-op when the visitor already has an identity, from either source. Callers invoke
   * this on page load, so it must never replace a real account with a guest one.
   */
  const signInAsGuest = useCallback(async () => {
    if (clientAuth().currentUser) return;
    const existing = await api
      .get<{ actor: Actor | null }>('/api/session')
      .catch(() => ({ actor: null }));
    if (existing.actor) {
      setActor(existing.actor);
      return;
    }
    await signInAnonymously(clientAuth());
  }, []);

  /**
   * Upgrades in place when there is an anonymous session to preserve. Firebase rejects the
   * link if the Google account already exists as its own user, in which case a plain
   * sign-in is the correct fallback — the guest identity is genuinely a different person.
   */
  const upgradeWithGoogle = useCallback(async () => {
    const auth = clientAuth();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const current = auth.currentUser;

    if (current?.isAnonymous) {
      try {
        await linkWithPopup(current, provider);
        return;
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code !== 'auth/credential-already-in-use' && code !== 'auth/email-already-in-use') {
          throw error;
        }
      }
    }
    await signInWithPopup(auth, provider);
  }, []);

  const sendEmailLink = useCallback(async (email: string) => {
    await sendSignInLinkToEmail(clientAuth(), email, {
      url: `${appConfig.siteUrl}/auth/finish`,
      handleCodeInApp: true,
    });
    window.localStorage.setItem(EMAIL_LINK_STORAGE_KEY, email);
  }, []);

  const completeEmailLink = useCallback(async (email: string) => {
    const auth = clientAuth();
    if (!isSignInWithEmailLink(auth, window.location.href)) {
      throw new Error('That sign-in link is not valid.');
    }
    const current = auth.currentUser;
    if (current?.isAnonymous) {
      const credential = EmailAuthProvider.credentialWithLink(email, window.location.href);
      try {
        await linkWithCredential(current, credential);
        window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
        return;
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code !== 'auth/credential-already-in-use' && code !== 'auth/email-already-in-use') {
          throw error;
        }
      }
    }
    await signInWithEmailLink(auth, email, window.location.href);
    window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
  }, []);

  const signOut = useCallback(async () => {
    await api.delete('/api/session').catch(() => undefined);
    await firebaseSignOut(clientAuth());
    setActor(null);
    setUser(null);
  }, []);

  const refreshActor = useCallback(async () => {
    const result = await api.get<{ actor: Actor | null }>('/api/session');
    setActor(result.actor);
  }, []);

  const loading = !sessionChecked || !firebaseChecked;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      actor,
      loading,
      isAnonymous: actor?.isAnonymous ?? user?.isAnonymous ?? true,
      signInAsGuest,
      upgradeWithGoogle,
      sendEmailLink,
      completeEmailLink,
      signOut,
      refreshActor,
    }),
    [
      user,
      actor,
      loading,
      signInAsGuest,
      upgradeWithGoogle,
      sendEmailLink,
      completeEmailLink,
      signOut,
      refreshActor,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}

export const pendingEmailKey = EMAIL_LINK_STORAGE_KEY;
