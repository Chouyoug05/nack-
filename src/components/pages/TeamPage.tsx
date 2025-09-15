import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  Plus, 
  UserCheck, 
  UserX, 
  X,
  Link,
  Copy,
  Mail,
  Phone
} from "lucide-react";
import { db } from "@/lib/firebase";
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where, getDocs, deleteDoc, setDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { startSingPayPayment } from "@/lib/payments";
import { getBillingForUser, decrementMemberCredit } from "@/lib/billing";
import { enqueue } from "@/lib/offlineQueue";

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role?: 'serveur' | 'caissier' | 'agent-evenement';
  status: 'active' | 'inactive';
  agentCode?: string;
  dashboardLink?: string;
  lastConnection?: Date;
  ownerUid?: string;
  assignedEventId?: string;
}

const TeamPage = () => {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'serveur' | 'caissier' | 'agent-evenement' | null>(null);
  
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [events, setEvents] = useState<{ id: string; title: string }[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const openPayment = async (amount: number, reference: string) => {
    try {
      localStorage.setItem('nack_last_payment_ref', reference);
      const link = await startSingPayPayment({ amount, reference });
      window.location.href = link;
    } catch (e: unknown) {
      const message = e && typeof e === 'object' && 'message' in e ? String((e as { message?: unknown }).message ?? '') : '';
      toast({ title: 'Paiement', description: message, variant: 'destructive' });
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "teamMembers"), where("ownerUid", "==", currentUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      const list: TeamMember[] = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        const roleValue = data.role === 'serveur' || data.role === 'caissier' || data.role === 'agent-evenement' ? data.role : undefined;
        const lc = data.lastConnection as { toDate?: unknown } | undefined;
        const hasToDate = lc && typeof lc.toDate === 'function';
        return {
          id: d.id,
          firstName: String((data as Record<string, unknown>).firstName ?? ""),
          lastName: String((data as Record<string, unknown>).lastName ?? ""),
          email: String((data as Record<string, unknown>).email ?? ""),
          phone: String((data as Record<string, unknown>).phone ?? ""),
          role: roleValue as TeamMember['role'],
          status: ((data as Record<string, unknown>).status ?? 'active') as TeamMember['status'],
          agentCode: (data as Record<string, unknown>).agentCode as string | undefined,
          dashboardLink: (data as Record<string, unknown>).dashboardLink as string | undefined,
          lastConnection: hasToDate ? (lc as unknown as { toDate: () => Date }).toDate() : undefined,
          ownerUid: (data as Record<string, unknown>).ownerUid as string | undefined,
          assignedEventId: (data as Record<string, unknown>).assignedEventId as string | undefined,
        } as TeamMember;
      });
      setTeamMembers(list);
    });
    return () => unsub();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "events"), where("ownerUid", "==", currentUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      setEvents(
        snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const title = typeof data.title === 'string' ? data.title : 'Événement sans titre';
          return { id: d.id, title };
        })
      );
    });
    return () => unsub();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    // Synchroniser un lien public pour chaque agent d'événement
    const evtAgents = teamMembers.filter(m => m.role === 'agent-evenement' && m.agentCode);
    evtAgents.forEach((m) => {
      const code = m.agentCode as string;
      setDoc(doc(db, 'agentLinks', code), {
        ownerUid: currentUser.uid,
        assignedEventId: m.assignedEventId || null,
        status: m.status,
        updatedAt: serverTimestamp(),
      }, { merge: true }).catch(() => {});
    });
  }, [currentUser, teamMembers]);

  const [newMember, setNewMember] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: ""
  });

  const basePath = import.meta.env.BASE_URL || '/';
  const withBase = (p: string) => `${basePath.endsWith('/') ? basePath.slice(0, -1) : basePath}${p}`;

  const generateAgentCode = () => {
    const existingCodes = teamMembers.map(m => m.agentCode).filter(Boolean) as string[];
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const randomPart = () => Array.from({ length: 6 }, () => chars[Math.floor(Math.random()*chars.length)]).join('');
    let code = '';
    let attempts = 0;
    do {
      code = `AGT-${randomPart()}`;
      attempts++;
      if (attempts > 50) break; // éviter boucle infinie
    } while (existingCodes.includes(code));
    return code;
  };

  const generateDashboardLink = (role: 'serveur' | 'caissier' | 'agent-evenement', agentCode: string) => {
    if (role === 'serveur') return withBase(`/serveur/${agentCode}`);
    if (role === 'caissier') return withBase(`/caisse/${agentCode}`);
    return withBase(`/agent-evenement/${agentCode}`);
  };

  const handleAddMember = async () => {
    if (!currentUser) {
      toast({ title: "Authentification requise", description: "Connectez-vous pour ajouter un membre", variant: "destructive" });
      return;
    }
    if (!newMember.firstName || !newMember.lastName || !newMember.phone || !selectedRole) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSaving(true);

      // Vérifier doublons
      const dupQueries = [
        getDocs(query(collection(db, 'teamMembers'), where('ownerUid', '==', currentUser.uid), where('phone', '==', newMember.phone)))
      ];
      if (newMember.email) {
        dupQueries.push(getDocs(query(collection(db, 'teamMembers'), where('ownerUid', '==', currentUser.uid), where('email', '==', newMember.email))));
      }
      const dupSnaps = await Promise.all(dupQueries);
      if (dupSnaps.some(s => !s.empty)) {
        toast({ title: 'Doublon détecté', description: 'Un membre avec ce téléphone ou email existe déjà.', variant: 'destructive' });
        setIsSaving(false);
        return;
      }

      // Crédit requis pour serveur/caissier uniquement
      if (selectedRole === 'serveur' || selectedRole === 'caissier') {
        const billing = await getBillingForUser(currentUser.uid);
        if ((billing.memberCredits || 0) <= 0) {
          await openPayment(1000, 'Ajout membre');
          setIsSaving(false);
          return;
        }
        await decrementMemberCredit(currentUser.uid);
      }

      const agentCode = generateAgentCode();
      const dashboardLink = generateDashboardLink(selectedRole, agentCode);

      try {
        await addDoc(collection(db, "teamMembers"), {
          ownerUid: currentUser.uid,
          firstName: newMember.firstName,
          lastName: newMember.lastName,
          email: newMember.email,
          phone: newMember.phone,
          role: selectedRole,
          status: "active",
          agentCode,
          dashboardLink,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err: unknown) {
        // Offline fallback: enfile l'ajout de membre
        enqueue({ type: 'add_team_member', payload: {
          ownerUid: currentUser.uid,
          firstName: newMember.firstName,
          lastName: newMember.lastName,
          email: newMember.email,
          phone: newMember.phone,
          role: selectedRole,
          status: "active",
          agentCode,
          dashboardLink,
        }});
        toast({ title: 'Hors-ligne', description: "Le membre sera ajouté automatiquement à la reconnexion.", variant: 'default' });
      }

      setNewMember({ firstName: "", lastName: "", email: "", phone: "" });
      setSelectedRole(null);
      setIsAddModalOpen(false);

      const fullLink = `${window.location.origin}${dashboardLink}`;
      navigator.clipboard.writeText(fullLink);
      toast({
        title: "Agent ajouté avec succès",
        description: `Code: ${agentCode} – lien copié dans le presse-papier.`,
      });
    } catch (e: unknown) {
      const message = e && typeof e === 'object' && 'code' in e && (e as { code?: string }).code === "permission-denied"
        ? "Permissions Firestore insuffisantes. Déployez les règles mises à jour et vérifiez que vous êtes connecté."
        : (e && typeof e === 'object' && 'message' in e ? String((e as { message?: unknown }).message ?? '') : '');
      toast({ title: "Erreur", description: message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const copyDashboardLink = (link: string, name: string) => {
    const origin = window.location.origin;
    const fullLink = `${origin}${link}`;
    navigator.clipboard.writeText(fullLink);
    toast({
      title: "Lien copié",
      description: `Lien d'accès de ${name} copié`,
    });
  };

  const toggleMemberStatus = async (id: string, currentStatus: 'active' | 'inactive') => {
    try {
      const member = teamMembers.find(m => m.id === id);
      await updateDoc(doc(db, "teamMembers", id), {
        status: currentStatus === 'active' ? 'inactive' : 'active',
        updatedAt: serverTimestamp(),
      });
      if (member?.agentCode) {
        await setDoc(doc(db, 'agentLinks', member.agentCode), {
          ownerUid: member.ownerUid,
          assignedEventId: member.assignedEventId || null,
          status: currentStatus === 'active' ? 'inactive' : 'active',
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
    } catch (e: unknown) {
      const message = e && typeof e === 'object' && 'message' in e ? String((e as { message?: unknown }).message ?? '') : '';
      toast({ title: "Erreur", description: message, variant: "destructive" });
    }
  };

  const handleAssignEvent = async (member: TeamMember, eventId: string) => {
    try {
      await updateDoc(doc(db, "teamMembers", member.id), {
        assignedEventId: eventId || null,
        updatedAt: serverTimestamp(),
      });
      if (member.agentCode) {
        await setDoc(doc(db, 'agentLinks', member.agentCode), {
          ownerUid: currentUser?.uid || member.ownerUid,
          assignedEventId: eventId || null,
          status: member.status,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
      toast({ title: "Assignation mise à jour", description: eventId ? "Événement assigné à l'agent." : "Aucun événement assigné." });
    } catch (e: unknown) {
      const message = e && typeof e === 'object' && 'message' in e ? String((e as { message?: unknown }).message ?? '') : '';
      toast({ title: "Erreur d'assignation", description: message, variant: "destructive" });
    }
  };

  const deleteMember = async (id: string, name: string) => {
    try {
      const member = teamMembers.find(m => m.id === id);
      await deleteDoc(doc(db, 'teamMembers', id));
      if (member?.agentCode) {
        await deleteDoc(doc(db, 'agentLinks', member.agentCode));
      }
      toast({ title: 'Membre supprimé', description: `${name} a été supprimé.` });
    } catch (e: unknown) {
      const message = e && typeof e === 'object' && 'message' in e ? String((e as { message?: unknown }).message ?? '') : '';
      toast({ title: 'Erreur', description: message, variant: 'destructive' });
    }
  };

  const serveurs = teamMembers.filter(member => member.role === 'serveur');
  const caissiers = teamMembers.filter(member => member.role === 'caissier');
  const agentsEvenement = teamMembers.filter(member => member.role === 'agent-evenement');
  const activeMembers = teamMembers.filter(member => member.status === 'active');

  const openAddModal = (role: 'serveur' | 'caissier' | 'agent-evenement') => {
    setSelectedRole(role);
    setIsAddModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Équipe</p>
                <p className="text-2xl font-bold">{teamMembers.length}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-secondary rounded-lg flex items-center justify-center">
                <Users size={24} className="text-nack-red" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ajout achat agent depuis Actions rapides */}
        <Card className="shadow-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Crédit Agents</p>
                <p className="text-xs text-muted-foreground">Achetez un crédit pour ajouter un serveur/caissier</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => openPayment(1000, 'Ajout membre')}>Acheter un agent</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">S / C / E</p>
                <p className="text-2xl font-bold">{serveurs.length} / {caissiers.length} / {agentsEvenement.length}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-secondary rounded-lg flex items-center justify-center">
                <Users size={24} className="text-nack-red" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="shadow-card border-0">
        <CardHeader>
          <CardTitle>Actions rapides</CardTitle>
          <CardDescription>Gérer votre équipe rapidement</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button
              onClick={() => openAddModal('serveur')}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white h-12"
            >
              <Plus size={16} className="mr-2" />
              Ajouter un Serveur
            </Button>
            <Button
              onClick={() => openAddModal('caissier')}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white h-12"
            >
              <Plus size={16} className="mr-2" />
              Ajouter un Caissier
            </Button>
            <Button
              onClick={() => openAddModal('agent-evenement')}
              className="flex-1 bg-purple-500 hover:bg-purple-600 text-white h-12"
            >
              <Plus size={16} className="mr-2" />
              Agent Événement
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Team Members */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Serveurs */}
        <Card className="shadow-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Serveurs ({serveurs.length})</span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => openAddModal('serveur')}
              >
                <Plus size={16} className="mr-2" />
                Ajouter
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {serveurs.map((member) => (
                <div key={member.id} className="bg-nack-beige-light rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center text-white font-semibold">
                        {member.firstName[0]}{member.lastName[0]}
                      </div>
                      <div>
                        <p className="font-semibold">{member.firstName} {member.lastName}</p>
                        <Badge variant={member.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                          {member.status === 'active' ? 'Actif' : 'Inactif'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                   <div className="space-y-2 text-sm">
                     {member.agentCode && (
                       <div className="flex items-center gap-2">
                         <Badge variant="outline" className="text-xs">
                           Code: {member.agentCode}
                         </Badge>
                       </div>
                     )}
                     <div className="flex items-center gap-2 text-muted-foreground">
                       <Mail size={14} />
                       <span>{member.email}</span>
                     </div>
                     <div className="flex items-center gap-2 text-muted-foreground">
                       <Phone size={14} />
                       <span>{member.phone}</span>
                     </div>
                     {member.lastConnection && (
                       <p className="text-xs text-muted-foreground">
                         Dernière connexion: {member.lastConnection.toLocaleString()}
                       </p>
                     )}
                   </div>

                   <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={() => window.open(member.dashboardLink!, '_blank')}
                       className="col-span-2 sm:col-span-1 w-full sm:w-auto min-w-[140px]"
                     >
                       <Link size={14} className="mr-2" />
                       Ouvrir l'interface
                     </Button>
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={() => copyDashboardLink(member.dashboardLink!, `${member.firstName} ${member.lastName}`)}
                       className="w-full sm:w-auto"
                     >
                       <Copy size={14} />
                     </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleMemberStatus(member.id, member.status)}
                      className={`w-full sm:w-auto ${member.status === 'active' ? 'text-red-600 hover:text-red-700 hover:bg-red-50' : 'text-green-600 hover:text-green-700 hover:bg-green-50'}`}
                    >
                      {member.status === 'active' ? <UserX size={16} /> : <UserCheck size={16} />}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="icon" className="w-9 h-9 sm:w-8 sm:h-8">
                          <X size={16} />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer cet agent ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Cette action est irréversible. Le membre sera définitivement supprimé.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMember(member.id, `${member.firstName} ${member.lastName}`)}>Confirmer</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
              {serveurs.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Aucun serveur dans l'équipe
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Caissiers */}
        <Card className="shadow-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Caissiers ({caissiers.length})</span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => openAddModal('caissier')}
              >
                <Plus size={16} className="mr-2" />
                Ajouter
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {caissiers.map((member) => (
                <div key={member.id} className="bg-nack-beige-light rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center text-white font-semibold">
                        {member.firstName[0]}{member.lastName[0]}
                      </div>
                      <div>
                        <p className="font-semibold">{member.firstName} {member.lastName}</p>
                        <Badge variant={member.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                          {member.status === 'active' ? 'Actif' : 'Inactif'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                   <div className="space-y-2 text-sm">
                     {member.agentCode && (
                       <div className="flex items-center gap-2">
                         <Badge variant="outline" className="text-xs">
                           Code: {member.agentCode}
                         </Badge>
                       </div>
                     )}
                     <div className="flex items-center gap-2 text-muted-foreground">
                       <Mail size={14} />
                       <span>{member.email}</span>
                     </div>
                     <div className="flex items-center gap-2 text-muted-foreground">
                       <Phone size={14} />
                       <span>{member.phone}</span>
                     </div>
                     {member.lastConnection && (
                       <p className="text-xs text-muted-foreground">
                         Dernière connexion: {member.lastConnection.toLocaleString()}
                       </p>
                     )}
                   </div>

                   <div className="flex items-center gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(member.dashboardLink!, '_blank')}
                        className="flex-1"
                      >
                        <Link size={14} className="mr-2" />
                        Ouvrir l'interface
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyDashboardLink(member.dashboardLink!, `${member.firstName} ${member.lastName}`)}
                      >
                        <Copy size={14} />
                      </Button>
                     <Button
                       variant="ghost"
                       size="sm"
                       onClick={() => toggleMemberStatus(member.id, member.status)}
                       className={member.status === 'active' ? 'text-red-600 hover:text-red-700 hover:bg-red-50' : 'text-green-600 hover:text-green-700 hover:bg-green-50'}
                     >
                       {member.status === 'active' ? <UserX size={16} /> : <UserCheck size={16} />}
                     </Button>
                     <AlertDialog>
                       <AlertDialogTrigger asChild>
                         <Button variant="destructive" size="sm">Supprimer</Button>
                       </AlertDialogTrigger>
                       <AlertDialogContent>
                         <AlertDialogHeader>
                           <AlertDialogTitle>Supprimer cet agent ?</AlertDialogTitle>
                           <AlertDialogDescription>
                             Cette action est irréversible. Le membre sera définitivement supprimé.
                           </AlertDialogDescription>
                         </AlertDialogHeader>
                         <AlertDialogFooter>
                           <AlertDialogCancel>Annuler</AlertDialogCancel>
                           <AlertDialogAction onClick={() => deleteMember(member.id, `${member.firstName} ${member.lastName}`)}>Confirmer</AlertDialogAction>
                         </AlertDialogFooter>
                       </AlertDialogContent>
                     </AlertDialog>
                   </div>
                </div>
              ))}
              {caissiers.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Aucun caissier dans l'équipe
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Agents Événement */}
        <Card className="shadow-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Agents Événement ({agentsEvenement.length})</span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => openAddModal('agent-evenement')}
              >
                <Plus size={16} className="mr-2" />
                Ajouter
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {agentsEvenement.map((member) => (
                <div key={member.id} className="bg-purple-50 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                        {member.firstName[0]}{member.lastName[0]}
                      </div>
                      <div>
                        <p className="font-semibold">{member.firstName} {member.lastName}</p>
                        <Badge variant={member.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                          {member.status === 'active' ? 'Actif' : 'Inactif'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3 text-sm">
                     {member.agentCode && (
                       <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">Code: {member.agentCode}</Badge>
                       </div>
                     )}
                     <div className="flex items-center gap-2 text-muted-foreground">
                       <Mail size={14} />
                       <span>{member.email}</span>
                     </div>
                     <div className="flex items-center gap-2 text-muted-foreground">
                       <Phone size={14} />
                       <span>{member.phone}</span>
                     </div>

                    <div className="pt-2">
                      <Label className="text-xs">Événement assigné</Label>
                      <select
                        className="mt-1 w-full border rounded-md h-9 px-2 bg-white"
                        value={member.assignedEventId || ''}
                        onChange={(e) => handleAssignEvent(member, e.target.value)}
                      >
                        <option value="">— Aucun (désactivé) —</option>
                        {events.map((ev) => (
                          <option key={ev.id} value={ev.id}>{ev.title}</option>
                        ))}
                      </select>
                      <p className="text-xs text-muted-foreground mt-1">
                        L'agent ne pourra scanner que les billets de l'événement assigné.
                      </p>
                    </div>
                     {member.lastConnection && (
                       <p className="text-xs text-muted-foreground">
                         Dernière connexion: {member.lastConnection.toLocaleString()}
                       </p>
                     )}
                   </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={() => window.open(member.dashboardLink!, '_blank')}
                       className="col-span-2 sm:col-span-1 w-full sm:w-auto min-w-[140px]"
                     >
                       <Link size={14} className="mr-2" />
                       Ouvrir l'interface
                     </Button>
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={() => copyDashboardLink(member.dashboardLink!, `${member.firstName} ${member.lastName}`)}
                       className="w-full sm:w-auto"
                     >
                       <Copy size={14} />
                     </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleMemberStatus(member.id, member.status)}
                      className={`w-full sm:w-auto ${member.status === 'active' ? 'text-red-600 hover:text-red-700 hover:bg-red-50' : 'text-green-600 hover:text-green-700 hover:bg-green-50'}`}
                    >
                      {member.status === 'active' ? <UserX size={16} /> : <UserCheck size={16} />}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="icon" className="w-9 h-9 sm:w-8 sm:h-8">
                          <X size={16} />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer cet agent ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Cette action est irréversible. Le membre sera définitivement supprimé.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMember(member.id, `${member.firstName} ${member.lastName}`)}>Confirmer</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
              {agentsEvenement.length === 0 && (
                <p className="text-center text-muted-foreground py-8">Aucun agent événement dans l'équipe</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Member Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Ajouter un {selectedRole === 'serveur' ? 'Serveur' : selectedRole === 'caissier' ? 'Caissier' : 'Agent Événement'}
            </DialogTitle>
            <DialogDescription>
              Remplissez les informations du nouvel agent. Un code d'agent et un lien d'accès personnalisé seront générés automatiquement.
              {selectedRole === 'agent-evenement' && ' Cet agent aura accès uniquement au scanner QR pour valider les billets d\'événements.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">Prénom *</Label>
              <Input
                id="firstName"
                value={newMember.firstName}
                onChange={(e) => setNewMember({...newMember, firstName: e.target.value})}
                placeholder="Marie"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Nom de famille *</Label>
              <Input
                id="lastName"
                value={newMember.lastName}
                onChange={(e) => setNewMember({...newMember, lastName: e.target.value})}
                placeholder="Mvondo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone *</Label>
              <Input
                id="phone"
                value={newMember.phone}
                onChange={(e) => setNewMember({...newMember, phone: e.target.value})}
                placeholder="+241 01 23 45 67"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email (optionnel)</Label>
              <Input
                id="email"
                type="email"
                value={newMember.email}
                onChange={(e) => setNewMember({...newMember, email: e.target.value})}
                placeholder="marie.mvondo@gmail.com"
              />
            </div>
          </div>
          {newMember.firstName && newMember.lastName && selectedRole && (
            <div className="bg-nack-beige-light p-4 rounded-lg space-y-3">
              <div>
                <p className="text-sm font-medium mb-2">Code agent qui sera généré:</p>
                <Badge variant="outline" className="font-mono">{generateAgentCode()}</Badge>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Lien d'accès qui sera généré:</p>
                <code className="text-xs bg-background p-2 rounded border block break-all">
                  {window.location.origin}{generateDashboardLink(selectedRole, generateAgentCode())}
                </code>
              </div>
               <div className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-400">
                 <p className="text-xs text-blue-800 font-medium mb-1">
                  {selectedRole === 'serveur' ? '🛎️ Interface Serveur' : selectedRole === 'caissier' ? '💰 Interface Caisse' : '📱 Interface Agent Événement'}
                 </p>
                 <p className="text-xs text-blue-700">
                   {selectedRole === 'serveur' 
                     ? 'L\'agent aura accès aux produits et pourra prendre les commandes'
                     : selectedRole === 'caissier'
                     ? 'L\'agent aura accès à la feuille de caisse pour enregistrer les paiements'
                    : 'L\'agent aura accès uniquement au scanner QR pour valider les billets d\'événements'}
                 </p>
               </div>
              <p className="text-xs text-muted-foreground">
                Le lien sera automatiquement copié dans le presse-papier après l'ajout de l'agent.
              </p>
            </div>
          )}
          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)} className="w-full sm:w-auto">
              Annuler
            </Button>
            <Button onClick={handleAddMember} disabled={isSaving} className="bg-gradient-primary text-white w-full sm:w-auto">
              {isSaving ? 'Ajout en cours...' : 'Ajouter l\'agent'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeamPage;