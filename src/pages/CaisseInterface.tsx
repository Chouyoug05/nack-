import { useState, useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { OrderProvider } from "@/contexts/OrderContext";
import OrderManagement from "@/components/OrderManagement";
import { 
  CreditCard, 
  Banknote, 
  LogOut,
  User,
  Calculator,
  Receipt,
  DollarSign
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, serverTimestamp, addDoc, updateDoc, doc, Timestamp, orderBy, limit, writeBatch, increment, runTransaction } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { enqueue } from "@/lib/offlineQueue";

interface Order {
  id: string;
  items: { id?: string; name: string; quantity: number; price: number }[];
  total: number;
  tableNumber?: string;
  serveur: string;
  timestamp: Date;
  status: 'pending' | 'paid' | 'sent';
}

const CaisseInterfaceContent = () => {
  const { agentCode } = useParams();
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [agentInfo, setAgentInfo] = useState<{ name: string; code: string } | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [agentCodeInput, setAgentCodeInput] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<'card' | 'cash' | null>(null);
  const [cashReceived, setCashReceived] = useState<string>("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [salesToday, setSalesToday] = useState<{ total: number; list: any[] }>({ total: 0, list: [] });
  const [resolvedOwnerUid, setResolvedOwnerUid] = useState<string | null>(null);

  // Résoudre le ownerUid à partir du currentUser ou de l'agentCode
  useEffect(() => {
    if (currentUser?.uid) {
      setResolvedOwnerUid(currentUser.uid);
      return;
    }
    if (!agentCode) return;
    const q = query(collection(db, "teamMembers"), where("agentCode", "==", agentCode), limit(1));
    const unsub = onSnapshot(q, (snap) => {
      const docSnap = snap.docs[0];
      const owner = docSnap ? (docSnap.data() as any).ownerUid : null;
      setResolvedOwnerUid(owner);
    });
    return () => unsub();
  }, [currentUser, agentCode]);

  useEffect(() => {
    if (!resolvedOwnerUid) return;
    const q = query(collection(db, "orders"), where("ownerUid", "==", resolvedOwnerUid), where("status", "==", "sent"));
    const unsub = onSnapshot(q, (snap) => {
      const list: Order[] = snap.docs.map(d => {
        const data = d.data() as any;
        return {
          id: d.id,
          items: Array.isArray(data.items) ? data.items : [],
          total: Number(data.total ?? 0),
          tableNumber: String(data.tableNumber ?? ""),
          serveur: data.agentCode || "",
          timestamp: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          status: 'sent'
        } as Order;
      });
      setOrders(list);
      // Désélectionner si la commande n'existe plus
      if (selectedOrderId && !list.find(o => o.id === selectedOrderId)) {
        setSelectedOrderId(null);
      }
    });
    return () => unsub();
  }, [resolvedOwnerUid, selectedOrderId]);

  useEffect(() => {
    if (!resolvedOwnerUid) return;
    const start = new Date(); start.setHours(0,0,0,0);
    const q = query(
      collection(db, "sales"),
      where("ownerUid", "==", resolvedOwnerUid),
      where("createdAt", ">=", Timestamp.fromDate(start))
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      const sorted = [...list].sort((a,b) => (b.createdAt?.toDate?.()?.getTime?.()||0) - (a.createdAt?.toDate?.()?.getTime?.()||0)).slice(0,50);
      const total = sorted.reduce((s, r) => s + Number(r.total ?? 0), 0);
      setSalesToday({ total, list: sorted });
    });
    return () => unsub();
  }, [resolvedOwnerUid]);

  useEffect(() => {
    if (agentCode && agentCode.startsWith('AGT-')) {
      // Agent code is in URL, show login form
    }
  }, [agentCode]);

  if (!agentCode || !agentCode.startsWith('AGT-')) {
    return <Navigate to="/not-found" replace />;
  }

  const handleAgentLogin = () => {
    if (agentCodeInput === agentCode) {
      setIsAuthenticated(true);
      setAgentInfo({
        name: "Agent Caissier",
        code: agentCode
      });
      toast({
        title: "Connexion réussie",
        description: `Bienvenue dans l'interface caisse`,
      });
    } else {
      toast({
        title: "Code incorrect",
        description: "Veuillez saisir le bon code d'agent",
        variant: "destructive"
      });
    }
  };

  const handlePayment = async () => {
    const selected = orders.find(o => o.id === selectedOrderId);
    if (!selected) {
      toast({ title: "Sélection requise", description: "Choisissez une commande à encaisser", variant: "destructive" });
      return;
    }
    if (!selectedPayment) {
      toast({ title: "Mode de paiement requis", description: "Veuillez sélectionner un mode de paiement", variant: "destructive" });
      return;
    }
    if (selectedPayment === 'cash') {
      const received = parseFloat(cashReceived);
      if (!received || received < selected.total) {
        toast({ title: "Montant insuffisant", description: "Le montant reçu est insuffisant", variant: "destructive" });
        return;
      }
    }

    try {
      if (!resolvedOwnerUid) return;

      const result = await runTransaction(db, async (tx) => {
        const orderRef = doc(db, "orders", selected.id);
        const orderSnap = await tx.get(orderRef);
        if (!orderSnap.exists()) throw new Error("Commande introuvable");
        const data = orderSnap.data() as any;
        if (data.status === 'paid') {
          return { alreadyPaid: true } as const;
        }

        const saleRef = doc(collection(db, "sales"));
        tx.set(saleRef, {
          ownerUid: resolvedOwnerUid,
          total: selected.total,
          items: selected.items,
          paymentMethod: selectedPayment,
          source: selectedPayment,
          orderId: selected.id,
          agentCode: selected.serveur || "",
          createdAt: serverTimestamp(),
        });

        // Marquer commande comme payée
        tx.update(orderRef, { status: 'paid', updatedAt: serverTimestamp() });

        // Décrémenter le stock des produits vendus au moment du paiement
        (selected.items || []).forEach((it: any) => {
          if (!it?.id) return; // nécessite un id produit
          const productRef = doc(collection(db, "products"), it.id);
          tx.update(productRef, {
            quantity: increment(-Number(it.quantity || 0)),
            updatedAt: serverTimestamp(),
          });
        });

        return { alreadyPaid: false } as const;
      });

      const change = selectedPayment === 'cash' ? Math.max(0, (parseFloat(cashReceived || '0') - selected.total)) : 0;
      if (result?.alreadyPaid) {
        toast({ title: "Déjà encaissée", description: "Cette commande a déjà été payée." });
      } else {
        toast({ title: "Paiement enregistré", description: `Commande encaissée (${selected.total.toLocaleString()} XAF)${change>0?` • Rendu: ${change.toLocaleString()} XAF`:''}` });
      }

      setSelectedPayment(null);
      setCashReceived("");
      setSelectedOrderId(null);
    } catch (e: any) {
      // Fallback offline: enqueue pay_order
      if (resolvedOwnerUid && selectedOrderId) {
        enqueue({ type: 'pay_order', payload: {
          ownerUid: resolvedOwnerUid,
          orderId: selectedOrderId,
          total: selected.total,
          items: selected.items,
          paymentMethod: selectedPayment,
          agentCode: selected.serveur || "",
        }});
        toast({ title: "Hors-ligne", description: "Paiement enregistré localement. Il sera synchronisé à la reconnexion." });
        setSelectedPayment(null);
        setCashReceived("");
        setSelectedOrderId(null);
        return;
      }
      toast({ title: "Erreur caisse", description: e?.message ?? "", variant: "destructive" });
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-nack-beige-light to-white flex items-center justify-center">
        <Card className="w-full max-w-md shadow-elegant border-0">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <Calculator className="text-white" size={28} />
            </div>
            <CardTitle>Interface Caisse</CardTitle>
            <CardDescription>
              Veuillez saisir votre numéro d'agent pour accéder à la caisse
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="agentCode">Numéro d'agent</Label>
              <Input
                id="agentCode"
                value={agentCodeInput}
                onChange={(e) => setAgentCodeInput(e.target.value)}
                placeholder="AGT-XXXXXX"
                className="text-center font-mono"
              />
            </div>
            <Button 
              onClick={handleAgentLogin}
              className="w-full bg-gradient-primary text-white shadow-button h-12"
            >
              Se connecter
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Code attendu: {agentCode}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pendingOrders = orders.filter(order => order.status === 'sent');
  const totalDaily = salesToday.total;
  const selectedOrder = selectedOrderId ? orders.find(o => o.id === selectedOrderId) : null;
  const change = selectedPayment === 'cash' && selectedOrder ? Math.max(0, (parseFloat(cashReceived || '0') - selectedOrder.total)) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-nack-beige-light to-white">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center">
                <Calculator className="text-white" size={20} />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Interface Caisse</h1>
                <p className="text-sm text-muted-foreground">Code: {agentCode}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total journalier</p>
                <p className="font-semibold text-green-600">{totalDaily.toLocaleString()} XAF</p>
              </div>
              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                <LogOut size={16} className="mr-2" />
                Déconnexion
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Orders from Servers */}
          <div className="lg:col-span-2">
            <Card className="shadow-card border-0">
              <CardHeader>
                <CardTitle>Commandes à encaisser</CardTitle>
                <CardDescription>Commandes envoyées par les serveurs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingOrders.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">Aucune commande à encaisser</p>
                ) : pendingOrders.map(o => (
                  <div key={o.id} className={`flex items-center justify-between p-3 border rounded-lg ${selectedOrderId===o.id?'bg-nack-beige-light':''}`}>
                    <div>
                      <p className="font-medium text-sm">Table {o.tableNumber || '—'}</p>
                      <p className="text-xs text-muted-foreground">Agent: {o.serveur} • {o.items.length} article(s)</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{o.total.toLocaleString()} XAF</p>
                      <Button variant={selectedOrderId===o.id? 'default':'outline'} size="sm" className="mt-2" onClick={() => setSelectedOrderId(o.id)}>
                        {selectedOrderId===o.id? 'Sélectionnée':'Sélectionner'}
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Payment Panel */}
          <div className="space-y-6">
            <Card className="shadow-card border-0">
              <CardHeader>
                <CardTitle>Paiement</CardTitle>
                <CardDescription>Sélectionnez une commande et validez le paiement</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Commande sélectionnée</Label>
                  <div className="p-3 border rounded-lg mt-1 text-sm">
                    {selectedOrderId ? (
                      (() => { const sel = orders.find(o=>o.id===selectedOrderId)!; return (
                        <div className="flex items-center justify-between">
                          <span>Table {sel.tableNumber || '—'} • {sel.items.length} article(s)</span>
                          <span className="font-semibold">{sel.total.toLocaleString()} XAF</span>
                        </div>
                      ); })()
                    ) : (
                      <span className="text-muted-foreground">Aucune</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    variant={selectedPayment === 'card' ? 'default' : 'outline'}
                    onClick={() => setSelectedPayment('card')}
                    className={`h-20 flex flex-col gap-2 ${
                      selectedPayment === 'card' 
                        ? 'bg-gradient-primary text-white' 
                        : 'border-2 hover:border-nack-red'
                    }`}
                  >
                    <CreditCard size={24} />
                    <span>Carte</span>
                  </Button>
                  <Button
                    variant={selectedPayment === 'cash' ? 'default' : 'outline'}
                    onClick={() => setSelectedPayment('cash')}
                    className={`h-20 flex flex-col gap-2 ${
                      selectedPayment === 'cash' 
                        ? 'bg-gradient-primary text-white' 
                        : 'border-2 hover:border-nack-red'
                    }`}
                  >
                    <Banknote size={24} />
                    <span>Espèces</span>
                  </Button>
                </div>

                {selectedPayment === 'cash' && (
                  <div className="space-y-2">
                    <Label htmlFor="cashReceived">Montant reçu (XAF)</Label>
                    <Input
                      id="cashReceived"
                      type="number"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      placeholder="Montant en XAF"
                    />
                    {selectedOrder && (
                      <p className="text-sm text-muted-foreground">
                        À rendre: <span className="font-semibold">{change.toLocaleString()} XAF</span>
                      </p>
                    )}
                  </div>
                )}

                <Button onClick={handlePayment} className="w-full bg-gradient-primary text-white h-12">
                  Valider le paiement
                </Button>
              </CardContent>
            </Card>

            {/* Quick Stats & Historique ventes */}
            <Card className="shadow-card border-0">
              <CardHeader>
                <CardTitle>Historique des ventes (aujourd'hui)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[220px] overflow-y-auto">
                  {salesToday.list.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between text-sm border rounded p-2">
                      <span>{(s.source || 'vente').toString()}</span>
                      <span className="font-semibold">{Number(s.total ?? 0).toLocaleString()} XAF</span>
                    </div>
                  ))}
                  {salesToday.list.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">Aucune vente pour l'instant</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

const CaisseInterface = () => {
  return (
    <OrderProvider>
      <CaisseInterfaceContent />
    </OrderProvider>
  );
};

export default CaisseInterface;