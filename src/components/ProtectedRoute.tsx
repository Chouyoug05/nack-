import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const FullscreenLoader = () => (
  <div className="min-h-screen flex items-center justify-center text-muted-foreground">
    Chargement...
  </div>
);

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { currentUser, loading } = useAuth();
  if (loading) return <FullscreenLoader />;
  if (!currentUser) return <Navigate to="/login" replace />;
  return children;
};

export default ProtectedRoute; 