import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp, collection, getDocs, query, where, limit } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { addEventCredits } from "@/lib/billing";

const establishmentTypes = [
  { value: "bar", label: "Bar" },
  { value: "snack", label: "Snack" },
  { value: "boite", label: "Boîte de nuit" },
  { value: "restaurant", label: "Restaurant" },
];

const CompleteProfile = () => {
  const { currentUser, refreshProfile, markProfileComplete } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    establishmentName: "",
    establishmentType: "",
    establishmentCity: "",
  });
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      navigate("/login");
    }
  }, [currentUser, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!formData.establishmentName.trim() || !formData.establishmentType || !formData.establishmentCity.trim()) {
      toast({ title: "Champs manquants", description: "Nom, type et ville de l'établissement sont requis.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const userRef = doc(db, "users", currentUser.uid);
      await setDoc(userRef, {
        uid: currentUser.uid,
        email: currentUser.email ?? "",
        displayName: currentUser.displayName ?? `${formData.firstName} ${formData.lastName}`.trim(),
        photoURL: currentUser.photoURL ?? "",
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        provider: currentUser.providerData?.[0]?.providerId ?? "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      const estCol = collection(db, "establishments");
      const existing = await getDocs(query(estCol, where("ownerUid", "==", currentUser.uid), limit(1)));
      let establishmentId: string | null = null;
      try {
        if (existing.empty) {
          const newRef = doc(estCol);
          await setDoc(newRef, {
            id: newRef.id,
            ownerUid: currentUser.uid,
            name: formData.establishmentName,
            type: formData.establishmentType,
            city: formData.establishmentCity,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          establishmentId = newRef.id;
        } else {
          const docSnap = existing.docs[0];
          establishmentId = docSnap.id;
          const estRef = doc(db, "establishments", establishmentId);
          await setDoc(estRef, {
            name: formData.establishmentName,
            type: formData.establishmentType,
            city: formData.establishmentCity,
            updatedAt: serverTimestamp(),
          }, { merge: true });
        }
      } catch (err: unknown) {
        const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: unknown }).code) : '';
        if (code === "permission-denied") {
          toast({ title: "Droits Firestore requis", description: "Impossible d'enregistrer l'établissement. Vos infos profil sont sauvegardées. Vous pourrez compléter dans Paramètres après autorisation.", variant: "destructive" });
        } else {
          throw err;
        }
      }

      if (establishmentId) {
        await setDoc(doc(db, "users", currentUser.uid), { establishmentId, updatedAt: serverTimestamp() }, { merge: true });
      }

      // Bonus de bienvenue: 2 événements offerts (incluant 2 agents événement)
      try { await addEventCredits(currentUser.uid, 2); } catch (e) { /* ignore welcome credit error */ }

      markProfileComplete();
      refreshProfile();

      toast({ title: "Profil enregistré" });
      setShowWelcome(true);
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err ? String((err as { message?: unknown }).message ?? '') : '';
      toast({ title: "Erreur d'enregistrement", description: message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleWelcomeSeen = async () => {
    try {
      if (currentUser) {
        await setDoc(doc(db, "users", currentUser.uid), { welcomeShown: true, updatedAt: serverTimestamp() }, { merge: true });
      }
      localStorage.setItem('nack_welcome_shown', '1');
    } catch (e) { /* ignore persist error */ }
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gradient-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-scale-in">
        <Card className="shadow-card border-0">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl">Compléter votre profil</CardTitle>
            <CardDescription>Afin de finaliser votre inscription</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom</Label>
                <Input id="firstName" name="firstName" value={formData.firstName} onChange={handleChange} required className="h-12" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom</Label>
                <Input id="lastName" name="lastName" value={formData.lastName} onChange={handleChange} required className="h-12" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} required className="h-12" />
              </div>

              <div className="pt-2">
                <p className="text-sm font-medium mb-2">Informations sur l'établissement</p>
                <div className="space-y-2">
                  <Label htmlFor="establishmentName">Nom de l'établissement</Label>
                  <Input id="establishmentName" name="establishmentName" value={formData.establishmentName} onChange={handleChange} required className="h-12" />
                </div>
                <div className="space-y-2">
                  <Label>Type d'établissement</Label>
                  <Select value={formData.establishmentType} onValueChange={(v) => setFormData((p) => ({ ...p, establishmentType: v }))}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Sélectionner un type" />
                    </SelectTrigger>
                    <SelectContent>
                      {establishmentTypes.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="establishmentCity">Ville</Label>
                  <Input id="establishmentCity" name="establishmentCity" value={formData.establishmentCity} onChange={handleChange} required className="h-12" />
                </div>
              </div>

              <Button type="submit" className="w-full h-12" disabled={isSaving}>
                {isSaving ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showWelcome} onOpenChange={(o) => { if (!o) handleWelcomeSeen(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Bienvenue sur NACK!</DialogTitle>
            <DialogDescription>Mode d'emploi, tarifs et bonus de bienvenue</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-medium">Félicitations 🎉</p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>2 événements offerts à l'inscription</li>
                <li>Chaque événement inclut 2 agents événement offerts</li>
              </ul>
            </div>
            <div>
              <p className="font-medium">Mode d'emploi</p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Ajoutez vos produits (Stock)</li>
                <li>Vos serveurs prennent des commandes, le caissier encaisse</li>
                <li>Créez des événements (QR billets) et contrôlez à l'entrée</li>
              </ul>
            </div>
            <div>
              <p className="font-medium">Tarifs</p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Abonnement gérant (solo): 2 500 XAF / mois</li>
                <li>Ajout serveur/caissier: 1 000 XAF / agent</li>
                <li>Création d'événement: 2 000 XAF (inclut 2 agents événement)</li>
                <li>Essai gratuit: 7 jours dès la création du compte</li>
              </ul>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleWelcomeSeen}>Plus tard</Button>
            <Button className="bg-gradient-primary text-white" onClick={handleWelcomeSeen}>J'ai compris</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CompleteProfile; 