import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import type { FieldValue } from "firebase/firestore";
import { enqueue } from "@/lib/offlineQueue";

interface EventLite {
  id: string;
  ownerUid?: string | null;
  title?: string;
  date?: string;
  time?: string;
  location?: string;
  ticketPrice?: number;
  currency?: string;
  whatsappNumber?: string;
}

interface TicketReserved {
  ownerUid: string | null;
  eventId: string;
  customerName: string;
  customerEmail: string;
  quantity: number;
  totalAmount: number;
  status: "reserved";
  createdAt: FieldValue;
}

interface EventPaymentDialogProps {
  event: EventLite;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: (ticket: Omit<TicketReserved, "createdAt"> & { createdAt?: FieldValue }) => void;
}

const EventPaymentDialog = ({ event, isOpen, onClose, onPaymentSuccess }: EventPaymentDialogProps) => {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [quantity, setQuantity] = useState(1);
  const total = (event?.ticketPrice ?? 0) * quantity;

  const buildWhatsappUrl = (to: string, text: string) => {
    const phone = to.replace(/\D/g, "");
    const msg = encodeURIComponent(text);
    return `https://wa.me/${phone}?text=${msg}`;
  };

  const handleConfirm = async () => {
    if (!event?.id) return;
    if (!name || !email || quantity <= 0) {
      toast({ title: "Champs requis", description: "Renseignez le nom, l'email et la quantité", variant: "destructive" });
      return;
    }
    const whatsapp = (event?.whatsappNumber || "").trim();
    if (!whatsapp) {
      toast({ title: "Numéro WhatsApp manquant", description: "Le gérant n'a pas défini de numéro WhatsApp pour recevoir les réservations.", variant: "destructive" });
      return;
    }
    const ticket: TicketReserved = {
      ownerUid: event?.ownerUid ?? null,
      eventId: event.id,
      customerName: name,
      customerEmail: email,
      quantity,
      totalAmount: total,
      status: "reserved",
      createdAt: serverTimestamp(),
    };
    try {
      await addDoc(collection(db, "tickets"), ticket);
    } catch (e: unknown) {
      // Offline: on enfile la réservation pour synchro ultérieure
      enqueue({ type: 'reserve_ticket', payload: {
        ownerUid: ticket.ownerUid,
        eventId: ticket.eventId,
        customerName: ticket.customerName,
        customerEmail: ticket.customerEmail,
        quantity: ticket.quantity,
        totalAmount: ticket.totalAmount,
        status: 'reserved'
      }});
      toast({ title: "Hors-ligne", description: "La réservation est enregistrée localement et sera synchronisée à la reconnexion." });
    }

    const message = `Nouvelle réservation\n\nÉvénement: ${event?.title}\nDate: ${event?.date} à ${event?.time}\nLieu: ${event?.location}\nClient: ${name} (${email})\nQuantité: ${quantity}\nTotal: ${total.toLocaleString()} ${event?.currency}\n\nMerci de confirmer et d'envoyer les instructions de paiement.`;
    const url = buildWhatsappUrl(whatsapp, message);
    window.open(url, "_blank");

    onPaymentSuccess(ticket);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md z-[200]">
        <DialogHeader>
          <DialogTitle>Réservation / Paiement</DialogTitle>
          <DialogDescription>
            {event?.title} • {event?.ticketPrice?.toLocaleString()} {event?.currency} / billet
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nom complet</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Votre nom" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
          </div>
          <div className="space-y-2">
            <Label>Quantité</Label>
            <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value || "1", 10))} />
          </div>
          <div className="text-right font-semibold">Total: {total.toLocaleString()} {event?.currency}</div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Annuler</Button>
            <Button className="bg-gradient-primary text-white" onClick={handleConfirm}>Réserver via WhatsApp</Button>
          </div>
          {!event?.whatsappNumber && (
            <p className="text-xs text-red-600">Aucun numéro WhatsApp n'est défini pour cet événement.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EventPaymentDialog;