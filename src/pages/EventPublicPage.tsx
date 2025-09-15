import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import NackLogo from "@/components/NackLogo";
import EventPopup from "@/components/EventPopup";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

interface EventDoc {
  id: string;
  ownerUid?: string;
  title: string;
  description?: string;
  date: string;
  time: string;
  location?: string;
  maxCapacity: number;
  ticketPrice: number;
  currency: string;
  imageUrl?: string;
  isActive: boolean;
  ticketsSold: number;
  whatsappNumber?: string;
}

const EventPublicPage = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { toast } = useToast();
  const [event, setEvent] = useState<EventDoc | null>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
        if (!eventId) { setLoading(false); return; }
    const unsub = onSnapshot(
      doc(db, "events", eventId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as any;
          setEvent({
            id: snap.id,
            ownerUid: data.ownerUid,
            title: data.title,
            description: data.description || "",
            date: data.date,
            time: data.time,
            location: data.location || "",
            maxCapacity: Number(data.maxCapacity ?? 0),
            ticketPrice: Number(data.ticketPrice ?? 0),
            currency: data.currency || "XAF",
            imageUrl: data.imageUrl || "",
            isActive: !!data.isActive,
            ticketsSold: Number(data.ticketsSold ?? 0),
            whatsappNumber: data.whatsappNumber || "",
          });
          setIsPopupOpen(true);
        }
        setLoading(false);
      },
      (e) => {
        toast({ title: "Erreur", description: e?.message ?? "", variant: "destructive" });
        setLoading(false);
      }
    );
    return () => unsub();
  }, [eventId, toast]);

  const handleClosePopup = () => {
    window.history.back();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center p-4">
        <div className="text-center">
          <NackLogo size="lg" />
          <p className="mt-4 text-muted-foreground animate-pulse">Chargement de l'événement...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center p-4">
        <div className="text-center max-w-md mx-auto">
          <NackLogo size="lg" />
          <h1 className="text-2xl font-bold mb-4 mt-6">Événement introuvable</h1>
          <p className="text-muted-foreground">Cet événement n'existe pas ou n'est plus disponible.</p>
        </div>
      </div>
    );
  }

  const availableTickets = event.maxCapacity - event.ticketsSold;
  const isEventPassed = new Date(event.date) < new Date();
  const isSoldOut = availableTickets <= 0;

  const handleBuyTickets = () => {
    setIsPopupOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      {!isPopupOpen && (
        <>
          <div className="container mx-auto px-4 py-6">
            <div className="flex justify-center mb-8">
              <NackLogo size="lg" />
            </div>
            <div className="max-w-4xl mx-auto">
              <div className="bg-card rounded-3xl shadow-elegant overflow-hidden border border-border/50">
                {event.imageUrl && (
                  <div className="relative h-64 md:h-80 overflow-hidden">
                    <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover rounded-none border-0" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute top-4 right-4">
                      {isEventPassed ? (
                        <div className="bg-muted text-muted-foreground px-3 py-1 rounded-full text-sm font-medium">Événement passé</div>
                      ) : isSoldOut ? (
                        <div className="bg-destructive text-destructive-foreground px-3 py-1 rounded-full text-sm font-medium">Complet</div>
                      ) : (
                        <div className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium">Billets disponibles</div>
                      )}
                    </div>
                    <div className="absolute bottom-4 left-4 right-4">
                      <h1 className="text-2xl md:text-4xl font-bold text-white mb-2">{event.title}</h1>
                    </div>
                  </div>
                )}
                <div className="p-6 md:p-8">
                  <div className="grid md:grid-cols-2 gap-6 mb-8">
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-lg font-semibold mb-3 text-primary">Description</h2>
                        <p className="text-muted-foreground leading-relaxed">{event.description}</p>
                      </div>
                      <div>
                        <h3 className="font-semibold mb-2 text-primary">Informations importantes</h3>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          <li>• Présentation d'une pièce d'identité requise</li>
                          <li>• Billet non remboursable</li>
                          <li>• Ouverture des portes 30 minutes avant l'événement</li>
                        </ul>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="bg-muted/50 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-3"><div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">📅</div><div><p className="font-medium">Date</p><p className="text-muted-foreground">{new Date(event.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p></div></div>
                        <div className="flex items-center gap-3"><div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">🕒</div><div><p className="font-medium">Heure</p><p className="text-muted-foreground">{event.time}</p></div></div>
                        <div className="flex items-center gap-3"><div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">📍</div><div><p className="font-medium">Lieu</p><p className="text-muted-foreground">{event.location}</p></div></div>
                        <div className="flex items-center gap-3"><div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">🎫</div><div><p className="font-medium">Disponibilité</p><p className="text-muted-foreground">{event.maxCapacity - event.ticketsSold} / {event.maxCapacity} places disponibles</p></div></div>
                      </div>
                      <div className="bg-gradient-primary rounded-2xl p-6 text-center">
                        <div className="text-white mb-4"><p className="text-lg font-semibold">Prix du billet</p><p className="text-3xl font-bold">{event.ticketPrice.toLocaleString()} {event.currency}</p></div>
                        {isEventPassed ? (
                          <div className="bg.white/20 text-white px-6 py-3 rounded-xl font-medium">Événement terminé</div>
                        ) : isSoldOut ? (
                          <div className="bg.white/20 text.white px-6 py-3 rounded-xl font-medium">Billets épuisés</div>
                        ) : (
                          <button onClick={handleBuyTickets} className="w-full bg-white text-primary hover:bg-white/90 px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:shadow-lg hover:scale-105">Acheter des billets</button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {event && (
        <EventPopup event={event as any} isOpen={isPopupOpen} onClose={handleClosePopup} />
      )}
    </div>
  );
};

export default EventPublicPage;