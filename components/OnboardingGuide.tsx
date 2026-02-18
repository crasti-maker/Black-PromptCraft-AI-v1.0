
import React, { useState } from 'react';
import { Button } from './Button';

interface OnboardingStep {
  title: string;
  description: string;
  icon: string;
  color: string;
}

const STEPS: OnboardingStep[] = [
  {
    title: "Neural Architect",
    description: "Initialize concepts into hyper-precision prompts. Use Entropy mode for randomized structural inspiration.",
    icon: "fa-terminal",
    color: "text-white"
  },
  {
    title: "Visual Deconstruct",
    description: "Reverse-engineer existing visual media into text-based blueprints using our native vision scan.",
    icon: "fa-fingerprint",
    color: "text-zinc-400"
  },
  {
    title: "Target Engine",
    description: "Calibrate output for specific synthesis models like Midjourney, DALL-E, or FLUX for optimized syntax.",
    icon: "fa-sliders",
    color: "text-zinc-500"
  }
];

interface OnboardingGuideProps {
  onComplete: () => void;
}

export const OnboardingGuide: React.FC<OnboardingGuideProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const next = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const step = STEPS[currentStep];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/95 backdrop-blur-3xl animate-in fade-in duration-700">
      <div className="glass max-w-sm w-full rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/5 flex flex-col items-center text-center p-10 relative">
        
        <div className="flex gap-2 mb-10">
          {STEPS.map((_, i) => (
            <div 
              key={i} 
              className={`h-0.5 transition-all duration-500 ${i === currentStep ? 'w-10 bg-white' : 'w-2 bg-zinc-800'}`}
            />
          ))}
        </div>

        <div className="w-24 h-24 rounded-3xl bg-zinc-900/50 border border-white/5 flex items-center justify-center mb-8 shadow-inner">
          <i className={`fas ${step.icon} text-4xl text-white`}></i>
        </div>

        <h2 className="text-3xl font-black mb-4 tracking-tighter text-white uppercase italic">
          {step.title}
        </h2>
        
        <p className="text-zinc-500 text-xs font-bold leading-relaxed mb-12 min-h-[4rem] uppercase tracking-wide">
          {step.description}
        </p>

        <div className="w-full flex flex-col gap-4">
          <Button 
            onClick={next} 
            className="w-full py-5 text-[10px] font-black uppercase tracking-[0.3em] shadow-[0_0_30px_rgba(255,255,255,0.1)]"
          >
            {currentStep === STEPS.length - 1 ? "INITIALIZE" : "NEXT MODULE"}
          </Button>
          
          <button 
            onClick={onComplete}
            className="text-[9px] text-zinc-700 hover:text-white font-black uppercase tracking-[0.4em] py-2 transition-all"
          >
            SKIP
          </button>
        </div>
      </div>
    </div>
  );
};
