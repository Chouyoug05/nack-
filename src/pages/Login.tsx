import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import NackLogo from "@/components/NackLogo";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/lib/firebase";
import { getRedirectResult, UserCredential } from "firebase/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Login = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentUser, hasProfile, loading } = useAuth();

  const [debugEnabled, setDebugEnabled] = useState(false);
  const [lastRedirectResult, setLastRedirectResult] = useState<UserCredential | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setDebugEnabled(params.get('debug') === '1');
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await getRedirectResult(auth);
        if (debugEnabled) setLastRedirectResult(res ?? null);
        if (res?.user) {
          navigate(hasProfile ? "/dashboard" : "/complete-profile", { replace: true });
        }
      } catch (e) {
        if (debugEnabled) {
          console.warn('getRedirectResult error', e);
        }
      }
    })();
  }, [navigate, hasProfile, debugEnabled]);

  useEffect(() => {
    if (!loading && currentUser) {
      navigate(hasProfile ? "/dashboard" : "/complete-profile", { replace: true });
    }
  }, [currentUser, hasProfile, loading, navigate]);

  const handleGoogleLogin = async () => {
    try {
      sessionStorage.removeItem('auth_initiated');
      navigate('/auth/start');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast({ title: "Erreur de connexion Google", description: message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-scale-in">
        <div className="text-center mb-8">
          <NackLogo size="lg" className="mb-2" />
          <p className="text-muted-foreground">Connexion sécurisée via Google</p>
        </div>

        <Card className="shadow-card border-0">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl">Se connecter</CardTitle>
            <CardDescription>Authentification Google uniquement</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button variant="outline" className="w-full h-12" onClick={handleGoogleLogin}>
                Continuer avec Google
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                En continuant, vous acceptez nos conditions d'utilisation.
              </p>
              <p className="text-center text-sm text-muted-foreground">
                Pas encore de compte ? <Link to="/register" className="text-nack-red hover:text-nack-red-dark font-medium">Créer un compte</Link>
              </p>

              {debugEnabled && (
                <div className="mt-4 p-3 text-xs rounded-md border bg-white/60 text-left break-words">
                  <div className="font-medium mb-1">Debug Auth</div>
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify({
                      loading,
                      hasProfile,
                      currentUser: currentUser ? {
                        uid: currentUser.uid,
                        email: currentUser.email,
                        providerId: currentUser.providerData?.[0]?.providerId,
                      } : null,
                      location: {
                        href: window.location.href,
                        hostname: window.location.hostname,
                        pathname: window.location.pathname,
                      },
                      userAgent: navigator.userAgent,
                      lastRedirectResult: lastRedirectResult ? {
                        user: {
                          uid: lastRedirectResult.user.uid,
                          email: lastRedirectResult.user.email,
                        },
                        providerId: lastRedirectResult.providerId,
                        operationType: lastRedirectResult.operationType,
                      } : null,
                    }, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;