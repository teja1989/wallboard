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
  sendEmailLink: (email: string, returnTo?: string) => Promise<void>;
  completeEmailLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshActor: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const EMAIL_LINK_STORAGE_KEY = 'marquee:pending-email';
/**
 * Where to put someone back once the link is used.
 *
 * An email link is a round trip out of the site and back through a different tab, and it
 * used to always land on the home page. Someone who was half-way through writing an
 * invitation got signed in and dropped on the marketing page, with the work they had done
 * still saved but nothing to bring them back to it. Signing in is never the thing anyone
 * came to do; it is the interruption.
 */
const RETURN_TO_STORAGE_KEY = 'marquee:pending-return';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [actor, setActor] = useState<Actor | null>(null);
  // Two independent things have to settle before we know who the visitor is: the server
  // session and the Firebase client SDK. Tracking them separately stops the UI from
  // deciding "nobody is signed in" while one of them is still catching up.
  const [sessionChecked, setSessionChecked] = useState(false);
  const [firebaseChecked, setFirebaseChecked] = useState(false);
  /**
   * The exchange in flight, if there is one.
   *
   * A boolean here used to mean "someone else is doing it, so return" — and returning
   * early is a lie to the caller, who awaited this precisely to know the cookie exists.
   * Holding the promise lets concurrent callers join the same exchange and all wait for
   * the real answer, which is what they each asked for.
   */
  const exchangeRef = useRef<Promise<void> | null>(null);
  /** Whether a server session is known to exist, without waiting on a re-render. */
  const sessionRef = useRef(false);

  /** Trades the current ID token for a server session cookie. */
  const exchangeSession = useCallback(async (nextUser: User | null): Promise<void> => {
    if (!nextUser) {
      sessionRef.current = false;
      setActor(null);
      return;
    }
    if (exchangeRef.current) return exchangeRef.current;

    const run = (async () => {
      try {
        const idToken = await nextUser.getIdToken();
        const result = await api.post<{ actor: Actor | null }>('/api/session', { idToken });
        sessionRef.current = result.actor !== null;
        setActor(result.actor);
      } catch {
        sessionRef.current = false;
        setActor(null);
      }
    })().finally(() => {
      exchangeRef.current = null;
    });

    exchangeRef.current = run;
    return run;
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
        if (!cancelled && result.actor) {
          sessionRef.current = true;
          setActor(result.actor);
        }
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
  /**
   * Resolves only once the caller can actually make an authorized request.
   *
   * `signInAnonymously` creates the Firebase user; the *cookie* every API route checks is
   * minted separately, by the token listener. Awaiting only the former returned before
   * there was a session, so anything that called this and immediately posted raced its own
   * sign-in and got a 401 — invisible wherever a human pauses to type, and reliable on any
   * page that redeems on arrival.
   */
  const signInAsGuest = useCallback(async () => {
    if (sessionRef.current) return;

    const current = clientAuth().currentUser;
    if (!current) {
      const existing = await api
        .get<{ actor: Actor | null }>('/api/session')
        .catch(() => ({ actor: null }));
      if (existing.actor) {
        sessionRef.current = true;
        setActor(existing.actor);
        return;
      }
    }

    const credential = current ?? (await signInAnonymously(clientAuth())).user;
    await exchangeSession(credential);
  }, [exchangeSession]);

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
        const linked = await linkWithPopup(current, provider);
        await exchangeSession(linked.user);
        return;
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code !== 'auth/credential-already-in-use' && code !== 'auth/email-already-in-use') {
          throw error;
        }
      }
    }
    const credential = await signInWithPopup(auth, provider);
    await exchangeSession(credential.user);
  }, [exchangeSession]);

  const sendEmailLink = useCallback(async (email: string, returnTo?: string) => {
    await sendSignInLinkToEmail(clientAuth(), email, {
      /**
       * The origin the browser is actually on, not the configured one.
       *
       * These are not always the same host, and when they differ the configured one is
       * wrong: a link that returns someone to a domain other than the one they signed in
       * from is a link that either fails or logs them in somewhere they were not. It broke
       * exactly that way the moment SITE_URL named a domain whose DNS was not live yet —
       * every sign-in email pointed at a host that did not resolve, on every URL.
       *
       * Firebase only honours origins in `authorized_domains`, which is what stops this
       * being an open redirect; Terraform lists the service URL and the custom domain both.
       */
      url: `${window.location.origin}/auth/finish`,
      handleCodeInApp: true,
    });
    window.localStorage.setItem(EMAIL_LINK_STORAGE_KEY, email);

    const destination = returnTo ?? `${window.location.pathname}${window.location.search}`;
    window.localStorage.setItem(RETURN_TO_STORAGE_KEY, destination);
  }, []);

  /**
   * Resolves only once there is a session, like `signInAsGuest`.
   *
   * Firebase sign-in and the server cookie are two steps, and the second happens in the
   * token listener. Returning after the first tells the caller they are signed in while
   * the very next request still goes out unauthenticated — which showed up as an
   * intermittent 401 creating an event immediately after following a sign-in link, only
   * under load, which is the worst way for a race to introduce itself.
   */
  const completeEmailLink = useCallback(
    async (email: string) => {
      const auth = clientAuth();
      if (!isSignInWithEmailLink(auth, window.location.href)) {
        throw new Error('That sign-in link is not valid.');
      }
      const current = auth.currentUser;
      if (current?.isAnonymous) {
        const credential = EmailAuthProvider.credentialWithLink(email, window.location.href);
        try {
          const linked = await linkWithCredential(current, credential);
          window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
          await exchangeSession(linked.user);
          return;
        } catch (error) {
          const code = (error as { code?: string }).code;
          if (code !== 'auth/credential-already-in-use' && code !== 'auth/email-already-in-use') {
            throw error;
          }
        }
      }
      const credential = await signInWithEmailLink(auth, email, window.location.href);
      window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
      await exchangeSession(credential.user);
    },
    [exchangeSession],
  );

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

/**
 * Reads and clears the path to return to, refusing anything that is not a same-site path.
 * A sign-in page that will forward anywhere is how a phishing link borrows a domain.
 */
export function takePendingReturn(): string {
  try {
    const stored = window.localStorage.getItem(RETURN_TO_STORAGE_KEY);
    window.localStorage.removeItem(RETURN_TO_STORAGE_KEY);
    if (stored && stored.startsWith('/') && !stored.startsWith('//')) return stored;
  } catch {
    // Storage unavailable; home is a safe place to land.
  }
  return '/';
}
