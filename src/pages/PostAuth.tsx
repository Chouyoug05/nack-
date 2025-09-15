import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/firebase";
import { getRedirectResult } from "firebase/auth";
import { useAuth } from "@/contexts/AuthContext";

const PostAuth = () => {
  const navigate = useNavigate();
  const { currentUser, hasProfile, loading } = useAuth();
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
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
      // Si après un délai la session n'est pas restaurée, on renvoie vers /login
      if (!currentUser && !loading) {
        localStorage.removeItem('nack_pending_redirect');
        navigate('/login', { replace: true });
      }
    }, 6000);
    return () => { cancelled = true; window.clearTimeout(id); };
  }, [attempted, currentUser, loading, navigate]);

  useEffect(() => {
    if (loading) return;
    if (currentUser) {
      localStorage.removeItem('nack_pending_redirect');
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