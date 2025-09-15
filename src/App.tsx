import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { OrderProvider } from "@/contexts/OrderContext";
import { EventProvider } from "@/contexts/EventContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import PWAInstallButton from "@/components/PWAInstallButton";
import Index from "./pages/Index";
import Onboarding from "./pages/Onboarding";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import ServeurInterface from "./pages/ServeurInterface";
import CaisseInterface from "./pages/CaisseInterface";
import EventPublicPage from "./pages/EventPublicPage";
import AgentEvenementInterface from "./pages/AgentEvenementInterface";
import NotFound from "./pages/NotFound";
import CompleteProfile from "./pages/CompleteProfile";
import { useEffect, useState } from "react";
import { applyPaymentSuccess } from "@/lib/billing";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

const queryClient = new QueryClient();

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center text-muted-foreground">
    Chargement...
  </div>
);

const AppRoutes = () => {
  const location = useLocation();
  const { currentUser, hasProfile, loading } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const status = params.get('payment');
    const lastRef = localStorage.getItem('nack_last_payment_ref') || '';
    if ((status === 'success' || status === 'ok') && currentUser && lastRef) {
      applyPaymentSuccess(currentUser.uid, lastRef).catch(() => void 0);
      localStorage.removeItem('nack_last_payment_ref');
    }
    if (status === 'error') {
      localStorage.removeItem('nack_last_payment_ref');
    }
  }, [location.search, currentUser]);

  // Community dialog logic
  const CHANNEL_URL = 'https://whatsapp.com/channel/0029VbBeYoYDJ6GtVge5A409';
  const [showCommunity, setShowCommunity] = useState(false);
  const [communityLoaded, setCommunityLoaded] = useState(false);

  useEffect(() => {
    // Load joined status from Firestore once (if logged) and fallback to localStorage
    const init = async () => {
      const joinedLS = localStorage.getItem('nack_community_joined') === '1';
      if (joinedLS) {
        setCommunityLoaded(true);
        return;
      }
      try {
        if (currentUser) {
          const ref = doc(db, 'users', currentUser.uid);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const data = snap.data() as Record<string, unknown>;
            const joined = typeof data.communityJoined === 'boolean' ? data.communityJoined : false;
            if (joined) localStorage.setItem('nack_community_joined', '1');
          }
        }
      } catch (err) { /* noop */ }
      setCommunityLoaded(true);
    };
    init();
  }, [currentUser]);

  useEffect(() => {
    if (!communityLoaded) return;
    if (localStorage.getItem('nack_community_joined') === '1') return;
    const THREE_HOURS = 3 * 60 * 60 * 1000;
    const lastPrompt = Number(localStorage.getItem('nack_community_last_prompt') || '0');
    const now = Date.now();
    if (now - lastPrompt >= THREE_HOURS) {
      setShowCommunity(true);
    }
    const id = window.setInterval(() => {
      if (localStorage.getItem('nack_community_joined') === '1') return;
      localStorage.setItem('nack_community_last_prompt', String(Date.now()));
      setShowCommunity(true);
    }, THREE_HOURS);
    return () => window.clearInterval(id);
  }, [communityLoaded]);

  const markCommunityJoined = async () => {
    try {
      localStorage.setItem('nack_community_joined', '1');
      setShowCommunity(false);
      if (currentUser) {
        await setDoc(doc(db, 'users', currentUser.uid), { communityJoined: true, updatedAt: serverTimestamp() }, { merge: true });
      }
    } catch (err) { /* noop */ }
  };

  const onboardingSeen = (() => {
    try { return localStorage.getItem('nack_onboarding_seen') === '1'; } catch { return false; }
  })();

  useEffect(() => {
    const base = 'NACK!';
    let title = base;
    if (location.pathname.startsWith('/dashboard')) title = `${base} • Tableau de bord`;
    else if (location.pathname.startsWith('/settings')) title = `${base} • Paramètres`;
    else if (location.pathname.startsWith('/reports')) title = `${base} • Rapports`;
    else if (location.pathname.startsWith('/serveur')) title = `${base} • Interface Serveur`;
    else if (location.pathname.startsWith('/caisse')) title = `${base} • Interface Caisse`;
    else if (location.pathname.startsWith('/agent-evenement')) title = `${base} • Agent Événement`;
    else if (location.pathname.startsWith('/event')) title = `${base} • Événement`;
    else if (location.pathname.startsWith('/login')) title = `${base} • Connexion`;
    else if (location.pathname.startsWith('/register')) title = `${base} • Inscription`;
    else if (location.pathname.startsWith('/complete-profile')) title = `${base} • Profil`;
    else if (location.pathname.startsWith('/onboarding')) title = `${base} • Onboarding`;
    document.title = title;
  }, [location.pathname]);

  return (
    <>
      <Routes>
        <Route path="/" element={
          currentUser && !loading ? (
            <Navigate to={hasProfile ? "/dashboard" : "/complete-profile"} replace />
          ) : onboardingSeen ? (
            <Navigate to="/login" replace />
          ) : <Onboarding />
        } />
        <Route path="/onboarding" element={
          currentUser && !loading ? (
            <Navigate to={hasProfile ? "/dashboard" : "/complete-profile"} replace />
          ) : onboardingSeen ? (
            <Navigate to="/login" replace />
          ) : <Onboarding />
        } />
        <Route path="/login" element={
          currentUser && !loading ? (
            <Navigate to={hasProfile ? "/dashboard" : "/complete-profile"} replace />
          ) : <Login />
        } />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/complete-profile" element={
          loading ? (
            <LoadingScreen />
          ) : currentUser ? (
            hasProfile ? <Navigate to="/dashboard" replace /> : <CompleteProfile />
          ) : <Navigate to="/login" replace />
        } />
        <Route path="/dashboard" element={
          loading ? (
            <LoadingScreen />
          ) : currentUser ? (
            hasProfile ? <Dashboard /> : <Navigate to="/complete-profile" replace />
          ) : <Navigate to="/login" replace />
        } />
        <Route path="/serveur/:agentCode" element={<ServeurInterface />} />
        <Route path="/caisse/:agentCode" element={<CaisseInterface />} />
        <Route path="/agent-evenement/:agentCode" element={<AgentEvenementInterface />} />
        <Route path="/event/:eventId" element={<EventPublicPage />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      {!location.pathname.startsWith('/event/') && <PWAInstallButton />}

      {/* Community Dialog */}
      <Dialog
        open={showCommunity}
        onOpenChange={(o) => {
          setShowCommunity(o);
          if (!o) localStorage.setItem('nack_community_last_prompt', String(Date.now()));
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rejoignez la communauté NACK!</DialogTitle>
            <DialogDescription>Suivez les nouveautés, astuces et annonces.</DialogDescription>
          </DialogHeader>
          <img
            src="/community-nack.jpg"
            alt="NACK! Communauté"
            className="w-full max-h-64 object-contain rounded-lg border bg-white"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/favicon.png'; }}
          />
          <div className="space-y-3 text-sm mt-2">
            <p>Rejoignez notre chaîne WhatsApp pour ne rien manquer.</p>
            <div className="flex gap-2">
              <a href={CHANNEL_URL} target="_blank" rel="noopener noreferrer">
                <Button className="bg-gradient-primary text-white">Ouvrir la chaîne</Button>
              </a>
              <Button variant="outline" onClick={markCommunityJoined}>J'ai rejoint</Button>
            </div>
            <button
              type="button"
              className="text-xs underline text-muted-foreground"
              onClick={() => { setShowCommunity(false); localStorage.setItem('nack_community_last_prompt', String(Date.now())); }}
            >
              Plus tard
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <EventProvider>
        <AuthProvider>
          <OrderProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter basename={import.meta.env.BASE_URL || '/'}>
              <AppRoutes />
            </BrowserRouter>
          </OrderProvider>
        </AuthProvider>
      </EventProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;