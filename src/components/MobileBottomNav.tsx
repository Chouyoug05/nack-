import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  Package, 
  ShoppingCart, 
  Users, 
  Settings,
  ClipboardList,
  Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileBottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const MobileBottomNav = ({ activeTab, onTabChange }: MobileBottomNavProps) => {
  const navItems = [
    { id: "dashboard", label: "Tableau", icon: BarChart3 },
    { id: "stock", label: "Stock", icon: Package },
    { id: "sales", label: "Ventes", icon: ShoppingCart },
    { id: "reports", label: "Rapports", icon: ClipboardList },
    { id: "settings", label: "Réglages", icon: Settings }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 md:hidden">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-all duration-200 min-w-0 flex-1",
                isActive 
                  ? "text-nack-red bg-nack-red/10" 
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <Icon size={20} className={cn("mb-1", isActive && "text-nack-red")} />
              <span className={cn(
                "text-xs font-medium truncate",
                isActive && "text-nack-red"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MobileBottomNav;