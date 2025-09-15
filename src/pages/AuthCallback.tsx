import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/firebase";
import { getRedirectResult } from "firebase/auth";
import { useAuth } from "@/contexts/AuthContext";

const AuthCallback = () => {
  const navigate = useNavigate();
  const { currentUser, hasProfile, loading } = useAuth();

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await getRedirectResult(auth).catch(() => {});
      } finally {
        // no-op
      }
    };
    run();

    const id = window.setTimeout(() => {
      if (cancelled) return;
      if (!currentUser && !loading) {
        sessionStorage.removeItem('auth_initiated');
        navigate('/login', { replace: true });
      }
    }, 7000);
    return () => { cancelled = true; window.clearTimeout(id); };
  }, [currentUser, loading, navigate]);

  useEffect(() => {
    if (loading) return;
    if (currentUser) {
      sessionStorage.removeItem('auth_initiated');
      navigate(hasProfile ? '/dashboard' : '/complete-profile', { replace: true });
    }
  }, [currentUser, hasProfile, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Connexion en cours...
    </div>
  );
};

export default AuthCallback; 