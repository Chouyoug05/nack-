import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Calendar, 
  Plus, 
  MapPin, 
  Clock, 
  Users, 
  Ticket,
  Trash2,
  ExternalLink,
  Copy
} from "lucide-react";
import { db, storage } from "@/lib/firebase";
import { addDoc, collection, deleteDoc, doc, increment, onSnapshot, query, serverTimestamp, updateDoc, where, doc as docRefFS, getDoc as getDocFS } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useAuth } from "@/contexts/AuthContext";
import { generateEventTicket } from "@/utils/ticketGenerator";
import { startSingPayPayment } from "@/lib/payments";
import { getBillingForUser, decrementEventCredit } from "@/lib/billing";

// Cloudinary env (fallback)
const CLOUDINARY_CLOUD = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined) || "dyy51hdjd";
const CLOUDINARY_PRESET = (import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined) || "nackga";

const BASE = import.meta.env.BASE_URL || "/";
const absoluteUrl = (path: string) => {
  const base = BASE.endsWith("/") ? BASE.slice(0, -1) : BASE;
  return `${window.location.origin}${base}${path.startsWith("/") ? path : `/${path}`}`;
};

async function uploadEventImage(file: File, ownerUid: string): Promise<string> {
  if (CLOUDINARY_CLOUD && CLOUDINARY_PRESET) {
    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", CLOUDINARY_PRESET);
    form.append("folder", `events/${ownerUid}`);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/upload`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) throw new Error("Cloudinary upload failed");
    const data = await res.json();
    return (data as { secure_url?: string; url?: string }).secure_url || (data as { url?: string }).url || "";
  }
  // Fallback Firebase Storage
  const fileRef = ref(storage, `events/${ownerUid}/${Date.now()}_${file.name}`);
  const uploadSnap = await uploadBytes(fileRef, file);
  return await getDownloadURL(uploadSnap.ref);
}

interface EventDoc {
  id: string;
  title: string;
  description?: string;
  date: string; // ISO date
  time: string; // HH:mm
  location?: string;
  maxCapacity: number;
  ticketPrice: number;
  currency: string;
  imageUrl?: string;
  isActive: boolean;
  ticketsSold: number;
  shareableLink: string;
  whatsappNumber?: string;
}

interface TicketDoc {
  id?: string;
  ownerUid: string;
  eventId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  quantity: number;
  totalAmount: number;
  currency: string;
  status: "reserved" | "paid" | "cancelled";
  createdAt: unknown;
  checkedIn?: boolean;
}

const EventsPage = () => {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [events, setEvents] = useState<EventDoc[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [participantsOpenFor, setParticipantsOpenFor] = useState<string | null>(null);
  const [participants, setParticipants] = useState<TicketDoc[]>([]);

  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
    location: "",
    maxCapacity: "",
    ticketPrice: "",
    currency: "XAF",
    imageUrl: "",
    whatsappNumber: ""
  });

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, "events"),
      where("ownerUid", "==", currentUser.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: EventDoc[] = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        const safeLink = typeof data.shareableLink === 'string' && data.shareableLink.includes(window.location.origin)
          ? data.shareableLink
          : absoluteUrl(`/event/${d.id}`);
        return {
          id: d.id,
          title: String((data as Record<string, unknown>).title ?? ''),
          description: String((data as Record<string, unknown>).description ?? ''),
          date: String((data as Record<string, unknown>).date ?? ''),
          time: String((data as Record<string, unknown>).time ?? ''),
          location: String((data as Record<string, unknown>).location ?? ''),
          maxCapacity: Number((data as Record<string, unknown>).maxCapacity ?? 0),
          ticketPrice: Number((data as Record<string, unknown>).ticketPrice ?? 0),
          currency: String((data as Record<string, unknown>).currency ?? 'XAF'),
          imageUrl: typeof (data as Record<string, unknown>).imageUrl === 'string' ? (data as Record<string, unknown>).imageUrl as string : '',
          isActive: Boolean((data as Record<string, unknown>).isActive),
          ticketsSold: Number((data as Record<string, unknown>).ticketsSold ?? 0),
          shareableLink: safeLink,
          whatsappNumber: typeof (data as Record<string, unknown>).whatsappNumber === 'string' ? (data as Record<string, unknown>).whatsappNumber as string : '',
        };
      });
      setEvents(list);
    });
    return () => unsub();
  }, [currentUser]);

  useEffect(() => {
    if (!participantsOpenFor || !currentUser) return;
    const unsub = onSnapshot(
      query(collection(db, "tickets"), where("eventId", "==", participantsOpenFor)),
      (snap) => {
        const list: TicketDoc[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as TicketDoc[];
        setParticipants(list);
      }
    );
    return () => unsub();
  }, [participantsOpenFor, currentUser]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImagePreview(String(ev.target?.result || ''));
      };
      reader.readAsDataURL(file);
    }
  };

  const createPaidTicketAndPdf = async (ev: EventDoc) => {
    if (!currentUser) return;
    // 1) créer le ticket payé
    const ticket: Omit<TicketDoc, "id" | "createdAt"> = {
      ownerUid: currentUser.uid,
      eventId: ev.id,
      customerName: "Vente guichet",
      customerEmail: "",
      customerPhone: "",
      quantity: 1,
      totalAmount: Number(ev.ticketPrice) || 0,
      currency: ev.currency,
      status: "paid",
      checkedIn: false,
    };
    const refDoc = await addDoc(collection(db, "tickets"), { ...ticket, createdAt: serverTimestamp() });
    const qrPayload = JSON.stringify({ t: refDoc.id, e: ev.id });

    // Récupérer infos établissement pour footer
    let establishmentName: string | undefined;
    let establishmentPhone: string | undefined = ev.whatsappNumber || undefined;
    try {
      const userSnap = await getDocFS(docRefFS(db, "users", currentUser.uid));
      const userData = userSnap.exists() ? (userSnap.data() as Record<string, unknown>) : undefined;
      const estId = userData && typeof userData.establishmentId === 'string' ? userData.establishmentId : undefined;
      if (estId) {
        const estSnap = await getDocFS(docRefFS(db, "establishments", estId));
        if (estSnap.exists()) {
          const d = estSnap.data() as Record<string, unknown>;
          establishmentName = typeof d.name === 'string' ? d.name : undefined;
          establishmentPhone = typeof d.phone === 'string' ? d.phone : establishmentPhone;
        }
      }
    } catch (err) {
      // ignore meta-infos errors
    }

    // 2) générer PDF
    await generateEventTicket({
      id: refDoc.id,
      eventTitle: ev.title,
      eventDate: ev.date,
      eventTime: ev.time,
      eventLocation: ev.location || "",
      customerName: ticket.customerName,
      customerEmail: ticket.customerEmail,
      customerPhone: ticket.customerPhone,
      quantity: ticket.quantity,
      totalAmount: ticket.totalAmount,
      currency: ticket.currency,
      qrCode: qrPayload,
      brandName: "NACK!",
      establishmentName,
      establishmentPhone,
    });
  };

  const handleManualSale = async (ev: EventDoc) => {
    if (!currentUser) return;
    try {
      if (ev.ticketsSold >= ev.maxCapacity) {
        toast({ title: "Complet", description: "Plus de places disponibles", variant: "destructive" });
        return;
      }
      await updateDoc(doc(db, "events", ev.id), {
        ticketsSold: increment(1),
        updatedAt: serverTimestamp(),
      });
      await addDoc(collection(db, "sales"), {
        ownerUid: currentUser.uid,
        total: Number(ev.ticketPrice) || 0,
        items: [
          { id: ev.id, name: ev.title, price: Number(ev.ticketPrice) || 0, quantity: 1, isEvent: true }
        ],
        eventId: ev.id,
        source: "manual",
        createdAt: serverTimestamp(),
      });
      // créer ticket et PDF
      await createPaidTicketAndPdf(ev);
      toast({ title: "Vente enregistrée", description: "+1 billet confirmé" });
    } catch (e: unknown) {
      const message = e && typeof e === 'object' && 'message' in e ? String((e as { message?: unknown }).message ?? '') : '';
      toast({ title: "Erreur", description: message, variant: "destructive" });
    }
  };

  const handleCreateEvent = async () => {
    if (!currentUser) {
      toast({ title: "Authentification requise", description: "Connectez-vous pour créer un évènement", variant: "destructive" });
      return;
    }
    if (!newEvent.title || !newEvent.date || !newEvent.time || !newEvent.ticketPrice) {
      toast({ title: "Erreur", description: "Veuillez remplir tous les champs obligatoires", variant: "destructive" });
      return;
    }
    try {
      setIsCreating(true);

      // 0) Vérifier crédit événement
      const billing = await getBillingForUser(currentUser.uid);
      if ((billing.eventCredits || 0) <= 0) {
        // rediriger vers paiement
        localStorage.setItem('nack_last_payment_ref', "Création d'événement");
        const link = await startSingPayPayment({ amount: 2000, reference: "Création d'événement" });
        window.location.href = link;
        setIsCreating(false);
        return;
      }

      // 1) Consommer un crédit
      await decrementEventCredit(currentUser.uid);

      // 2) Créer l'événement immédiatement (sans bloquer sur l'upload)
      const initialImage = newEvent.imageUrl || "";
      const docRef = await addDoc(collection(db, "events"), {
        ownerUid: currentUser.uid,
        title: newEvent.title,
        description: newEvent.description || "",
        date: newEvent.date,
        time: newEvent.time,
        location: newEvent.location || "Restaurant NACK",
        maxCapacity: Number(newEvent.maxCapacity) || 50,
        ticketPrice: Number(newEvent.ticketPrice),
        currency: newEvent.currency || "XAF",
        imageUrl: initialImage,
        whatsappNumber: (newEvent.whatsappNumber || "").trim(),
        isActive: true,
        ticketsSold: 0,
        shareableLink: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const link = absoluteUrl(`/event/${docRef.id}`);
      await updateDoc(doc(db, "events", docRef.id), { shareableLink: link, updatedAt: serverTimestamp() });

      // 3) Upload image en arrière-plan (Cloudinary/Storage)
      if (selectedImage) {
        (async () => {
          try {
            const uploadedUrl = await uploadEventImage(selectedImage, currentUser.uid);
            await updateDoc(doc(db, "events", docRef.id), { imageUrl: uploadedUrl, updatedAt: serverTimestamp() });
          } catch (err: unknown) {
            const message = err && typeof err === 'object' && 'message' in err ? String((err as { message?: unknown }).message ?? '') : '';
            toast({ title: "Image non téléchargée", description: message || "Cloudinary/Storage indisponible. L'événement a été créé sans image.", variant: "destructive" });
          }
        })();
      }

      toast({ title: "Événement créé", description: `Crédit utilisé. 2 agents évènement inclus sur votre premier achat d'événement.` });
    } catch (e: unknown) {
      setIsCreating(false);
      const message = e && typeof e === 'object' && 'message' in e ? String((e as { message?: unknown }).message ?? '') : '';
      toast({ title: "Erreur", description: message, variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const safeLinkFor = (ev: EventDoc) => ev.shareableLink && ev.shareableLink.includes(window.location.origin)
    ? ev.shareableLink
    : absoluteUrl(`/event/${ev.id}`);

  const handleCopyLink = (link: string, ev?: EventDoc) => {
    const url = ev ? safeLinkFor(ev) : (link || absoluteUrl("/"));
    navigator.clipboard.writeText(url);
    toast({ title: "Lien copié", description: "Lien de partage copié" });
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      await deleteDoc(doc(db, "events", id));
      toast({ title: "Événement supprimé", description: "L'événement a été supprimé" });
    } catch (e: unknown) {
      const message = e && typeof e === 'object' && 'message' in e ? String((e as { message?: unknown }).message ?? '') : '';
      toast({ title: "Erreur", description: message, variant: "destructive" });
    }
  };

  const totalRevenue = events.reduce((total, event) => total + (event.ticketsSold * event.ticketPrice), 0);

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="shadow-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Événements</p>
                <p className="text-2xl font-bold">{events.length}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-secondary rounded-lg flex items-center justify-center">
                <Calendar size={24} className="text-nack-red" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Billets Vendus</p>
                <p className="text-2xl font-bold">{events.reduce((total, e) => total + e.ticketsSold, 0)}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-secondary rounded-lg flex items-center justify-center">
                <Ticket size={24} className="text-nack-red" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Revenus</p>
                <p className="text-2xl font-bold">{totalRevenue.toLocaleString()} XAF</p>
              </div>
              <div className="w-12 h-12 bg-gradient-secondary rounded-lg flex items-center justify-center">
                <Users size={24} className="text-nack-red" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Événements Actifs</p>
                <p className="text-2xl font-bold text-green-600">{events.filter(e => e.isActive).length}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Calendar size={24} className="text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card className="shadow-card border-0">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>Gestion des Événements</CardTitle>
              <CardDescription>Créez et gérez vos événements avec vente de billets</CardDescription>
            </div>
            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-primary text-white shadow-button hover:shadow-elegant">
                  <Plus className="mr-2" size={18} />
                  Créer un événement
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Créer un nouvel événement</DialogTitle>
                  <DialogDescription>
                    Remplissez les informations de votre événement
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="title">Titre de l'événement *</Label>
                    <Input id="title" value={newEvent.title} onChange={(e) => setNewEvent({...newEvent, title: e.target.value})} placeholder="Ex: Soirée Jazz" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" value={newEvent.description} onChange={(e) => setNewEvent({...newEvent, description: e.target.value})} placeholder="Décrivez votre événement..." rows={3} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="whatsappNumber">Numéro WhatsApp du gérant (avec indicatif, ex: 241XXXXXXXX)</Label>
                    <Input id="whatsappNumber" value={newEvent.whatsappNumber} onChange={(e) => setNewEvent({...newEvent, whatsappNumber: e.target.value})} placeholder="241XXXXXXXX" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="imageUpload">Image de l'événement</Label>
                    <div className="space-y-3">
                      <Input id="imageUpload" type="file" accept="image/*" onChange={handleImageUpload} className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gradient-secondary file:text-nack-red hover:file:bg-nack-red/10" />
                      {imagePreview && (
                        <div className="relative">
                          <img src={imagePreview} alt="Aperçu de l'événement" className="w-full h-32 object-cover rounded-lg border" />
                          <Button type="button" variant="destructive" size="sm" onClick={() => { setSelectedImage(null); setImagePreview(null); }} className="absolute top-2 right-2">×</Button>
                        </div>
                      )}
                      <div className="text-sm text-muted-foreground">Ou utilisez une URL d'image :</div>
                      <Input id="imageUrl" value={newEvent.imageUrl} onChange={(e) => setNewEvent({...newEvent, imageUrl: e.target.value})} placeholder="https://exemple.com/image-evenement.jpg" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date">Date *</Label>
                    <Input id="date" type="date" value={newEvent.date} onChange={(e) => setNewEvent({...newEvent, date: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time">Heure *</Label>
                    <Input id="time" type="time" value={newEvent.time} onChange={(e) => setNewEvent({...newEvent, time: e.target.value})} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="location">Lieu</Label>
                    <Input id="location" value={newEvent.location} onChange={(e) => setNewEvent({...newEvent, location: e.target.value})} placeholder="Restaurant NACK - Salle principale" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capacity">Capacité maximale</Label>
                    <Input id="capacity" type="number" value={newEvent.maxCapacity} onChange={(e) => setNewEvent({...newEvent, maxCapacity: e.target.value})} placeholder="50" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Prix du billet (XAF) *</Label>
                    <Input id="price" type="number" value={newEvent.ticketPrice} onChange={(e) => setNewEvent({...newEvent, ticketPrice: e.target.value})} placeholder="15000" />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsCreateModalOpen(false)} className="w-full sm:w-auto">Annuler</Button>
                  <Button onClick={handleCreateEvent} disabled={isCreating} className="bg-gradient-primary text-white w-full sm:w-auto">
                    {isCreating ? "Création..." : "Créer l'événement"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* Events List */}
          <div className="space-y-4">
            {events.map((event) => (
              <Card key={event.id} className="border-l-4 border-l-nack-red">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-semibold">{event.title}</h3>
                        <Badge variant={event.isActive ? "default" : "secondary"}>{event.isActive ? "Actif" : "Inactif"}</Badge>
                      </div>
                      <p className="text-muted-foreground mb-3">{event.description}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2"><Calendar size={16} className="text-nack-red" /><span>{new Date(event.date).toLocaleDateString('fr-FR')} à {event.time}</span></div>
                        <div className="flex items-center gap-2"><MapPin size={16} className="text-nack-red" /><span>{event.location}</span></div>
                        <div className="flex items-center gap-2"><Ticket size={16} className="text-nack-red" /><span>{event.ticketsSold}/{event.maxCapacity} billets</span></div>
                        <div className="flex items-center gap-2"><Users size={16} className="text-nack-red" /><span>{event.ticketPrice.toLocaleString()} {event.currency}</span></div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button onClick={() => handleManualSale(event)} className="bg-green-600 text-white" size="sm">Vente +1</Button>
                      <Button variant="outline" size="sm" onClick={() => setParticipantsOpenFor(event.id)} className="flex items-center gap-2"><Users size={16} />Participants</Button>
                      <Button variant="outline" size="sm" onClick={() => handleCopyLink(event.shareableLink, event)} className="flex items-center gap-2"><Copy size={16} />Copier le lien</Button>
                      <Button variant="outline" size="sm" onClick={() => window.open(safeLinkFor(event), '_blank')} className="flex items-center gap-2"><ExternalLink size={16} />Voir la page</Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteEvent(event.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 size={16} /></Button>
                    </div>
                  </div>
                  {event.imageUrl && (
                    <div className="mt-4">
                      <img src={event.imageUrl} alt={event.title} className="w-full max-h-64 object-cover rounded-lg border" />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {events.length === 0 && (
              <div className="text-center py-12">
                <Calendar size={48} className="mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Aucun événement</h3>
                <p className="text-muted-foreground mb-4">Commencez par créer votre premier événement avec vente de billets</p>
                <Button onClick={() => setIsCreateModalOpen(true)} className="bg-gradient-primary text-white"><Plus className="mr-2" size={18} />Créer un événement</Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Participants Dialog */}
      <Dialog open={!!participantsOpenFor} onOpenChange={(open) => !open && setParticipantsOpenFor(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Participants</DialogTitle>
            <DialogDescription>Liste des billets pour cet événement</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2">
            {participants.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium text-sm">{t.customerName || "Client"}</p>
                  <p className="text-xs text-muted-foreground">{t.customerEmail} {t.customerPhone && `• ${t.customerPhone}`}</p>
                </div>
                <div className="text-right text-sm">
                  <p>{t.quantity} billet(s) • {t.totalAmount?.toLocaleString?.() || t.totalAmount} {t.currency}</p>
                  <p className={`text-xs ${t.status === 'paid' ? 'text-green-600' : 'text-orange-600'}`}>{t.status}</p>
                </div>
              </div>
            ))}
            {participants.length === 0 && (
              <p className="text-center text-muted-foreground py-8">Aucun participant pour le moment</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventsPage;