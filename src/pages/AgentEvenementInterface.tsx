import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import NackLogo from "@/components/NackLogo";
import { 
  QrCode, 
  CheckCircle, 
  XCircle, 
  Clock, 
  BarChart3,
  Calendar,
  Camera,
  StopCircle,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { Html5Qrcode } from "html5-qrcode";

interface ScannedTicket {
  id: string;
  eventTitle: string;
  ticketId: string;
  customerName: string;
  scannedAt: Date;
  status: "valid" | "invalid" | "already-used";
}

interface EventSummary {
  id: string;
  title: string;
  date: string;
  time: string;
  maxCapacity: number;
}

const AgentEvenementInterface = () => {
  const { agentCode } = useParams<{ agentCode: string }>();
  const { toast } = useToast();

  const [isScanning, setIsScanning] = useState(false);
  const [scannedTickets, setScannedTickets] = useState<ScannedTicket[]>([]);

  const [resolvedOwnerUid, setResolvedOwnerUid] = useState<string | null>(null);
  const [assignedEventId, setAssignedEventId] = useState<string | null>(null);
  const [currentEvent, setCurrentEvent] = useState<EventSummary | null>(null);

  const readerElemId = useRef<string>(`agent-qr-reader`);
  const html5Ref = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [manualCode, setManualCode] = useState("");

  useEffect(() => {
    if (!agentCode) return;
    const ref = doc(db, "agentLinks", agentCode);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Record<string, unknown>;
        const ownerUid = typeof data.ownerUid === 'string' ? data.ownerUid : null;
        const eventId = (typeof data.assignedEventId === 'string' ? data.assignedEventId : '').trim();
        setResolvedOwnerUid(ownerUid);
        setAssignedEventId(eventId || null);
      } else {
        setResolvedOwnerUid(null);
        setAssignedEventId(null);
      }
    });
    return () => unsub();
  }, [agentCode]);

  useEffect(() => {
    if (!resolvedOwnerUid || !assignedEventId) {
      setCurrentEvent(null);
      return;
    }
    const ref = doc(db, "events", assignedEventId);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Record<string, unknown>;
        const title = typeof data.title === 'string' ? data.title : (typeof data.name === 'string' ? data.name : snap.id);
        const date = typeof data.date === 'string' ? data.date : '';
        const time = typeof data.time === 'string' ? data.time : '';
        const maxCapacity = typeof data.maxCapacity === 'number' ? data.maxCapacity : Number(data.maxCapacity ?? 0);
        setCurrentEvent({ id: snap.id, title, date, time, maxCapacity });
      } else {
        setCurrentEvent(null);
      }
    });
    return () => unsub();
  }, [resolvedOwnerUid, assignedEventId]);

  const totalTickets = useMemo(() => currentEvent?.maxCapacity ?? 0, [currentEvent]);

  const requestCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      stream.getTracks().forEach(t => t.stop());
      return true;
    } catch (e) {
      return false;
    }
  };

  const startScanner = async () => {
    if (isScanning) return;
    if (!currentEvent?.id) {
      toast({ title: "Aucun événement assigné", description: "Le gérant doit assigner un événement à cet agent.", variant: "destructive" });
      return;
    }
    // iOS PWA souvent bloquée: recommander Safari
    // @ts-ignore
    if (typeof navigator !== 'undefined' && navigator.standalone) {
      toast({ title: "Ouvrir dans Safari", description: "Sur iPhone, ouvrez ce lien dans Safari (pas en app installée).", variant: "destructive" });
    }
    if (!window.isSecureContext && !location.hostname.includes('localhost')) {
      toast({ title: "HTTPS recommandé", description: "Si la caméra échoue, utilisez https://nack.netlify.app.", variant: "destructive" });
    }
    const granted = await requestCameraPermission();
    if (!granted) {
      toast({ title: "Permission requise", description: "Autorisez l'accès caméra dans Safari (aA → Caméra → Autoriser)", variant: "destructive" });
      return;
    }
    try {
      setIsScanning(true);
      window.setTimeout(async () => {
        try {
          const elem = document.getElementById(readerElemId.current);
          if (!elem) return;
          if (!html5Ref.current) {
            html5Ref.current = new Html5Qrcode(readerElemId.current);
          }
          const onSuccess = async (decodedText: string) => {
            await handleDecodedText(decodedText);
            await stopScanner();
          };
          try {
            await html5Ref.current.start(
              { facingMode: { exact: "environment" } } as MediaTrackConstraints,
              { fps: 10, qrbox: 250 },
              onSuccess,
              () => {}
            );
          } catch {
            await html5Ref.current.start(
              { facingMode: "environment" } as MediaTrackConstraints,
              { fps: 10, qrbox: 250 },
              onSuccess,
              () => {}
            );
          }
        } catch {
          toast({ title: "Caméra", description: "Impossible d'ouvrir la caméra. Utilisez le scan par photo.", variant: "destructive" });
          setIsScanning(false);
        }
      }, 0);
    } catch {
      toast({ title: "Caméra", description: "Impossible d'ouvrir la caméra. Utilisez le scan par photo.", variant: "destructive" });
    }
  };

  const stopScanner = async () => {
    try {
      if (html5Ref.current) {
        await html5Ref.current.stop().catch(() => {});
        await html5Ref.current.clear().catch(() => {});
      }
    } finally {
      setIsScanning(false);
    }
  };

  const triggerPhotoScan = () => fileInputRef.current?.click();

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (!html5Ref.current) html5Ref.current = new Html5Qrcode(readerElemId.current);
      const result = await html5Ref.current.scanFileV2(file, true);
      if (result) {
        await handleDecodedText(result.decodedText);
      } else {
        toast({ title: "QR non reconnu", description: "Réessayez en cadrant mieux le QR.", variant: "destructive" });
      }
    } catch {
      toast({ title: "QR non reconnu", description: "Réessayez en cadrant mieux le QR.", variant: "destructive" });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDecodedText = async (text: string) => {
    let payload: unknown = null;
    try { payload = JSON.parse(text); } catch {
      recordScan("", "Inconnu", "invalid");
      toast({ title: "Billet invalide", description: "QR non reconnu", variant: "destructive" });
      return;
    }
    const ticketId = (payload as Record<string, unknown>)?.t;
    const eventId = (payload as Record<string, unknown>)?.e;
    if (!ticketId || !eventId || typeof ticketId !== "string" || typeof eventId !== "string") {
      recordScan("", "Inconnu", "invalid");
      toast({ title: "Billet invalide", description: "Données manquantes dans le QR", variant: "destructive" });
      return;
    }
    if (!currentEvent?.id) {
      recordScan(ticketId, "Inconnu", "invalid");
      toast({ title: "Aucun événement assigné", description: "Le gérant doit assigner un événement à cet agent.", variant: "destructive" });
      return;
    }
    if (eventId !== currentEvent.id) {
      recordScan(ticketId, "Inconnu", "invalid");
      toast({ title: "Billet pour un autre événement", description: "Ce billet n'appartient pas à l'événement assigné", variant: "destructive" });
      return;
    }
    try {
      const status = await runTransaction(db, async (tx) => {
        const tRef = doc(db, "tickets", ticketId);
        const tSnap = await tx.get(tRef);
        if (!tSnap.exists()) return { state: "invalid" as const, ticket: null };
        const t = tSnap.data() as Record<string, unknown>;
        if (t.eventId !== currentEvent.id) return { state: "invalid" as const, ticket: null };
        if (t.checkedIn) return { state: "already-used" as const, ticket: t };
        tx.update(tRef, { checkedIn: true, checkedInAt: serverTimestamp(), checkedInBy: agentCode || null });
        return { state: "valid" as const, ticket: t };
      });
      if (status.state === "invalid") {
        recordScan(ticketId, "Inconnu", "invalid");
        toast({ title: "Billet invalide", description: `Le billet ${ticketId} est invalide`, variant: "destructive" });
      } else if (status.state === "already-used") {
        const name = (status.ticket?.customerName as string | undefined) || "Client";
        recordScan(ticketId, name, "already-used");
        toast({ title: "Billet déjà utilisé", description: `Le billet ${ticketId} a déjà été validé`, variant: "destructive" });
      } else {
        const name = (status.ticket?.customerName as string | undefined) || "Client";
        recordScan(ticketId, name, "valid");
        toast({ title: "Billet validé", description: `Billet ${ticketId} validé avec succès` });
      }
    } catch {
      recordScan(ticketId, "Inconnu", "invalid");
      toast({ title: "Erreur", description: "Erreur de validation", variant: "destructive" });
    }
  };

  const recordScan = (ticketId: string, customerName: string, status: ScannedTicket["status"]) => {
    const entry: ScannedTicket = { id: Date.now().toString(), eventTitle: currentEvent?.title || "", ticketId, customerName, scannedAt: new Date(), status };
    setScannedTickets((prev) => [entry, ...prev.slice(0, 19)]);
  };

  const handleManualValidate = async () => {
    const text = manualCode.trim();
    if (!text) return;
    if (text.startsWith("{")) {
      await handleDecodedText(text);
      setManualCode("");
      return;
    }
    if (!currentEvent?.id) {
      toast({ title: "Aucun événement", description: "Assignez un événement à l'agent.", variant: "destructive" });
      return;
    }
    const payload = JSON.stringify({ t: text, e: currentEvent.id });
    await handleDecodedText(payload);
    setManualCode("");
  };

  const scanDisabled = !assignedEventId;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <NackLogo size="md" />
          <div className="mt-4">
            <h1 className="text-2xl font-bold text-foreground">Interface Agent Événement</h1>
            <p className="text-muted-foreground">Code Agent: {agentCode}</p>
          </div>
        </div>

        <Card className="shadow-elegant border-0">
          <CardHeader className="bg-gradient-primary text-white rounded-t-lg">
            <CardTitle className="flex items-center gap-2">
              <Calendar size={20} />
              {currentEvent ? currentEvent.title : "Aucun événement assigné"}
            </CardTitle>
            <CardDescription className="text-white/80">
              {currentEvent ? (<>{currentEvent.date} - {currentEvent.time}</>) : ("—")}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{totalTickets}</div>
                <p className="text-muted-foreground text-sm">Billets totaux</p>
              </div>
            </div>
            {!assignedEventId && (
              <p className="text-sm text-yellow-600 mt-3">Aucun événement n'est assigné à cet agent. Demandez au gérant de l'assigner dans la page Équipe.</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-elegant border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><QrCode size={20} />Scanner QR Code</CardTitle>
            <CardDescription>Scannez le QR des billets pour les valider</CardDescription>
          </CardHeader>
          <CardContent className="text-center py-8">
            <div className="space-y-6">
              <div className="relative mx-auto w-72 h-72 border-4 border-dashed border-primary/30 rounded-lg flex items-center justify-center bg-muted/30 overflow-hidden">
                <div id={readerElemId.current} className="w-full h-full" style={{ display: isScanning ? 'block' : 'none' }} />
                {!isScanning && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-muted-foreground p-4">
                    <QrCode size={48} className="mx-auto mb-4 opacity-50" />
                    <p>Pointez votre caméra vers le QR code</p>
                    <p className="text-xs mt-2">Si la caméra ne s'affiche pas: autorisez la caméra dans Safari, utilisez HTTPS, ou scannez par photo.</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center gap-3 flex-wrap">
                {!isScanning ? (
                  <>
                    <Button onClick={startScanner} className="bg-gradient-primary text-white px-6 py-3" size="sm" disabled={scanDisabled}>
                      <Camera size={18} className="mr-2" /> Démarrer le scan
                    </Button>
                    <Button onClick={() => triggerPhotoScan()} variant="outline" size="sm">Scanner par photo</Button>
                    <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoSelected} />
                  </>
                ) : (
                  <Button onClick={stopScanner} variant="destructive" className="px-6 py-3" size="sm">
                    <StopCircle size={18} className="mr-2" /> Arrêter
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 max-w-md mx-auto">
                <input
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder='Saisir le code billet ou coller le JSON {"t":"...","e":"..."}'
                  className="border rounded h-10 px-3 w-full"
                />
                <Button onClick={handleManualValidate} variant="outline">Valider</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-elegant border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart3 size={20} />Historique des validations</CardTitle>
            <CardDescription>Derniers billets scannés</CardDescription>
          </CardHeader>
          <CardContent>
            {scannedTickets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <QrCode size={48} className="mx-auto mb-4 opacity-50" />
                <p>Aucun billet scanné pour le moment</p>
                <p className="text-sm">Commencez à scanner des QR codes pour voir l'historique</p>
              </div>
            ) : (
              <div className="space-y-3">
                {scannedTickets.map((ticket) => (
                  <div key={ticket.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                    <div className="flex items-center gap-3">
                      {ticket.status === "valid" ? (<CheckCircle size={20} className="text-green-600" />) : ticket.status === "already-used" ? (<Clock size={20} className="text-yellow-600" />) : (<XCircle size={20} className="text-red-600" />)}
                      <div>
                        <p className="font-medium">{ticket.ticketId}</p>
                        <p className="text-sm text-muted-foreground">{ticket.customerName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={ticket.status === "valid" ? "default" : ticket.status === "already-used" ? "secondary" : "destructive"}>
                        {ticket.status === "valid" ? "Valide" : ticket.status === "already-used" ? "Déjà utilisé" : "Invalide"}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">{ticket.scannedAt.toLocaleTimeString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AgentEvenementInterface;