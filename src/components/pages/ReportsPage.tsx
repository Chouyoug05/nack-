import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  AlertTriangle,
  Download
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, Timestamp } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import jsPDF from "jspdf";

interface SaleItem { id: string; name: string; price: number; quantity: number; isFormula?: boolean; isEvent?: boolean }
interface SaleDoc { id?: string; total: number; items: SaleItem[]; createdAt: any; eventId?: string; agentCode?: string }
interface LossDoc { productId: string; quantity: number; date: any }
interface ProductDoc { id: string; name: string; cost?: number }

const ReportsPage = () => {
  const { currentUser } = useAuth();
  const [sales, setSales] = useState<SaleDoc[]>([]);
  const [losses, setLosses] = useState<LossDoc[]>([]);
  const [products, setProducts] = useState<Record<string, ProductDoc>>({});

  useEffect(() => {
    if (!currentUser) return;
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0);
    const qSales = query(
      collection(db, "sales"),
      where("ownerUid", "==", currentUser.uid),
      where("createdAt", ">=", Timestamp.fromDate(startOfMonth))
    );
    const unsubSales = onSnapshot(qSales, (snap) => {
      const list: SaleDoc[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      // Exclure ventes événement
      const filtered = list.filter(s => !s.eventId && !((s.items || []).some(it => (it as any).isEvent)));
      setSales(filtered as any);
    });

    const qLosses = query(
      collection(db, "losses"),
      where("ownerUid", "==", currentUser.uid),
      where("date", ">=", Timestamp.fromDate(startOfMonth))
    );
    const unsubLosses = onSnapshot(qLosses, (snap) => {
      const list: LossDoc[] = snap.docs.map(d => d.data() as any);
      setLosses(list);
    });

    const unsubProducts = onSnapshot(
      query(collection(db, "products"), where("ownerUid", "==", currentUser.uid)),
      (snap) => {
        const map: Record<string, ProductDoc> = {};
        snap.docs.forEach(docSnap => {
          const data = docSnap.data() as any;
          map[docSnap.id] = { id: docSnap.id, name: data.name, cost: Number(data.cost ?? 0) };
        });
        setProducts(map);
      }
    );

    return () => { unsubSales(); unsubLosses(); unsubProducts(); };
  }, [currentUser]);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfWeek.getDate() - 6);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const inRange = (ts: any, start: Date) => {
    const date = ts?.toDate ? ts.toDate() : new Date(ts);
    return date >= start;
  };

  const buildStats = (start: Date) => {
    const rangeSales = sales.filter(s => inRange((s as any).createdAt, start));
    const ventes = rangeSales.reduce((sum, s) => sum + Number(s.total ?? 0), 0);
    const commandes = rangeSales.length;
    const pertes = losses
      .filter(l => inRange(l.date, start))
      .reduce((sum, l) => sum + (Number(products[l.productId]?.cost ?? 0) * Number(l.quantity ?? 0)), 0);
    const benefice = ventes - pertes;
    return { ventes, commandes, pertes, benefice };
  };

  const dailyData = buildStats(startOfToday);
  const weeklyData = buildStats(startOfWeek);
  const monthlyData = buildStats(startOfMonth);

  const salesToday = useMemo(() => (
    sales
      .filter(s => inRange((s as any).createdAt, startOfToday))
      .sort((a,b) => ((b as any).createdAt?.toDate?.()?.getTime?.()||0) - ((a as any).createdAt?.toDate?.()?.getTime?.()||0))
      .slice(0, 50)
  ), [sales, startOfToday]);

  const salesWeek = useMemo(() => (
    sales
      .filter(s => inRange((s as any).createdAt, startOfWeek))
      .sort((a,b) => ((b as any).createdAt?.toDate?.()?.getTime?.()||0) - ((a as any).createdAt?.toDate?.()?.getTime?.()||0))
      .slice(0, 100)
  ), [sales, startOfWeek]);

  const salesMonth = useMemo(() => (
    sales
      .filter(s => inRange((s as any).createdAt, startOfMonth))
      .sort((a,b) => ((b as any).createdAt?.toDate?.()?.getTime?.()||0) - ((a as any).createdAt?.toDate?.()?.getTime?.()||0))
      .slice(0, 200)
  ), [sales, startOfMonth]);

  const topProducts = useMemo(() => {
    const byProduct: Record<string, { name: string; sales: number; revenue: number }> = {};
    sales.forEach(s => {
      (s.items || []).forEach((it: any) => {
        const key = it.id || it.name;
        if (!byProduct[key]) byProduct[key] = { name: it.name, sales: 0, revenue: 0 };
        byProduct[key].sales += Number(it.quantity ?? 0);
        byProduct[key].revenue += Number(it.price ?? 0) * Number(it.quantity ?? 0);
      });
    });
    return Object.values(byProduct)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [sales]);

  const ReportCard = ({ title, value, change, icon: Icon, trend }: any) => (
    <Card className="shadow-card border-0">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className={`text-sm flex items-center gap-1 ${
              trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600'
            }`}>
              {change}
            </p>
          </div>
          <div className="w-12 h-12 bg-gradient-secondary rounded-lg flex items-center justify-center">
            <Icon size={24} className="text-nack-red" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const exportCsv = (filename: string, rows: SaleDoc[]) => {
    const header = ['Date', 'Heure', 'Produits', 'Total (XAF)', 'Agent'];
    const lines = rows.map((s) => {
      const d = (s as any).createdAt?.toDate?.() as Date | undefined;
      const date = d ? d.toLocaleDateString('fr-FR') : '';
      const time = d ? d.toLocaleTimeString('fr-FR') : '';
      const produits = (s.items || []).map(it => `${it.name} x${it.quantity}`).join('; ');
      const total = Number(s.total ?? 0).toString();
      const agent = s.agentCode ? s.agentCode : '';
      return [date, time, produits, total, agent]
        .map(v => '"' + String(v).replace(/"/g, '""') + '"')
        .join(',');
    });
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const loadImageAsDataURL = (url: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width; canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  };

  const exportPdf = async () => {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210; const margin = 12; let y = margin;

    // En-tête avec bandeau rouge NACK! + logo
    pdf.setFillColor(220, 38, 38);
    pdf.rect(0, 0, pageW, 22, 'F');
    pdf.setTextColor(255,255,255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text('NACK! • RAPPORTS', margin, 14);

    const logo = await loadImageAsDataURL('/favicon.png');
    if (logo) {
      pdf.addImage(logo, 'PNG', pageW - margin - 10, 6, 10, 10);
    }

    y = 28;
    pdf.setTextColor(0,0,0);
    pdf.setFont('helvetica', 'normal');

    const addSectionTitle = (title: string) => {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(13);
      pdf.text(title, margin, y);
      y += 6;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
    };

    const addLine = (left: string, right?: string) => {
      const maxWidth = pageW - 2*margin;
      const lines = pdf.splitTextToSize(left, right ? maxWidth - 40 : maxWidth);
      lines.forEach((ln: string, idx: number) => {
        if (y > 280) { pdf.addPage(); y = margin; }
        pdf.text(ln, margin, y);
        if (right && idx === 0) {
          pdf.text(right, pageW - margin - pdf.getTextWidth(right), y);
        }
        y += 6;
      });
    };

    // Récap stats
    addSectionTitle('Récapitulatif');
    addLine(`Ventes du jour: ${dailyData.ventes.toLocaleString()} XAF`, `Commandes: ${dailyData.commandes}`);
    addLine(`Ventes semaine: ${weeklyData.ventes.toLocaleString()} XAF`, `Commandes: ${weeklyData.commandes}`);
    addLine(`Ventes mois: ${monthlyData.ventes.toLocaleString()} XAF`, `Commandes: ${monthlyData.commandes}`);
    addLine(`Pertes mois: ${monthlyData.pertes.toLocaleString()} XAF`, `Bénéfice net: ${monthlyData.benefice.toLocaleString()} XAF`);

    // Historique ventes (jour)
    addSectionTitle("Historique des ventes (aujourd'hui)");
    if (salesToday.length === 0) addLine('Aucune vente aujourd\'hui');
    salesToday.forEach((s) => {
      const d = (s as any).createdAt?.toDate?.() as Date | undefined;
      const time = d ? d.toLocaleTimeString('fr-FR') : '';
      const produits = (s.items || []).map(it => `${it.name} x${it.quantity}`).join(', ') || 'Vente';
      addLine(`${time} • ${produits}`, `${Number(s.total ?? 0).toLocaleString()} XAF`);
    });

    // Historique ventes (semaine)
    addSectionTitle('Historique des ventes (semaine)');
    if (salesWeek.length === 0) addLine('Aucune vente cette semaine');
    salesWeek.forEach((s) => {
      const d = (s as any).createdAt?.toDate?.() as Date | undefined;
      const when = d ? d.toLocaleString('fr-FR') : '';
      const produits = (s.items || []).map(it => `${it.name} x${it.quantity}`).join(', ') || 'Vente';
      addLine(`${when} • ${produits}`, `${Number(s.total ?? 0).toLocaleString()} XAF`);
    });

    // Historique ventes (mois)
    addSectionTitle('Historique des ventes (mois)');
    if (salesMonth.length === 0) addLine('Aucune vente ce mois-ci');
    salesMonth.forEach((s) => {
      const d = (s as any).createdAt?.toDate?.() as Date | undefined;
      const when = d ? d.toLocaleString('fr-FR') : '';
      const produits = (s.items || []).map(it => `${it.name} x${it.quantity}`).join(', ') || 'Vente';
      addLine(`${when} • ${produits}`, `${Number(s.total ?? 0).toLocaleString()} XAF`);
    });

    // Top produits
    addSectionTitle('Top produits (mois)');
    if (topProducts.length === 0) addLine('Aucun produit vendu ce mois-ci');
    topProducts.forEach((p, idx) => addLine(`#${idx+1} ${p.name}`, `${p.revenue.toLocaleString()} XAF`));

    // Pertes récentes
    addSectionTitle('Pertes récentes');
    const recentLosses = [...losses].sort((a,b) => (a.date?.toDate?.() ?? new Date()).getTime() < (b.date?.toDate?.() ?? new Date()).getTime() ? 1 : -1).slice(0, 10);
    if (recentLosses.length === 0) addLine('Aucune perte enregistrée');
    recentLosses.forEach((l) => {
      const date = (l.date?.toDate?.() ?? new Date()).toLocaleDateString('fr-FR');
      const name = products[l.productId]?.name ?? l.productId;
      const cost = ((products[l.productId]?.cost ?? 0) * Number(l.quantity ?? 0)).toLocaleString();
      addLine(`${date} • ${name} (x${l.quantity})`, `-${cost} XAF`);
    });

    // Pied de page
    if (y > 280) { pdf.addPage(); y = margin; }
    pdf.setFontSize(9); pdf.setTextColor(120);
    pdf.text(`Généré le ${new Date().toLocaleString('fr-FR')}`, margin, 290);

    pdf.save('rapport-nack.pdf');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground mb-1">Rapports & Analyses</h2>
          <p className="text-sm text-muted-foreground">Suivez les performances de votre établissement</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end max-w-full">
          <Button variant="nack-outline" size="sm" className="gap-2 w-full sm:w-auto" onClick={() => exportCsv('ventes-jour.csv', salesToday)}>
            <Download size={16} />
            Exporter CSV
          </Button>
          <Button size="sm" className="gap-2 bg-gradient-primary text-white w-full sm:w-auto" onClick={exportPdf}>
            <Download size={16} />
            Exporter PDF
          </Button>
        </div>
      </div>

      {/* Onglets des rapports */}
      <Tabs defaultValue="daily" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="daily" className="gap-2">
            <Calendar size={16} />
            Journalier
          </TabsTrigger>
          <TabsTrigger value="weekly" className="gap-2">
            <Calendar size={16} />
            Hebdomadaire
          </TabsTrigger>
          <TabsTrigger value="monthly" className="gap-2">
            <Calendar size={16} />
            Mensuel
          </TabsTrigger>
        </TabsList>

        {/* Rapport Journalier */}
        <TabsContent value="daily" className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <ReportCard title="Ventes du jour" value={`${dailyData.ventes.toLocaleString()} XAF`} change={""} icon={DollarSign} trend={"up"} />
            <ReportCard title="Commandes" value={dailyData.commandes} change={""} icon={ShoppingBag} trend={"up"} />
            <ReportCard title="Pertes" value={`${dailyData.pertes.toLocaleString()} XAF`} change={""} icon={AlertTriangle} trend={dailyData.pertes > 0 ? "down" : "up"} />
            <ReportCard title="Bénéfice net" value={`${dailyData.benefice.toLocaleString()} XAF`} change={""} icon={TrendingUp} trend={dailyData.benefice >= 0 ? "up" : "down"} />
          </div>
        </TabsContent>

        {/* Rapport Hebdomadaire */}
        <TabsContent value="weekly" className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <ReportCard title="Ventes de la semaine" value={`${weeklyData.ventes.toLocaleString()} XAF`} change={""} icon={DollarSign} trend={"up"} />
            <ReportCard title="Commandes" value={weeklyData.commandes} change={""} icon={ShoppingBag} trend={"up"} />
            <ReportCard title="Pertes" value={`${weeklyData.pertes.toLocaleString()} XAF`} change={""} icon={AlertTriangle} trend={weeklyData.pertes > 0 ? "down" : "up"} />
            <ReportCard title="Bénéfice net" value={`${weeklyData.benefice.toLocaleString()} XAF`} change={""} icon={TrendingUp} trend={weeklyData.benefice >= 0 ? "up" : "down"} />
          </div>
        </TabsContent>

        {/* Rapport Mensuel */}
        <TabsContent value="monthly" className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <ReportCard title="Ventes du mois" value={`${monthlyData.ventes.toLocaleString()} XAF`} change={""} icon={DollarSign} trend={"up"} />
            <ReportCard title="Commandes" value={monthlyData.commandes} change={""} icon={ShoppingBag} trend={"up"} />
            <ReportCard title="Pertes" value={`${monthlyData.pertes.toLocaleString()} XAF`} change={""} icon={AlertTriangle} trend={monthlyData.pertes > 0 ? "down" : "up"} />
            <ReportCard title="Bénéfice net" value={`${monthlyData.benefice.toLocaleString()} XAF`} change={""} icon={TrendingUp} trend={monthlyData.benefice >= 0 ? "up" : "down"} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Produits les plus vendus */}
      <Card className="shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp size={20} className="text-nack-red" />
            Produits les plus vendus
          </CardTitle>
          <CardDescription>Top 5 des produits ce mois-ci</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topProducts.map((product, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-nack-beige-light rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-nack-red rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.sales} unités vendues</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-green-600">{product.revenue.toLocaleString()} XAF</p>
                </div>
              </div>
            ))}
            {topProducts.length === 0 && (
              <p className="text-center text-muted-foreground py-6">Aucune vente enregistrée ce mois-ci</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Historique des ventes (bar/resto, aujourd'hui) */}
      <Card className="shadow-card border-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign size={20} className="text-green-600" />
                Historique des ventes (aujourd'hui)
              </CardTitle>
              <CardDescription>Bar/restaurant uniquement (événements exclus)</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => exportCsv('ventes-jour.csv', salesToday)}>
              <Download size={16} /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {salesToday.map((s, idx) => (
              <div key={s.id || idx} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium text-sm">
                    {(s.items || []).map(it => `${it.name} x${it.quantity}`).join(', ') || 'Vente'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(s as any).createdAt?.toDate?.()?.toLocaleTimeString?.('fr-FR') || ''} {s.agentCode ? `• Agent: ${s.agentCode}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{Number(s.total ?? 0).toLocaleString()} XAF</p>
                </div>
              </div>
            ))}
            {salesToday.length === 0 && (
              <p className="text-center text-muted-foreground py-6">Aucune vente aujourd'hui</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Historique des ventes (semaine) */}
      <Card className="shadow-card border-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign size={20} className="text-green-600" />
                Historique des ventes (semaine)
              </CardTitle>
              <CardDescription>7 derniers jours • Événements exclus</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => exportCsv('ventes-semaine.csv', salesWeek)}>
              <Download size={16} /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {salesWeek.map((s, idx) => (
              <div key={s.id || idx} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium text-sm">
                    {(s.items || []).map(it => `${it.name} x${it.quantity}`).join(', ') || 'Vente'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(s as any).createdAt?.toDate?.()?.toLocaleString?.('fr-FR') || ''} {s.agentCode ? `• Agent: ${s.agentCode}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{Number(s.total ?? 0).toLocaleString()} XAF</p>
                </div>
              </div>
            ))}
            {salesWeek.length === 0 && (
              <p className="text-center text-muted-foreground py-6">Aucune vente cette semaine</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Historique des ventes (mois) */}
      <Card className="shadow-card border-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign size={20} className="text-green-600" />
                Historique des ventes (mois)
              </CardTitle>
              <CardDescription>Mois en cours • Événements exclus</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => exportCsv('ventes-mois.csv', salesMonth)}>
              <Download size={16} /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {salesMonth.map((s, idx) => (
              <div key={s.id || idx} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium text-sm">
                    {(s.items || []).map(it => `${it.name} x${it.quantity}`).join(', ') || 'Vente'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(s as any).createdAt?.toDate?.()?.toLocaleString?.('fr-FR') || ''} {s.agentCode ? `• Agent: ${s.agentCode}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{Number(s.total ?? 0).toLocaleString()} XAF</p>
                </div>
              </div>
            ))}
            {salesMonth.length === 0 && (
              <p className="text-center text-muted-foreground py-6">Aucune vente ce mois-ci</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pertes et gaspillages récents */}
      <Card className="shadow-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-red-500" />
            Pertes récentes
          </CardTitle>
          <CardDescription>Pertes et gaspillages enregistrés</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {losses
              .sort((a,b) => (a.date?.toDate?.() ?? new Date()).getTime() < (b.date?.toDate?.() ?? new Date()).getTime() ? 1 : -1)
              .slice(0, 5)
              .map((loss, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                      <AlertTriangle size={16} className="text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-red-900">{products[loss.productId]?.name ?? loss.productId}</p>
                      <p className="text-xs text-red-600">Quantité: {loss.quantity} • {(loss.date?.toDate?.() ?? new Date()).toLocaleDateString('fr-FR')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-red-600">-{((products[loss.productId]?.cost ?? 0) * Number(loss.quantity ?? 0)).toLocaleString()} XAF</p>
                  </div>
                </div>
              ))}
            {losses.length === 0 && (
              <p className="text-center text-muted-foreground py-6">Aucune perte enregistrée</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsPage;