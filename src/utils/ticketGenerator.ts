import jsPDF from 'jspdf';
import QRCode from 'qrcode';

interface TicketData {
  id: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  quantity: number;
  totalAmount: number;
  currency: string;
  qrCode: string;
  brandName?: string; // ex: NACK!
  establishmentName?: string; // ex: Le Nom du lieu
  establishmentPhone?: string; // ex: +241...
}

export const generateEventTicket = async (ticketData: TicketData) => {
  try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Couleurs NACK!
    const nackRed = [220, 38, 38]; // #DC2626
    const nackBeige = [252, 248, 227]; // #FCF8E3
    const darkGray = [55, 65, 81]; // #374151
    const lightGray = [156, 163, 175]; // #9CA3AF

    // Fond et bordures
    pdf.setFillColor(nackBeige[0], nackBeige[1], nackBeige[2]);
    pdf.rect(0, 0, 210, 297, 'F');
    
    pdf.setDrawColor(nackRed[0], nackRed[1], nackRed[2]);
    pdf.setLineWidth(2);
    pdf.rect(10, 10, 190, 277);

    // Header
    pdf.setFillColor(nackRed[0], nackRed[1], nackRed[2]);
    pdf.rect(10, 10, 190, 30, 'F');
    
    // Logo / Marque
    const brand = ticketData.brandName || 'NACK!';
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.text(brand, 105, 30, { align: 'center' });
    
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text('RESTAURANT • ÉVÉNEMENTS', 105, 35, { align: 'center' });

    // Titre du billet
    pdf.setTextColor(nackRed[0], nackRed[1], nackRed[2]);
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text("BILLET D'ÉVÉNEMENT", 105, 55, { align: 'center' });

    // Infos événement
    pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text(ticketData.eventTitle, 105, 70, { align: 'center' });

    // Détails de l'événement
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    
    const eventDate = new Date(ticketData.eventDate).toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    pdf.text(`Date: ${eventDate}`, 20, 90);
    pdf.text(`Heure: ${ticketData.eventTime}`, 20, 100);
    pdf.text(`Lieu: ${ticketData.eventLocation}`, 20, 110);

    // Informations du client
    pdf.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
    pdf.rect(15, 125, 180, 50, 'F');
    
    pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('INFORMATIONS DU TITULAIRE', 105, 135, { align: 'center' });
    
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Nom: ${ticketData.customerName}`, 20, 145);
    pdf.text(`Email: ${ticketData.customerEmail}`, 20, 155);
    pdf.text(`Téléphone: ${ticketData.customerPhone}`, 20, 165);

    // Détails du billet
    pdf.text(`Nombre de billets: ${ticketData.quantity}`, 110, 145);
    pdf.text(`Montant total: ${ticketData.totalAmount.toLocaleString()} ${ticketData.currency}`, 110, 155);
    pdf.text(`Numéro de billet: ${ticketData.id}`, 110, 165);

    // Génération du QR Code (JSON court)
    const qrCodeDataURL = await QRCode.toDataURL(ticketData.qrCode, {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // Ajout du QR Code au PDF
    const qrSize = 60;
    const qrX = (210 - qrSize) / 2;
    pdf.addImage(qrCodeDataURL, 'PNG', qrX, 190, qrSize, qrSize);

    // Instructions pour le QR Code
    pdf.setFontSize(10);
    pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    pdf.text("Présentez ce QR Code à l'entrée de l'événement", 105, 260, { align: 'center' });

    // Conditions
    pdf.setFontSize(8);
    pdf.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
    pdf.text("Ce billet est personnel et non cessible. Une pièce d'identité pourra être demandée.", 105, 270, { align: 'center' });

    // Footer personnalisé établissement
    const estName = ticketData.establishmentName || '';
    const estPhone = ticketData.establishmentPhone || '';
    pdf.setFillColor(nackRed[0], nackRed[1], nackRed[2]);
    pdf.rect(10, 280, 190, 7, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(9);
    const footer = `${brand}${estName ? ' • ' + estName : ''}${estPhone ? ' • ' + estPhone : ''}`;
    pdf.text(footer, 105, 285, { align: 'center' });

    // Téléchargement du PDF
    const fileName = `billet-${ticketData.eventTitle.toLowerCase().replace(/\s+/g, '-')}-${ticketData.id}.pdf`;
    pdf.save(fileName);

  } catch (error) {
    console.error('Erreur lors de la génération du ticket:', error);
    throw new Error('Impossible de générer le ticket PDF');
  }
};