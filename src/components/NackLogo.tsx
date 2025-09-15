import { cn } from "@/lib/utils";

interface NackLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const NackLogo = ({ className, size = "md" }: NackLogoProps) => {
  const sizeClasses = {
    sm: "h-8 w-auto",
    md: "h-12 w-auto",
    lg: "h-16 w-auto",
    xl: "h-24 w-auto"
  };

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <img 
        src="/lovable-uploads/837db36d-6740-44f3-90ee-db3dd16f8f1f.png" 
        alt="nack! logo"
        className={cn("object-contain animate-fade-in", sizeClasses[size])}
      />
    </div>
  );
};

export default NackLogo;