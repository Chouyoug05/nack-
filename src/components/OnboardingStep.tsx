import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import LottieAnimation from "@/components/LottieAnimation";
import { useIsMobile } from "@/hooks/use-mobile";
import AnimatedIcon from "@/components/AnimatedIcon";

interface OnboardingStepProps {
  title: string;
  description: string;
  image?: string;
  animation?: any;
  type?: "image" | "lottie" | "icon";
  iconType?: "restaurant" | "inventory" | "analytics";
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onSkip?: () => void;
  isLast?: boolean;
  className?: string;
}

const OnboardingStep = ({
  title,
  description,
  image,
  animation,
  type = "image",
  iconType,
  currentStep,
  totalSteps,
  onNext,
  onSkip,
  isLast = false,
  className
}: OnboardingStepProps) => {
  const isMobile = useIsMobile();
  return (
    <div className={cn(
      "flex flex-col items-center justify-center min-h-screen text-center animate-fade-in",
      "px-4 py-8 md:px-6 lg:px-8",
      "pt-20 md:pt-24", // Account for logo space
      className
    )}>
      {/* Progress Indicators */}
      <div className="flex space-x-3 mb-4 md:mb-6">
        {Array.from({ length: totalSteps }).map((_, index) => (
          <div
            key={index}
            className={cn(
              "rounded-full transition-all duration-500 ease-out",
              isMobile ? "w-2.5 h-2.5" : "w-3 h-3",
              index < currentStep 
                ? "bg-nack-red scale-125 shadow-button" 
                : "bg-nack-beige/60 hover:bg-nack-beige transition-colors"
            )}
          />
        ))}
      </div>

      {/* Animation/Image Container - Compact design */}
      <div className={cn(
        "mb-4 md:mb-6 relative flex items-center justify-center",
        isMobile ? "w-24 h-24" : "w-32 h-32"
      )}>
        {type === "lottie" && animation ? (
          <LottieAnimation 
            animationData={animation}
            className="w-full h-full"
            loop={true}
            autoplay={true}
          />
        ) : type === "icon" && iconType ? (
          <AnimatedIcon 
            type={iconType}
            className="w-full h-full"
          />
        ) : (
          <LottieAnimation 
            imageSrc={image}
            alt={title}
            className="w-full h-full"
          />
        )}
      </div>

      {/* Content - Responsive typography */}
      <div className={cn(
        "mx-auto mb-8 md:mb-10",
        isMobile ? "max-w-xs" : "max-w-sm md:max-w-md"
      )}>
        <h2 className={cn(
          "font-bold text-foreground mb-4 md:mb-6",
          isMobile ? "text-xl" : "text-2xl md:text-3xl"
        )}>
          {title}
        </h2>
        <p className={cn(
          "text-muted-foreground leading-relaxed",
          isMobile ? "text-sm" : "text-base md:text-lg"
        )}>
          {description}
        </p>
      </div>

      {/* Actions - Responsive button sizing */}
      <div className={cn(
        "w-full space-y-4",
        isMobile ? "max-w-xs" : "max-w-sm"
      )}>
        <Button
          variant="nack"
          size={isMobile ? "default" : "lg"}
          onClick={onNext}
          className="w-full shadow-button hover:shadow-elegant transition-all duration-300 transform hover:scale-[1.02]"
        >
          {isLast ? "Commencer" : "Suivant"}
        </Button>
        
        {onSkip && (
          <Button
            variant="nack-outline"
            size={isMobile ? "sm" : "default"}
            onClick={onSkip}
            className="w-full transition-all duration-300"
          >
            Passer
          </Button>
        )}
      </div>
    </div>
  );
};

export default OnboardingStep;