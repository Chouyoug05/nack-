import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { auth, provider, db } from "@/lib/firebase";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  User,
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
    // Persistance durable; fallback session si bloqué
    setPersistence(auth, browserLocalPersistence).catch(async () => {
      try { await setPersistence(auth, browserSessionPersistence); } catch { /* noop */ }
    });

    try { provider.setCustomParameters?.({ prompt: 'select_account' }); } catch { /* noop */ }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setCurrentUser(user);
        if (user) {
          const ref = doc(db, "users", user.uid);
          const snap = await getDoc(ref);
          setHasProfile(snap.exists());
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
        await signInWithRedirect(auth, provider);
        return;
      }
      await signInWithPopup(auth, provider);
    } catch {
      await signInWithRedirect(auth, provider);
    }
  };

  const signOutUser = async () => {
    const { signOut } = await import("firebase/auth");
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