import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Settings, 
  CreditCard, 
  Building, 
  Shield, 
  Database,
  Bell,
  Download,
  Upload,
  Crown,
  Users
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs, query, where, limit, onSnapshot } from "firebase/firestore";
import { sendEmailVerification, signOut } from "firebase/auth";
import { startSingPayPayment } from "@/lib/payments";
import { getBillingForUser } from "@/lib/billing";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const SettingsPage = ({ onTabChange }: { onTabChange?: (tab: string) => void }) => {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  
  const [establishmentInfo, setEstablishmentInfo] = useState({
    name: "",
    address: "",
    phone: "",
    email: ""
  });
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);
  const [loadingEstablishment, setLoadingEstablishment] = useState<boolean>(true);

  const [teamCounts, setTeamCounts] = useState({ total: 0, active: 0, serveurs: 0, caissiers: 0, agents: 0 });

  // Load establishment data for current user
  useEffect(() => {
    const load = async () => {
      if (!currentUser) return;
      try {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        let estId: string | null = null;
        if (userSnap.exists()) {
          const data = userSnap.data() as any;
          estId = data.establishmentId ?? null;
        }
        if (!estId) {
          const q = query(collection(db, "establishments"), where("ownerUid", "==", currentUser.uid), limit(1));
          const qSnap = await getDocs(q);
          if (!qSnap.empty) estId = qSnap.docs[0].id;
        }
        if (estId) {
          const estRef = doc(db, "establishments", estId);
          const estSnap = await getDoc(estRef);
          if (estSnap.exists()) {
            const est = estSnap.data() as any;
            setEstablishmentInfo({
              name: est.name ?? "",
              address: est.address ?? (est.city ?? ""),
              phone: est.phone ?? "",
              email: est.email ?? "",
            });
            setEstablishmentId(estId);
          }
        }
      } catch (e: any) {
        console.error(e);
        toast({ title: "Erreur de chargement", description: e?.message ?? "", variant: "destructive" });
      } finally {
        setLoadingEstablishment(false);
      }
    };
    load();
  }, [currentUser, toast]);

  // Live team counters for current user
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "teamMembers"), where("ownerUid", "==", currentUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      const members = snap.docs.map(d => d.data() as any);
      const total = members.length;
      const active = members.filter((m) => m.status === 'active').length;
      const serveurs = members.filter((m) => m.role === 'serveur').length;
      const caissiers = members.filter((m) => m.role === 'caissier').length;
      const agents = members.filter((m) => m.role === 'agent-evenement').length;
      setTeamCounts({ total, active, serveurs, caissiers, agents });
    });
    return () => unsub();
  }, [currentUser]);

  const [notificationSettings, setNotificationSettings] = useState({
    lowStock: true,
    dailyReport: true,
    newSales: false,
    teamUpdates: true
  });

  const [securitySettings, setSecuritySettings] = useState({
    twoFactor: false,
    autoLogout: true,
    sessionTimeout: "30"
  });

  const email = currentUser?.email || "";
  const emailVerified = !!currentUser?.emailVerified;
  const providers = (currentUser?.providerData || []).map((p) => p.providerId);
  const lastSignIn = currentUser?.metadata?.lastSignInTime ? new Date(currentUser.metadata.lastSignInTime).toLocaleString('fr-FR') : "";
  const createdAt = currentUser?.metadata?.creationTime ? new Date(currentUser.metadata.creationTime).toLocaleString('fr-FR') : "";
  const mfaCount = (currentUser as any)?.multiFactor?.enrolledFactors?.length || 0;
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';

  const handleVerifyEmail = async () => {
    try {
      if (currentUser && !currentUser.emailVerified) {
        await sendEmailVerification(currentUser);
        toast({ title: "Vérification envoyée", description: "Un email de vérification vous a été envoyé." });
      }
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message ?? "", variant: "destructive" });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message ?? "", variant: "destructive" });
    }
  };

  const handleSaveEstablishment = async () => {
    if (!currentUser) return;
    try {
      setLoadingEstablishment(true);
      let estId = establishmentId;
      if (!estId) {
        const newRef = doc(collection(db, "establishments"));
        await setDoc(newRef, {
          id: newRef.id,
          ownerUid: currentUser.uid,
          name: establishmentInfo.name,
          address: establishmentInfo.address,
          phone: establishmentInfo.phone,
          email: establishmentInfo.email,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        estId = newRef.id;
        await setDoc(doc(db, "users", currentUser.uid), { establishmentId: estId, updatedAt: serverTimestamp() }, { merge: true });
        setEstablishmentId(estId);
      } else {
        try {
          await setDoc(doc(db, "establishments", estId), {
            name: establishmentInfo.name,
            address: establishmentInfo.address,
            phone: establishmentInfo.phone,
            email: establishmentInfo.email,
            updatedAt: serverTimestamp(),
          }, { merge: true });
        } catch (err: any) {
          if (err?.code === "permission-denied") {
            // Fallback: create a fresh doc owned by this user and relink
            const newRef = doc(collection(db, "establishments"));
            await setDoc(newRef, {
              id: newRef.id,
              ownerUid: currentUser.uid,
              name: establishmentInfo.name,
              address: establishmentInfo.address,
              phone: establishmentInfo.phone,
              email: establishmentInfo.email,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            await setDoc(doc(db, "users", currentUser.uid), { establishmentId: newRef.id, updatedAt: serverTimestamp() }, { merge: true });
            setEstablishmentId(newRef.id);
          } else {
            throw err;
          }
        }
      }
      toast({
        title: "Informations sauvegardées",
        description: "Les informations de l'établissement ont été mises à jour",
      });
    } catch (e: any) {
      toast({ title: "Erreur d'enregistrement", description: e?.message ?? "", variant: "destructive" });
    } finally {
      setLoadingEstablishment(false);
    }
  };

  const handleExportData = () => {
    toast({
      title: "Export en cours",
      description: "Vos données sont en cours d'export. Vous recevrez un email quand ce sera prêt.",
    });
  };

  const handleBackup = () => {
    toast({
      title: "Sauvegarde créée",
      description: "Une sauvegarde complète de vos données a été créée",
    });
  };

  const currentPlan = {
    name: "Plan Professionnel",
    price: "15,000 XAF/mois",
    features: [
      "Gestion illimitée des produits",
      "Équipe jusqu'à 10 membres",
      "Rapports avancés",
      "Support prioritaire"
    ],
    nextBilling: "15 février 2024"
  };

  const TRIAL_DAYS = 7;
  const PRICING = {
    subscription: 2500,
    member: 1000,
    event: 2000,
    includedEventAgents: 2,
  };

  const [trialEndsAt, setTrialEndsAt] = useState<Date | null>(null);
  const [isInTrial, setIsInTrial] = useState<boolean>(true);
  const [showPricingInfo, setShowPricingInfo] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    const loadTrial = async () => {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        const created = currentUser.metadata?.creationTime ? new Date(currentUser.metadata.creationTime) : new Date();
        const trialEnd = new Date(created);
        trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);
        setTrialEndsAt(trialEnd);
        setIsInTrial(new Date() < trialEnd);
        // Optionnel: lire un champ billing.active pour savoir si déjà abonné
      } catch {}
    };
    loadTrial();
  }, [currentUser]);

  const openPayment = async (amount: number, reference: string) => {
    try {
      localStorage.setItem('nack_last_payment_ref', reference);
      const link = await startSingPayPayment({ amount, reference });
      window.location.href = link;
    } catch (e: any) {
      toast({ title: 'Paiement', description: e?.message ?? '', variant: 'destructive' });
    }
  };

  const [billing, setBilling] = useState<{ active: boolean; paidUntil?: Date | null }>({ active: false, paidUntil: null });

  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      try {
        const b = await getBillingForUser(currentUser.uid);
        setBilling({ active: !!b.subscriptionActive, paidUntil: b.subscriptionPaidUntil || null });
      } catch {}
    })();
  }, [currentUser]);

  const daysLeft = billing.paidUntil ? Math.max(0, Math.ceil((billing.paidUntil.getTime() - Date.now()) / (1000*60*60*24))) : 0;

  return (
    <div className="space-y-6">
      <Card className="shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings size={24} />
            Paramètres de l'application
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 leading-none rounded-full text-sm"
              onClick={() => setShowAbout(true)}
              aria-label="À propos"
              title="À propos"
            >
              !
            </Button>
          </CardTitle>
          <CardDescription>
            Configurez votre établissement et vos préférences
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="subscription" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 h-auto">
          <TabsTrigger value="subscription" className="text-xs sm:text-sm px-2 py-3 h-auto">Abonnement</TabsTrigger>
          <TabsTrigger value="establishment" className="text-xs sm:text-sm px-2 py-3 h-auto">Établissement</TabsTrigger>
          <TabsTrigger value="security" className="text-xs sm:text-sm px-2 py-3 h-auto">Sécurité</TabsTrigger>
          <TabsTrigger value="data" className="text-xs sm:text-sm px-2 py-3 h-auto">Données</TabsTrigger>
        </TabsList>

        {/* Subscription Tab */}
        <TabsContent value="subscription">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Abonnement & Tarifs (réel) */}
            <Card className="shadow-card border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="text-nack-red" size={20} />
                  Abonnement & Tarifs
                </CardTitle>
                <CardDescription>
                  {isInTrial && trialEndsAt ? `Essai gratuit jusqu'au ${trialEndsAt.toLocaleDateString('fr-FR')}` : (billing.active && billing.paidUntil ? `Actif • ${daysLeft} jour(s) restants` : 'Inactif')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-nack-beige-light rounded-lg">
                      <p className="text-sm font-medium">Abonnement gérant (solo)</p>
                      <p className="text-xl font-bold text-nack-red">{PRICING.subscription.toLocaleString()} XAF / mois</p>
                      <Button className="mt-2 bg-gradient-primary text-white" onClick={() => openPayment(PRICING.subscription, 'Abonnement')}>Payer l'abonnement</Button>
                    </div>
                    <div className="p-3 bg-background rounded-lg border">
                      <p className="text-sm font-medium">Ajout Serveur/Caissier</p>
                      <p className="text-xl font-bold">{PRICING.member.toLocaleString()} XAF / agent</p>
                      <Button className="mt-2" variant="outline" onClick={() => openPayment(PRICING.member, 'Ajout membre')}>Acheter un agent</Button>
                    </div>
                  </div>
                  <div className="p-3 bg-background rounded-lg border">
                    <p className="text-sm font-medium">Création d'événement</p>
                    <p className="text-xl font-bold">{PRICING.event.toLocaleString()} XAF / événement</p>
                    <p className="text-xs text-muted-foreground">Inclut jusqu'à {PRICING.includedEventAgents} agents évènement gratuitement</p>
                    <div className="flex flex-col sm:flex-row gap-2 mt-2">
                      <Button variant="outline" className="w-full sm:w-auto" onClick={() => openPayment(PRICING.event, "Création d'événement")}>Acheter un événement</Button>
                      <Button variant="outline" className="w-full sm:w-auto" onClick={() => setShowPricingInfo(true)}>Mode d'emploi & tarifs</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Carte statut d’abonnement (sans données fictives) */}
            <Card className="shadow-card border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard size={20} />
                  Statut d’abonnement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-background rounded-lg border">
                    <div>
                      <p className="text-sm">État</p>
                      <p className="text-xs text-muted-foreground">{billing.active ? 'Actif' : (isInTrial ? 'Période d’essai' : 'Inactif')}</p>
                    </div>
                    <Badge className={billing.active ? 'bg-green-100 text-green-800 hover:bg-green-100' : 'bg-red-100 text-red-800 hover:bg-red-100'}>
                      {billing.active ? 'Actif' : (isInTrial ? 'Essai' : 'Inactif')}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-background rounded-lg border">
                    <div>
                      <p className="text-sm">Expire le</p>
                      <p className="text-xs text-muted-foreground">{billing.paidUntil ? billing.paidUntil.toLocaleString('fr-FR') : (isInTrial && trialEndsAt ? trialEndsAt.toLocaleString('fr-FR') : '—')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{billing.active ? `${daysLeft} j restants` : (isInTrial && trialEndsAt ? `${Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now())/(1000*60*60*24)))} j restants` : '')}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Dialog open={showPricingInfo} onOpenChange={setShowPricingInfo}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Mode d'emploi & Tarifs</DialogTitle>
                <DialogDescription>Informations essentielles</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium">Étapes clés</p>
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    <li>Ajoutez vos produits (Stock)</li>
                    <li>Vos serveurs prennent des commandes, le caissier encaisse</li>
                    <li>Créez des événements (QR billets) et contrôlez à l'entrée</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium">Tarifs</p>
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    <li>Abonnement gérant (solo): 2 500 XAF / mois</li>
                    <li>Ajout serveur/caissier: 1 000 XAF / agent</li>
                    <li>Création d'événement: 2 000 XAF (inclut 2 agents événement)</li>
                    <li>Essai gratuit: 7 jours dès la création du compte</li>
                  </ul>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowPricingInfo(false)}>Fermer</Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Establishment Tab */}
        <TabsContent value="establishment">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-card border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building size={20} />
                  Informations de l'établissement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="establishment-name">Nom de l'établissement</Label>
                    <Input
                      id="establishment-name"
                      value={establishmentInfo.name}
                      onChange={(e) => setEstablishmentInfo({...establishmentInfo, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="establishment-address">Adresse</Label>
                    <Input
                      id="establishment-address"
                      value={establishmentInfo.address}
                      onChange={(e) => setEstablishmentInfo({...establishmentInfo, address: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="establishment-phone">Téléphone</Label>
                    <Input
                      id="establishment-phone"
                      value={establishmentInfo.phone}
                      onChange={(e) => setEstablishmentInfo({...establishmentInfo, phone: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="establishment-email">Email</Label>
                    <Input
                      id="establishment-email"
                      type="email"
                      value={establishmentInfo.email}
                      onChange={(e) => setEstablishmentInfo({...establishmentInfo, email: e.target.value})}
                    />
                  </div>
                  <Button onClick={handleSaveEstablishment} disabled={loadingEstablishment} className="w-full bg-gradient-primary text-white">
                    {loadingEstablishment ? "Sauvegarde..." : "Sauvegarder les informations"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell size={20} />
                  Notifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Alertes de stock faible</p>
                      <p className="text-sm text-muted-foreground">Être notifié quand les stocks sont faibles</p>
                    </div>
                    <Switch
                      checked={notificationSettings.lowStock}
                      onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, lowStock: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Rapport quotidien</p>
                      <p className="text-sm text-muted-foreground">Recevoir un résumé des ventes quotidiennes</p>
                    </div>
                    <Switch
                      checked={notificationSettings.dailyReport}
                      onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, dailyReport: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Nouvelles ventes</p>
                      <p className="text-sm text-muted-foreground">Notification pour chaque nouvelle vente</p>
                    </div>
                    <Switch
                      checked={notificationSettings.newSales}
                      onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, newSales: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Mises à jour équipe</p>
                      <p className="text-sm text-muted-foreground">Notifications des changements d'équipe</p>
                    </div>
                    <Switch
                      checked={notificationSettings.teamUpdates}
                      onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, teamUpdates: checked})}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Team Management Section */}
          <Card className="shadow-card border-0 mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users size={20} />
                Gestion de l'équipe
              </CardTitle>
              <CardDescription>
                Gérez votre équipe de serveurs et caissiers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-nack-beige-light rounded-lg">
                  <div>
                    <p className="font-medium">Équipe active</p>
                    <p className="text-sm text-muted-foreground">{teamCounts.total} membres • {teamCounts.serveurs} serveurs, {teamCounts.caissiers} caissiers, {teamCounts.agents} agents événement</p>
                  </div>
                  <Button 
                    onClick={() => onTabChange("equipe")} 
                    variant="nack-outline"
                    className="gap-2"
                  >
                    <Users size={16} />
                    Gérer l'équipe
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-background rounded-lg border">
                    <p className="text-2xl font-bold text-nack-red">{teamCounts.total}</p>
                    <p className="text-sm text-muted-foreground">Membres</p>
                  </div>
                  <div className="text-center p-3 bg-background rounded-lg border">
                    <p className="text-2xl font-bold text-green-600">{teamCounts.active}</p>
                    <p className="text-sm text-muted-foreground">Actifs</p>
                  </div>
                  <div className="text-center p-3 bg-background rounded-lg border">
                    <p className="text-2xl font-bold text-purple-600">{teamCounts.agents}</p>
                    <p className="text-sm text-muted-foreground">Agents évènement</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-card border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield size={20} />
                  Sécurité du compte
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-3 bg-nack-beige-light rounded-lg">
                    <p className="text-sm"><strong>Email:</strong> {email || '—'}</p>
                    <p className="text-sm"><strong>Vérifié:</strong> {emailVerified ? 'Oui' : 'Non'}</p>
                    {!emailVerified && (
                      <Button onClick={handleVerifyEmail} size="sm" className="mt-2 bg-gradient-primary text-white">Vérifier l'email</Button>
                    )}
                  </div>
                  <div className="p-3 bg-background rounded-lg border">
                    <p className="text-sm font-medium mb-2">Méthodes de connexion</p>
                    <div className="flex flex-wrap gap-2">
                      {providers.length === 0 && <Badge variant="secondary">Aucune</Badge>}
                      {providers.map((pid, i) => (
                        <Badge key={i} variant="outline">{pid}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-background rounded-lg border">
                      <p className="text-xs text-muted-foreground">Créé le</p>
                      <p className="text-sm font-medium">{createdAt || '—'}</p>
                    </div>
                    <div className="p-3 bg-background rounded-lg border">
                      <p className="text-xs text-muted-foreground">Dernière connexion</p>
                      <p className="text-sm font-medium">{lastSignIn || '—'}</p>
                    </div>
                  </div>
                  <div className="p-3 bg-background rounded-lg border">
                    <p className="text-sm"><strong>Facteurs 2FA configurés:</strong> {mfaCount}</p>
                  </div>

                  {/* Préférences (locaux à l'app) */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Déconnexion automatique</p>
                      <p className="text-sm text-muted-foreground">Se déconnecter après une période d'inactivité</p>
                    </div>
                    <Switch
                      checked={securitySettings.autoLogout}
                      onCheckedChange={(checked) => setSecuritySettings({...securitySettings, autoLogout: checked})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="session-timeout">Délai de déconnexion (minutes)</Label>
                    <Input
                      id="session-timeout"
                      type="number"
                      value={securitySettings.sessionTimeout}
                      onChange={(e) => setSecuritySettings({...securitySettings, sessionTimeout: e.target.value})}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card border-0">
              <CardHeader>
                <CardTitle>Session actuelle</CardTitle>
                <CardDescription>Détails de votre session</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-nack-beige-light rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Navigateur</p>
                      <p className="text-xs text-muted-foreground break-all">{userAgent || '—'}</p>
                      <p className="text-xs text-muted-foreground">Dernière connexion: {lastSignIn || '—'}</p>
                    </div>
                    <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={handleSignOut}>
                      Déconnexion
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Data Tab */}
        <TabsContent value="data">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-card border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database size={20} />
                  Gestion des données
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-nack-beige-light rounded-lg">
                      <div>
                        <p className="font-medium">Sauvegarde automatique</p>
                        <p className="text-sm text-muted-foreground">Dernière sauvegarde: Aujourd'hui à 14:30</p>
                      </div>
                      <Button onClick={handleBackup} variant="outline" size="sm">
                        <Upload className="mr-2" size={16} />
                        Sauvegarder
                      </Button>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-nack-beige-light rounded-lg">
                      <div>
                        <p className="font-medium">Export des données</p>
                        <p className="text-sm text-muted-foreground">Télécharger toutes vos données</p>
                      </div>
                      <Button onClick={handleExportData} variant="outline" size="sm">
                        <Download className="mr-2" size={16} />
                        Exporter
                      </Button>
                    </div>
                  </div>
                  
                  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                    <p className="text-sm font-medium text-yellow-800">Configuration système</p>
                    <div className="mt-2 space-y-1 text-sm text-yellow-700">
                      <p>• Devise: XAF (Franc CFA)</p>
                      <p>• Fuseau horaire: GMT+0 (Dakar)</p>
                      <p>• Format de date: DD/MM/YYYY</p>
                      <p>• Langue: Français</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card border-0">
              <CardHeader>
                <CardTitle>Zone de danger</CardTitle>
                <CardDescription>Actions irréversibles</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border border-red-200 p-4 rounded-lg">
                    <h4 className="font-medium text-red-800 mb-2">Réinitialiser les données</h4>
                    <p className="text-sm text-red-600 mb-3">
                      Supprime toutes les données (ventes, stock, équipe) sauf les paramètres de base.
                    </p>
                    <Button variant="outline" className="text-red-600 border-red-600 hover:bg-red-50">
                      Réinitialiser les données
                    </Button>
                  </div>
                  
                  <div className="border border-red-200 p-4 rounded-lg">
                    <h4 className="font-medium text-red-800 mb-2">Supprimer le compte</h4>
                    <p className="text-sm text-red-600 mb-3">
                      Supprime définitivement votre compte et toutes les données associées.
                    </p>
                    <Button variant="outline" className="text-red-600 border-red-600 hover:bg-red-50">
                      Supprimer le compte
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* À propos Dialog */}
      <Dialog open={showAbout} onOpenChange={setShowAbout}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>À propos de NACK!</DialogTitle>
            <DialogDescription>Informations sur l'origine du projet</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p>
              NACK! est créé par la startup <strong>Bwitix</strong>. Notre mission est d'offrir une solution simple et efficace
              pour la gestion des ventes, des équipes et des événements.
            </p>
            <div>
              <p className="font-medium mb-2">Contact WhatsApp</p>
              <a
                href="https://wa.me/24104746847"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="bg-gradient-primary text-white w-full">Nous écrire sur WhatsApp</Button>
              </a>
            </div>
            <p className="text-xs text-muted-foreground">
              Designé par <a href="https://chouyoug.netlify.app/" target="_blank" rel="noopener noreferrer" className="underline">Chouyoug</a>.
            </p>
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setShowAbout(false)}>Fermer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsPage;