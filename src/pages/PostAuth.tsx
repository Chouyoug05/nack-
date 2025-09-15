import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, provider } from "@/lib/firebase";
import { getRedirectResult, signInWithRedirect } from "firebase/auth";
import { useAuth } from "@/contexts/AuthContext";

const PostAuth = () => {
  const navigate = useNavigate();
  const { currentUser, hasProfile, loading } = useAuth();
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const flow = sessionStorage.getItem('auth_flow');
        const initiated = sessionStorage.getItem('auth_initiated') === '1';

        if (flow === 'start' && !initiated && !currentUser) {
          sessionStorage.setItem('auth_initiated', '1');
          await signInWithRedirect(auth, provider);
          return; // redirection en cours
        }

        if (!attempted) {
          await getRedirectResult(auth).catch(() => {});
          setAttempted(true);
        }
      } finally {
        // no-op
      }
    };
    run();

    const id = window.setTimeout(() => {
      if (cancelled) return;
      if (!currentUser && !loading) {
        sessionStorage.removeItem('auth_flow');
        sessionStorage.removeItem('auth_initiated');
        navigate('/login', { replace: true });
      }
    }, 7000);

    return () => { cancelled = true; window.clearTimeout(id); };
  }, [attempted, currentUser, loading, navigate]);

  useEffect(() => {
    if (loading) return;
    if (currentUser) {
      sessionStorage.removeItem('auth_flow');
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

export default PostAuth; 