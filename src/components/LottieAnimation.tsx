import { useEffect, useRef } from "react";
import Lottie from "lottie-react";
import { cn } from "@/lib/utils";

interface LottieAnimationProps {
  animationData?: any;
  className?: string;
  loop?: boolean;
  autoplay?: boolean;
  imageSrc?: string;
  alt?: string;
}

const LottieAnimation = ({ 
  animationData, 
  className, 
  loop = true, 
  autoplay = true,
  imageSrc,
  alt = "Animation"
}: LottieAnimationProps) => {
  const lottieRef = useRef<any>(null);

  useEffect(() => {
    if (lottieRef.current && autoplay) {
      lottieRef.current.play();
    }
  }, [autoplay]);

  // If we have an image fallback instead of Lottie data
  if (imageSrc && !animationData) {
    return (
      <img 
        src={imageSrc} 
        alt={alt}
        className={cn("w-full h-full object-contain animate-scale-in", className)}
      />
    );
  }

  if (!animationData) {
    return null;
  }

  return (
    <Lottie
      lottieRef={lottieRef}
      animationData={animationData}
      loop={loop}
      autoPlay={autoplay}
      className={cn("w-full h-full", className)}
      style={{
        filter: 'hue-rotate(0deg) saturate(1.2) brightness(1.1)',
      }}
    />
  );
};

export default LottieAnimation;