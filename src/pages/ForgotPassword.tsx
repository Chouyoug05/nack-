import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Mail } from "lucide-react";
import NackLogo from "@/components/NackLogo";
import { useToast } from "@/hooks/use-toast";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulation d'envoi d'email
    setTimeout(() => {
      setIsSubmitted(true);
      toast({
        title: "Email envoyé !",
        description: "Vérifiez votre boîte de réception pour réinitialiser votre mot de passe.",
      });
      setIsLoading(false);
    }, 1500);
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-secondary flex items-center justify-center p-4">
        <div className="w-full max-w-md animate-scale-in">
          <div className="text-center mb-8">
            <NackLogo size="lg" className="mb-2" />
          </div>

          <Card className="shadow-card border-0 text-center">
            <CardHeader className="pb-4">
              <div className="mx-auto w-16 h-16 bg-nack-red/10 rounded-full flex items-center justify-center mb-4">
                <Mail className="w-8 h-8 text-nack-red" />
              </div>
              <CardTitle className="text-2xl">Email envoyé !</CardTitle>
              <CardDescription className="text-base">
                Nous avons envoyé un lien de réinitialisation à<br />
                <strong>{email}</strong>
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Vérifiez votre boîte de réception et cliquez sur le lien pour réinitialiser votre mot de passe.
              </p>
              
              <div className="space-y-3">
                <Button
                  variant="nack"
                  size="lg"
                  className="w-full"
                  onClick={() => setIsSubmitted(false)}
                >
                  Renvoyer l'email
                </Button>
                
                <Link to="/login">
                  <Button variant="nack-ghost" size="lg" className="w-full">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Retour à la connexion
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-scale-in">
        <div className="text-center mb-8">
          <NackLogo size="lg" className="mb-2" />
          <p className="text-muted-foreground">Réinitialisation du mot de passe</p>
        </div>

        <Card className="shadow-card border-0">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl">Mot de passe oublié ?</CardTitle>
            <CardDescription>
              Entrez votre email pour recevoir un lien de réinitialisation
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Adresse email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12"
                />
              </div>

              <Button
                type="submit"
                variant="nack"
                size="lg"
                className="w-full h-12"
                disabled={isLoading}
              >
                {isLoading ? "Envoi en cours..." : "Envoyer le lien"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Link 
                to="/login"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-nack-red transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Retour à la connexion
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ForgotPassword;