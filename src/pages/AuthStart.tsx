import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, provider } from "@/lib/firebase";
import { signInWithRedirect } from "firebase/auth";
import { useAuth } from "@/contexts/AuthContext";

const AuthStart = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  useEffect(() => {
    const initiated = sessionStorage.getItem('auth_initiated') === '1';
    if (currentUser) {
      navigate('/auth/callback', { replace: true });
      return;
    }
    if (!initiated) {
      sessionStorage.setItem('auth_initiated', '1');
      signInWithRedirect(auth, provider).catch(() => navigate('/login', { replace: true }));
    } else {
      navigate('/auth/callback', { replace: true });
    }
  }, [currentUser, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Redirection vers Google...
    </div>
  );
};

export default AuthStart; 