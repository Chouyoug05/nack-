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
    // Ensure auth state persists across reloads
    setPersistence(auth, browserLocalPersistence).catch(async () => {
      // Fallback if cookies/3rd-party storage are blocked
      try { await setPersistence(auth, browserSessionPersistence); } catch (err) { /* ignore persistence error */ }
    });

    // Optional: use device language and prompt account selection
    try { provider.setCustomParameters?.({ prompt: 'select_account' }); } catch (err) { /* ignore custom params error */ }

    // Handle redirect results to complete sign-in on Chrome/blocked popup scenarios
    getRedirectResult(auth).catch(() => { /* ignore redirect result error */ });

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setCurrentUser(user);
        if (user) {
          const ref = doc(db, "users", user.uid);
          const snap = await getDoc(ref);
          const exists = snap.exists();
          setHasProfile(exists);
          // Redirection défensive si on se trouve sur des routes publiques
          const path = window.location.pathname;
          if (path === "/" || path === "/onboarding" || path === "/login") {
            window.location.replace(exists ? "/dashboard" : "/complete-profile");
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
    const hostname = (typeof window !== 'undefined' && window.location.hostname) || '';
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    const isIOS = typeof navigator !== 'undefined' && /iP(hone|ad|od)/.test(navigator.userAgent);

    // En production (Netlify/domaine custom) ou iOS: privilégier Redirect (fiable et sans popup)
    if (!isLocal || isIOS) {
      await signInWithRedirect(auth, provider);
      return;
    }

    // En local: popup d'abord, fallback redirect si bloqué
    try {
      await signInWithPopup(auth, provider);
    } catch {
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