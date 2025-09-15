import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  Package, 
  ShoppingCart, 
  Users, 
  Settings,
  LogOut,
  ClipboardList,
  Calendar
} from "lucide-react";
import NackLogo from "@/components/NackLogo";
import NotificationPanel from "@/components/NotificationPanel";
import { cn } from "@/lib/utils";

interface TabletSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
}

const TabletSidebar = ({ activeTab, onTabChange, onLogout }: TabletSidebarProps) => {
  const navItems = [
    { id: "dashboard", label: "Tableau de bord", icon: BarChart3 },
    { id: "stock", label: "Stock", icon: Package },
    { id: "sales", label: "Ventes", icon: ShoppingCart },
    { id: "evenements", label: "Événements", icon: Calendar },
    { id: "reports", label: "Rapports", icon: ClipboardList },
    { id: "settings", label: "Paramètres", icon: Settings }
  ];

  return (
    <div className="hidden md:flex lg:hidden flex-col w-72 bg-card border-r border-border flex-shrink-0">
      {/* Logo Section */}
      <div className="p-6 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <NackLogo size="md" />
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onTabChange("evenements")}
              className="relative hover:bg-nack-beige-light"
            >
              <Calendar className="h-5 w-5" />
            </Button>
            <NotificationPanel size="sm" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Mon Établissement</p>
      </div>

      {/* Navigation Buttons */}
      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          
          return (
            <Button
              key={item.id}
              variant={isActive ? "nack" : "ghost"}
              size="lg"
              onClick={() => onTabChange(item.id)}
              className={cn(
                "w-full justify-start h-14 text-base font-semibold",
                isActive && "shadow-elegant"
              )}
            >
              <Icon className="mr-4" size={22} />
              {item.label}
            </Button>
          );
        })}
      </div>

      {/* User Section - Fixed at bottom */}
      <div className="p-4 border-t border-border flex-shrink-0 bg-card">
        <div className="bg-nack-beige-light rounded-xl p-4 mb-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-gradient-primary rounded-full flex items-center justify-center text-white font-bold text-lg shadow-button">
              JD
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate">John Doe</p>
              <p className="text-sm text-muted-foreground">Gérant • Mon Établissement</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg"
            onClick={onLogout}
          >
            <LogOut className="mr-2" size={16} />
            Déconnexion
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TabletSidebar;