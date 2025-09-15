import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { auth, provider, db } from "@/lib/firebase";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  setPersistence,
  browserLocalPersistence,
  signOut,
  User,
  getRedirectResult,
  browserSessionPersistence,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

interface AuthContextValue {
  currentUser: User | null;
  loading: boolean;
  hasProfile: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  markProfileComplete: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [hasProfile, setHasProfile] = useState<boolean>(false);

  useEffect(() => {
    // Ensure auth state persists across reloads (desktop par défaut)
    setPersistence(auth, browserLocalPersistence).catch(async () => {
      try { await setPersistence(auth, browserSessionPersistence); } catch { /* ignore */ }
    });

    try { provider.setCustomParameters?.({ prompt: 'select_account' }); } catch { /* ignore */ }

    getRedirectResult(auth).catch(() => { /* ignore */ });

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setCurrentUser(user);
        if (user) {
          const ref = doc(db, "users", user.uid);
          const snap = await getDoc(ref);
          const exists = snap.exists();
          setHasProfile(exists);

          // Redirection défensive si route publique (HashRouter support)
          const path = window.location.pathname;
          const hash = window.location.hash || '';
          const isPublic = (
            path === "/" || path === "/onboarding" || path === "/login" ||
            hash === "#" || hash === "#/" || hash.startsWith("#/login") || hash.startsWith("#/onboarding")
          );
          if (isPublic) {
            const host = window.location.hostname;
            const useHash = host.endsWith('netlify.app') || host.endsWith('vercel.app');
            const target = exists ? "/dashboard" : "/complete-profile";
            const redirectUrl = useHash ? `/#${target}` : target;
            window.location.replace(redirectUrl);
          }
        } else {
          setHasProfile(false);
        }
      } catch (error) {
        console.error("Failed to load user profile:", error);
        setHasProfile(false);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const refreshProfile = async () => {
    if (!currentUser) return;
    try {
      const ref = doc(db, "users", currentUser.uid);
      const snap = await getDoc(ref);
      setHasProfile(snap.exists());
    } catch (error) {
      console.error("Failed to refresh profile:", error);
    }
  };

  const markProfileComplete = () => {
    setHasProfile(true);
  };

  const signInWithGoogle = async () => {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isMobile = /Mobi|Android|iP(hone|ad|od)/i.test(ua);

    try {
      if (isMobile) {
        // Mobile: session only + redirect fiable
        try { await setPersistence(auth, browserSessionPersistence); } catch { /* ignore */ }
        await signInWithRedirect(auth, provider);
        return;
      }

      // Desktop: popup d'abord (local persistence déjà configurée), fallback redirect (session)
      await signInWithPopup(auth, provider);
    } catch {
      try { await setPersistence(auth, browserSessionPersistence); } catch { /* ignore */ }
      await signInWithRedirect(auth, provider);
    }
  };

  const signOutUser = async () => {
    await signOut(auth);
  };

  const value = useMemo<AuthContextValue>(
    () => ({ currentUser, loading, hasProfile, signInWithGoogle, signOutUser, refreshProfile, markProfileComplete }),
    [currentUser, loading, hasProfile]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}; 