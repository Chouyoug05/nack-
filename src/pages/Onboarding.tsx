import { useState } from "react";
import { useNavigate } from "react-router-dom";
import OnboardingStep from "@/components/OnboardingStep";
import NackLogo from "@/components/NackLogo";
import AnimatedIcon from "@/components/AnimatedIcon";

const onboardingData = [
  {
    title: "Gérez votre établissement",
    description: "Contrôlez facilement votre bar, snack ou boîte de nuit avec une interface moderne et intuitive.",
    animation: undefined,
    image: undefined,
    type: "icon" as const,
    iconType: "restaurant" as const
  },
  {
    title: "Suivez votre stock",
    description: "Gardez un œil sur vos boissons et produits en temps réel. Fini les ruptures de stock !",
    animation: undefined,
    image: undefined,
    type: "icon" as const,
    iconType: "inventory" as const
  },
  {
    title: "Analysez vos performances",
    description: "Accédez à des rapports détaillés pour optimiser votre business et maximiser vos profits.",
    animation: undefined,
    image: undefined,
    type: "icon" as const,
    iconType: "analytics" as const
  }
];

const Onboarding = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  const handleFinish = () => {
    try { localStorage.setItem('nack_onboarding_seen', '1'); } catch {}
    navigate("/login");
  };

  const handleNext = () => {
    if (currentStep < onboardingData.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleFinish();
    }
  };

  const handleSkip = () => {
    handleFinish();
  };

  return (
    <div className="min-h-screen bg-gradient-secondary relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-10 w-32 h-32 bg-nack-red rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-accent rounded-full blur-3xl animate-pulse delay-700"></div>
      </div>

      {/* Logo Header - Responsive positioning */}
      <div className="absolute top-4 md:top-8 left-1/2 transform -translate-x-1/2 z-10">
        <NackLogo size="md" className="drop-shadow-lg" />
      </div>

      {/* Onboarding Steps */}
      <OnboardingStep
        {...onboardingData[currentStep]}
        currentStep={currentStep + 1}
        totalSteps={onboardingData.length}
        onNext={handleNext}
        onSkip={handleSkip}
        isLast={currentStep === onboardingData.length - 1}
      />
    </div>
  );
};

export default Onboarding;