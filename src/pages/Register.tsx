import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import NackLogo from "@/components/NackLogo";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/lib/firebase";
import { getRedirectResult } from "firebase/auth";

const Register = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signInWithGoogle, currentUser, hasProfile, loading } = useAuth();

  useEffect(() => {
    (async () => {
      try {
        const res = await getRedirectResult(auth);
        if (res?.user) {
          navigate(hasProfile ? "/dashboard" : "/complete-profile", { replace: true });
        }
      } catch {}
    })();
  }, [navigate, hasProfile]);

  useEffect(() => {
    if (!loading && currentUser) {
      navigate(hasProfile ? "/dashboard" : "/complete-profile", { replace: true });
    }
  }, [currentUser, hasProfile, loading, navigate]);

  const handleGoogleSignup = async () => {
    try {
      await signInWithGoogle();
    } catch (error: any) {
      toast({ title: "Erreur Google", description: error?.message ?? "", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-scale-in">
        <div className="text-center mb-6">
          <NackLogo size="md" className="mb-2" />
          <p className="text-muted-foreground text-sm">Création de compte via Google</p>
        </div>

        <Card className="shadow-card border-0">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">Créer un compte</CardTitle>
            <CardDescription>Authentification Google uniquement</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button className="w-full h-12 bg-gradient-primary text-white" onClick={handleGoogleSignup}>
                Continuer avec Google
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Vous finaliserez vos informations d'établissement après connexion.
              </p>
              <p className="text-center text-sm text-muted-foreground">
                Déjà un compte ? <Link to="/login" className="text-nack-red hover:text-nack-red-dark font-medium">Se connecter</Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Register;