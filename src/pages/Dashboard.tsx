import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  Package,
  ShoppingCart,
  Users,
  Settings,
  Menu,
  Calendar,
  LogOut
} from "lucide-react";
import NackLogo from "@/components/NackLogo";
import MobileBottomNav from "@/components/MobileBottomNav";
import TabletSidebar from "@/components/TabletSidebar";
import OrderManagement from "@/components/OrderManagement";
import NotificationPanel from "@/components/NotificationPanel";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import StockPage from "@/components/pages/StockPage";
import SalesPage from "@/components/pages/SalesPage";
import EventsPage from "@/components/pages/EventsPage";
import SettingsPage from "@/components/pages/SettingsPage";
import ReportsPage from "@/components/pages/ReportsPage";
import TeamPage from "@/components/pages/TeamPage";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import ErrorBoundary from "@/components/ErrorBoundary";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface UserDoc {
  uid: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  establishmentId?: string;
}

interface EstablishmentDoc {
  id: string;
  name: string;
  type?: string;
  city?: string;
}

const Dashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const navigate = useNavigate();
  const { currentUser, signOutUser } = useAuth();

  const [profile, setProfile] = useState<UserDoc | null>(null);
  const [establishment, setEstablishment] = useState<EstablishmentDoc | null>(null);
  const [loadingData, setLoadingData] = useState<boolean>(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;
      const userRef = doc(db, "users", currentUser.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data() as UserDoc;
        setProfile(userData);
        if (userData.establishmentId) {
          const estRef = doc(db, "establishments", userData.establishmentId);
          const estSnap = await getDoc(estRef);
          if (estSnap.exists()) {
            setEstablishment(estSnap.data() as EstablishmentDoc);
          }
        }
      }
      setLoadingData(false);
    };
    fetchData();
  }, [currentUser]);

  const safeSetTab = (tab: string) => {
    try {
      setActiveTab(tab);
      setSidebarOpen(false);
    } catch {}
  };

  const quickActions = [
    {
      title: "Gestion du Stock",
      description: "Ajouter/modifier produits",
      icon: Package,
      color: "bg-blue-500",
      action: () => safeSetTab("stock")
    },
    {
      title: "Nouvelle Vente",
      description: "Enregistrer une transaction",
      icon: ShoppingCart,
      color: "bg-green-500",
      action: () => safeSetTab("sales")
    },
    {
      title: "Rapports",
      description: "Voir les statistiques",
      icon: BarChart3,
      color: "bg-purple-500",
      action: () => safeSetTab("reports")
    },
    {
      title: "Équipe",
      description: "Gérer l'équipe",
      icon: Users,
      color: "bg-orange-500",
      action: () => safeSetTab("equipe")
    }
  ];

  const handleLogout = async () => {
    await signOutUser();
    navigate("/login");
  };

  const handleTabChange = (tab: string) => {
    safeSetTab(tab);
  };

  const ownerDisplayName = useMemo(() => {
    const name = profile?.displayName || `${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim();
    if (name) return name;
    if (currentUser?.email) return currentUser.email.split("@")[0];
    return "Utilisateur";
  }, [profile, currentUser]);

  const ownerInitials = useMemo(() => {
    const basis = ownerDisplayName;
    const parts = basis.split(" ").filter(Boolean);
    const initials = parts.slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
    return initials || "U";
  }, [ownerDisplayName]);

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Mobile Header - Simple header for mobile without burger menu */}
      <div className="md:hidden bg-card border-b px-4 py-3 flex items-center justify-center relative flex-shrink-0">
        <NackLogo size="sm" />
        <div className="absolute right-4 flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleTabChange("evenements")}
            className="relative hover:bg-nack-beige-light"
          >
            <Calendar className="h-5 w-5" />
          </Button>
          <NotificationPanel size="sm" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-8 h-8 bg-gradient-primary rounded-full flex items-center justify-center text-white font-semibold shadow-button" aria-label="Profil">
                {ownerInitials.slice(0,2)}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent sideOffset={8} align="end" className="w-44">
              <DropdownMenuLabel>Mon compte</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleTabChange("settings")}>Paramètres</DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" /> Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Tablet Sidebar - visible on tablet only */}
        <TabletSidebar 
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onLogout={handleLogout}
        />

        {/* Desktop Sidebar - visible on desktop only */}
        <div className="hidden lg:flex flex-col w-64 bg-card border-r border-border flex-shrink-0">
          {/* Logo */}
          <div className="p-6 border-b border-border flex-shrink-0">
            <NackLogo size="md" />
            <p className="text-sm text-muted-foreground mt-1">{establishment?.name ?? "—"}</p>
          </div>

          {/* Navigation */}
          <div className="flex-1 p-4 space-y-2 overflow-y-auto">
            <Button 
              variant={activeTab === "dashboard" ? "nack-ghost" : "ghost"} 
              className="w-full justify-start"
              onClick={() => handleTabChange("dashboard")}
            >
              <BarChart3 className="mr-3" size={18} />
              Tableau de bord
            </Button>
            <Button 
              variant={activeTab === "stock" ? "nack-ghost" : "ghost"} 
              className="w-full justify-start"
              onClick={() => handleTabChange("stock")}
            >
              <Package className="mr-3" size={18} />
              Stock
            </Button>
            <Button 
              variant={activeTab === "sales" ? "nack-ghost" : "ghost"} 
              className="w-full justify-start"
              onClick={() => handleTabChange("sales")}
            >
              <ShoppingCart className="mr-3" size={18} />
              Ventes
            </Button>
            <Button 
              variant={activeTab === "reports" ? "nack-ghost" : "ghost"} 
              className="w-full justify-start"
              onClick={() => handleTabChange("reports")}
            >
              <BarChart3 className="mr-3" size={18} />
              Rapports
            </Button>
            <Button 
              variant={activeTab === "evenements" ? "nack-ghost" : "ghost"} 
              className="w-full justify-start"
              onClick={() => handleTabChange("evenements")}
            >
              <Calendar className="mr-3" size={18} />
              Événements
            </Button>
            <Button 
              variant={activeTab === "settings" ? "nack-ghost" : "ghost"} 
              className="w-full justify-start"
              onClick={() => handleTabChange("settings")}
            >
              <Settings className="mr-3" size={18} />
              Paramètres
            </Button>
          </div>

          {/* User Section - Fixed at bottom */}
          <div className="p-4 border-t border-border flex-shrink-0 bg-card">
            <div className="bg-nack-beige-light rounded-xl p-4 mb-3">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center text-white font-bold text-lg shadow-button">
                  {ownerInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{ownerDisplayName}</p>
                  <p className="text-sm text-muted-foreground">Gérant • {establishment?.name ?? "—"}</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg"
                onClick={handleLogout}
              >
                <LogOut className="mr-2" size={16} />
                Déconnexion
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content - Scrollable */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Desktop Header */}
          <div className="hidden lg:block bg-card border-b px-8 py-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {activeTab === "dashboard" && "Tableau de bord"}
                  {activeTab === "stock" && "Gestion du Stock"}
                  {activeTab === "sales" && "Point de Vente"}
                  {activeTab === "equipe" && "Gestion de l'Équipe"}
                  {activeTab === "reports" && "Rapports & Analyses"}
                  {activeTab === "evenements" && "Gestion des Événements"}
                  {activeTab === "settings" && "Paramètres"}
                </h1>
                <p className="text-muted-foreground text-sm">
                  {activeTab === "dashboard" && `Vue d'ensemble de ${establishment?.name ?? "votre établissement"}`}
                  {activeTab === "stock" && "Gérez vos produits et surveillez les stocks"}
                  {activeTab === "sales" && "Interface de vente et gestion des transactions"}
                  {activeTab === "equipe" && "Gérez votre équipe de serveurs et caissiers"}
                  {activeTab === "reports" && "Analysez les performances et suivez les tendances"}
                  {activeTab === "evenements" && "Créez et gérez vos événements avec vente de billets"}
                  {activeTab === "settings" && "Configurez votre établissement et vos préférences"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleTabChange("evenements")}
                  className="relative hover:bg-nack-beige-light"
                >
                  <Calendar className="h-5 w-5" />
                </Button>
                <NotificationPanel size="md" />
                <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center text-white font-semibold shadow-button">
                  {ownerInitials}
                </div>
              </div>
            </div>
          </div>
          {/* Scrollable Content */}
          <ErrorBoundary onReset={() => safeSetTab("dashboard") }>
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 lg:p-8 pb-20 md:pb-8 animate-fade-in">
                {/* Page Content */}
                {activeTab === "dashboard" ? (
                  <>
                    {/* Quick Actions */}
                    <div className="mb-6 animate-slide-up">
                      <h2 className="text-lg font-semibold mb-3">Actions rapides</h2>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {quickActions.map((action, index) => (
                          <Card key={index} className="shadow-card border-0 hover:shadow-elegant transition-shadow cursor-pointer card-animated" onClick={action.action}>
                            <CardContent className="p-4 text-center">
                              <div className={`w-12 h-12 ${action.color} rounded-xl flex items-center justify-center mx-auto mb-3`}>
                                <action.icon size={24} className="text-white" />
                              </div>
                              <h3 className="font-semibold text-sm mb-1">{action.title}</h3>
                              <p className="text-xs text-muted-foreground">{action.description}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>

                    {/* Order Management for Manager */}
                    <OrderManagement 
                      title="Commandes reçues"
                      description="Commandes envoyées par les serveurs"
                      showActions={true}
                    />
                  </>
                ) : (
                  <>
                    {/* Page Headers */}
                    <div className="lg:hidden mb-6 animate-fade-in">
                      <h1 className="text-2xl font-bold text-foreground">
                        {activeTab === "stock" && "Gestion du Stock"}
                        {activeTab === "sales" && "Point de Vente"}
                        {activeTab === "equipe" && "Gestion de l'Équipe"}
                        {activeTab === "reports" && "Rapports & Analyses"}
                        {activeTab === "settings" && "Paramètres"}
                      </h1>
                      <p className="text-muted-foreground text-sm">
                        {activeTab === "stock" && "Gérez vos produits et surveillez les stocks"}
                        {activeTab === "sales" && "Interface de vente et gestion des transactions"}
                        {activeTab === "equipe" && "Gérez votre équipe de serveurs et caissiers"}
                        {activeTab === "reports" && "Analysez les performances et suivez les tendances"}
                        {activeTab === "settings" && "Configurez votre établissement et vos préférences"}
                      </p>
                    </div>

                    {/* Render Page Components */}
                    {activeTab === "stock" && <StockPage />}
                    {activeTab === "sales" && <SalesPage />}
                    {activeTab === "equipe" && <TeamPage />}
                    {activeTab === "evenements" && <EventsPage />}
                    {activeTab === "reports" && <ReportsPage />}
                    {activeTab === "settings" && <SettingsPage onTabChange={handleTabChange} />}
                  </>
                )}
              </div>
            </div>
          </ErrorBoundary>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav 
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />
    </div>
  );
};

export default Dashboard;