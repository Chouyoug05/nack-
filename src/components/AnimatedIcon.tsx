import { cn } from "@/lib/utils";
import { 
  Coffee, 
  Wine, 
  BarChart3, 
  ShoppingBag, 
  Package2, 
  TrendingUp,
  Utensils,
  Music,
  type LucideIcon 
} from "lucide-react";
import { useEffect, useState } from "react";

interface AnimatedIconProps {
  type: 'restaurant' | 'inventory' | 'analytics';
  className?: string;
}

const AnimatedIcon = ({ type, className }: AnimatedIconProps) => {
  const [currentIcon, setCurrentIcon] = useState(0);

  const iconSets = {
    restaurant: [
      { Icon: Utensils, delay: 0 },
      { Icon: Coffee, delay: 200 },
      { Icon: Music, delay: 400 }
    ],
    inventory: [
      { Icon: Package2, delay: 0 },
      { Icon: ShoppingBag, delay: 300 },
      { Icon: Wine, delay: 600 }
    ],
    analytics: [
      { Icon: BarChart3, delay: 0 },
      { Icon: TrendingUp, delay: 400 }
    ]
  };

  const icons = iconSets[type];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIcon((prev) => (prev + 1) % icons.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [icons.length]);

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      {/* Main animated icons */}
      <div className="relative grid grid-cols-2 gap-0 p-0">
        {icons.map(({ Icon }, index) => {
          const isActive = index === currentIcon;
          return (
            <div
              key={index}
              className={cn(
                "transition-all duration-500 transform",
                isActive 
                  ? "scale-110 text-nack-red opacity-100" 
                  : "scale-90 text-muted-foreground opacity-60"
              )}
            >
              <Icon 
                size={40} 
                className="drop-shadow-lg"
                style={{ 
                  animationDelay: `${index * 200}ms`,
                  animationDuration: '2s'
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AnimatedIcon;