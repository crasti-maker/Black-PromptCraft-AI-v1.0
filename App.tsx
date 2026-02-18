
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { VisualStyle, LightingMode, Perspective, GeneratedPrompt, TokenUsage, ModelType, ImageGenerator } from './types';
import { expandPrompt, generatePreviewImage, extractPromptFromImage } from './services/geminiService';
import { Button } from './components/Button';
import { PromptCard } from './components/PromptCard';
import { OnboardingGuide } from './components/OnboardingGuide';

type InputMode = 'generate' | 'extract';

const DAILY_TOKEN_LIMIT = 2000000;
const STORAGE_KEY = 'promptcraft_v4_storage';
const ONBOARDING_KEY = 'promptcraft_v4_onboarded';
const MAX_SAVED_ITEMS = 8;

const App: React.FC = () => {
  const [mode, setMode] = useState<InputMode>('generate');
  const [seed, setSeed] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<VisualStyle>(VisualStyle.NEUTRAL);
  const [selectedLighting, setSelectedLighting] = useState<LightingMode>(LightingMode.NEUTRAL);
  const [selectedPerspective, setSelectedPerspective] = useState<Perspective>(Perspective.NEUTRAL);
  const [selectedGenerator, setSelectedGenerator] = useState<ImageGenerator>(ImageGenerator.UNIVERSAL);
  const [isConcise, setIsConcise] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  const [results, setResults] = useState<GeneratedPrompt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sessionTokens, setSessionTokens] = useState(0);
  const [isDiceRolling, setIsDiceRolling] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasUserKey, setHasUserKey] = useState(false);
  const [aiModel, setAiModel] = useState<ModelType>('flash');
  
  const [activeImageData, setActiveImageData] = useState<{base64: string, mimeType: string} | null>(null);
  const [isSettingsDirty, setIsSettingsDirty] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const getStorage = (key: string) => {
      try { 
        if (typeof window === 'undefined' || !window.localStorage) return null;
        return localStorage.getItem(key); 
      } catch (e) { return null; }
    };

    const onboardingComplete = getStorage(ONBOARDING_KEY);
    if (!onboardingComplete) setShowOnboarding(true);

    const checkKey = async () => {
      try {
        if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
          const selected = await window.aistudio.hasSelectedApiKey();
          setHasUserKey(selected);
        }
      } catch (e) {}
    };
    checkKey();

    const saved = getStorage(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.results) setResults(parsed.results);
        if (parsed.sessionTokens) setSessionTokens(parsed.sessionTokens);
      } catch (e) { 
        try { localStorage.removeItem(STORAGE_KEY); } catch (err) {}
      }
    }
  }, []);

  useEffect(() => {
    const saveToStorage = () => {
      try {
        if (typeof window === 'undefined' || !window.localStorage) return;
        const sanitized = results.slice(0, MAX_SAVED_ITEMS);
        const data = JSON.stringify({ results: sanitized, sessionTokens });
        localStorage.setItem(STORAGE_KEY, data);
      } catch (e) {}
    };
    const timeout = setTimeout(saveToStorage, 1000);
    return () => clearTimeout(timeout);
  }, [results, sessionTokens]);

  useEffect(() => {
    if (activeImageData && mode === 'extract') setIsSettingsDirty(true);
  }, [selectedStyle, selectedLighting, selectedPerspective, isConcise, selectedGenerator]);

  const handleSelectKey = async () => {
    try {
      if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
        await window.aistudio.openSelectKey();
        setHasUserKey(true);
      }
    } catch (e) {
      setError("Selector error.");
    }
  };

  const handleOnboardingComplete = () => {
    try { localStorage.setItem(ONBOARDING_KEY, 'true'); } catch (e) {}
    setShowOnboarding(false);
  };

  const updateTokens = (usage?: TokenUsage) => {
    if (usage?.totalTokenCount) {
      setSessionTokens(prev => prev + usage.totalTokenCount);
    }
  };

  const handleExpand = async (isRandom = false) => {
    if (aiModel === 'pro' && !hasUserKey) {
      const confirmLogin = window.confirm("Gemini 3 Pro requires API Key authentication. Proceed?");
      if (confirmLogin) await handleSelectKey();
      return;
    }

    const effectiveSeed = isRandom ? "SURPRISE_ME: Unique masterpiece" : seed;
    if (!effectiveSeed.trim() && !isRandom) return;
    
    if (isRandom) {
      setIsDiceRolling(true);
      setTimeout(() => setIsDiceRolling(false), 800);
    }

    setIsExpanding(true);
    setError(null);
    try {
      const response = await expandPrompt(effectiveSeed, selectedStyle, selectedLighting, selectedPerspective, isConcise, selectedGenerator, aiModel);
      updateTokens(response.usage);
      const newResults: GeneratedPrompt[] = response.prompts.map((p, idx) => ({
        id: `${Date.now()}-${idx}`,
        title: p.title,
        content: p.content,
        style: selectedStyle,
        isGeneratingPreview: false,
        usage: idx === 0 ? response.usage : undefined,
        type: 'text'
      }));
      setResults(prev => [...newResults, ...prev].slice(0, 20));
      if (!isRandom) setSeed('');
    } catch (err: any) {
      setError("AI Engine offline or network timeout.");
    } finally {
      setIsExpanding(false);
    }
  };

  const runVisionAnalysis = async (imgData: {base64: string, mimeType: string}) => {
    setIsExpanding(true);
    setError(null);
    try {
      const data = imgData.base64.split(',')[1];
      const { text, usage } = await extractPromptFromImage(
        data, imgData.mimeType, selectedStyle, selectedLighting, selectedPerspective, isConcise, selectedGenerator
      );
      updateTokens(usage);
      const newResult: GeneratedPrompt = {
        id: `${Date.now()}-vision`,
        title: "Structure Extract",
        content: text,
        style: selectedStyle,
        sourceImageUrl: imgData.base64,
        isGeneratingPreview: false,
        usage,
        type: 'vision'
      };
      setResults(prev => [newResult, ...prev].slice(0, 20));
      setIsSettingsDirty(false);
    } catch (err: any) {
      setError("Vision analysis failed.");
    } finally {
      setIsExpanding(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Max size: 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        const data = { base64, mimeType: file.type };
        setActiveImageData(data);
        runVisionAnalysis(data);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGeneratePreview = async (id: string, content: string) => {
    setResults(prev => prev.map(p => p.id === id ? { ...p, isGeneratingPreview: true } : p));
    try {
      const { url, usage } = await generatePreviewImage(content);
      updateTokens(usage);
      setResults(prev => prev.map(p => p.id === id ? { ...p, previewUrl: url, isGeneratingPreview: false } : p));
    } catch (err: any) {
      setError("Generation filtered or failed.");
      setResults(prev => prev.map(p => p.id === id ? { ...p, isGeneratingPreview: false } : p));
    }
  };

  const stats = useMemo(() => {
    const used = (sessionTokens / DAILY_TOKEN_LIMIT) * 100;
    return { remaining: Math.max(0, DAILY_TOKEN_LIMIT - sessionTokens), percent: used };
  }, [sessionTokens]);

  return (
    <div className="min-h-[100dvh] flex flex-col relative selection:bg-white/20">
      {showOnboarding && <OnboardingGuide onComplete={handleOnboardingComplete} />}
      
      <header className="sticky top-0 z-[100] glass border-b border-white/5 py-4 md:py-6 px-4 md:px-12 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-2xl flex items-center justify-center shadow-2xl group hover:rotate-12 transition-all cursor-pointer">
            <i className="fas fa-terminal text-black text-lg md:text-xl group-hover:scale-110 transition-transform"></i>
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tighter uppercase leading-none">
              PROMPT<span className="text-zinc-500">CRAFT</span>
            </h1>
            <p className="text-[8px] md:text-[9px] text-zinc-600 font-black uppercase tracking-[0.4em]">Monochrome OS v4</p>
          </div>
        </div>

        <div className="flex items-center gap-4 md:gap-8">
          <nav className="hidden lg:flex items-center gap-1 bg-zinc-900/50 p-1.5 rounded-2xl border border-white/5">
            <button onClick={() => setMode('generate')} className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'generate' ? 'bg-white text-black' : 'text-zinc-600 hover:text-zinc-400'}`}>Architect</button>
            <button onClick={() => setMode('extract')} className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'extract' ? 'bg-white text-black' : 'text-zinc-600 hover:text-zinc-400'}`}>Deconstruct</button>
          </nav>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={handleSelectKey}
              className={`flex items-center gap-3 px-5 py-3 rounded-xl border transition-all font-black text-[10px] uppercase tracking-widest ${hasUserKey ? 'bg-white/5 border-white/20 text-white' : 'bg-white text-black hover:bg-zinc-200'}`}
            >
              {hasUserKey ? <><i className="fas fa-shield-check"></i> <span>SECURE</span></> : <><i className="fas fa-lock-open"></i> <span>AUTH</span></>}
            </button>
            
            <div className="hidden md:flex flex-col items-end gap-1">
              <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Network Load</span>
              <div className="w-32 h-1 bg-zinc-900 rounded-full overflow-hidden">
                <div className="h-full bg-white transition-all duration-1000 ease-out" style={{ width: `${Math.min(100, stats.percent)}%` }} />
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="lg:hidden flex border-b border-white/5 bg-black/40 p-1">
        <button onClick={() => setMode('generate')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'generate' ? 'text-white border-b-2 border-white' : 'text-zinc-600'}`}>Architect</button>
        <button onClick={() => setMode('extract')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'extract' ? 'text-white border-b-2 border-white' : 'text-zinc-600'}`}>Deconstruct</button>
      </div>

      <main className="flex-grow container mx-auto px-6 md:px-12 py-12 md:py-24">
        <section className="max-w-4xl mx-auto mb-16 md:mb-32">
          <div className="text-center mb-12 md:mb-20 space-y-6">
             <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.6em]">System Protocol 00-F</span>
             <h2 className="text-5xl md:text-8xl font-black tracking-tighter leading-none uppercase">
               {mode === 'generate' ? "Define Your" : "Break Down"}<br />
               <span className="gradient-text">{mode === 'generate' ? "Concepts" : "Images"}</span>
             </h2>
          </div>
          
          <div className="space-y-8">
            {mode === 'generate' && (
              <div className="flex justify-center mb-[-1.5rem]">
                <div className="bg-zinc-900/50 p-1.5 rounded-2xl border border-white/5 flex gap-1">
                  <button onClick={() => setAiModel('flash')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${aiModel === 'flash' ? 'bg-white text-black' : 'text-zinc-600 hover:text-zinc-400'}`}>
                    <i className="fas fa-bolt"></i> <span>FLASH</span>
                  </button>
                  <button onClick={() => setAiModel('pro')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${aiModel === 'pro' ? 'bg-white text-black shadow-lg' : 'text-zinc-600 hover:text-zinc-400'}`}>
                    <i className="fas fa-microchip"></i> <span>PRO</span>
                  </button>
                </div>
              </div>
            )}

            <div className={`glass p-4 md:p-6 rounded-[2rem] flex flex-col md:flex-row items-stretch gap-4 shadow-2xl transition-all duration-700 border-white/10 ${mode === 'extract' ? 'bg-zinc-900/30 ring-1 ring-white/10' : ''}`}>
              {mode === 'generate' ? (
                <div className="flex flex-col flex-grow gap-4">
                  <div className="flex flex-col md:flex-row items-stretch gap-4">
                    <div className="flex-grow flex items-center px-6 py-5 relative bg-black/60 rounded-3xl border border-white/5 focus-within:border-white/40 transition-colors">
                      <input 
                        type="text" 
                        placeholder="Inject prompt seed..." 
                        className="bg-transparent border-none outline-none w-full text-white placeholder:text-zinc-700 text-lg md:text-2xl font-bold pr-12" 
                        value={seed} 
                        onChange={(e) => setSeed(e.target.value)} 
                        onKeyDown={(e) => e.key === 'Enter' && handleExpand(false)} 
                      />
                      <button onClick={() => handleExpand(true)} className={`absolute right-6 text-zinc-600 hover:text-white transition-all ${isDiceRolling ? 'dice-roll text-white scale-110' : ''}`} disabled={isExpanding}>
                        <i className="fas fa-dice-six text-2xl"></i>
                      </button>
                    </div>
                    <Button 
                      onClick={() => handleExpand(false)} 
                      isLoading={isExpanding} 
                      disabled={!seed.trim()} 
                      className="w-full md:w-64 py-5 rounded-3xl text-xs uppercase font-black tracking-[0.2em]"
                    >
                      FORGE OUTPUT
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex-grow flex flex-col md:flex-row items-center gap-4">
                  <div className="w-full md:w-32 h-44 md:h-28 bg-zinc-900 rounded-[2rem] overflow-hidden border border-white/10 flex items-center justify-center cursor-pointer hover:border-white/40 group shrink-0 relative transition-all" onClick={() => fileInputRef.current?.click()}>
                    {activeImageData ? (
                      <img src={activeImageData.base64} alt="Source" className="w-full h-full object-cover grayscale transition-all group-hover:grayscale-0 group-hover:scale-110" />
                    ) : (
                      <i className="fas fa-fingerprint text-3xl text-zinc-700 group-hover:text-white"></i>
                    )}
                  </div>
                  <div className="flex-grow w-full h-28 border-2 border-dashed border-zinc-800 rounded-[2rem] flex items-center justify-center cursor-pointer hover:border-white/40 hover:bg-white/5 group px-8 text-center" onClick={() => fileInputRef.current?.click()}>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                    <div className="flex items-center gap-4 text-zinc-600 group-hover:text-white transition-colors">
                      <i className="fas fa-plus text-3xl"></i>
                      <span className="font-black text-[10px] md:text-xs uppercase tracking-[0.3em]">{activeImageData ? 'Replace Reference' : 'Load Neural Reference'}</span>
                    </div>
                  </div>
                  {activeImageData && (
                    <Button onClick={() => runVisionAnalysis(activeImageData)} isLoading={isExpanding} variant={isSettingsDirty ? 'primary' : 'outline'} className="w-full md:w-60 h-28 rounded-[2rem]">
                      {isSettingsDirty ? 'Re-Analyze' : 'Scan'}
                    </Button>
                  )}
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: 'Style', val: selectedStyle, set: setSelectedStyle, opt: VisualStyle },
                { label: 'Lighting', val: selectedLighting, set: setSelectedLighting, opt: LightingMode },
                { label: 'Lens', val: selectedPerspective, set: setSelectedPerspective, opt: Perspective },
                { label: 'Engine', val: selectedGenerator, set: setSelectedGenerator, opt: ImageGenerator },
              ].map((group) => (
                <div key={group.label} className="glass p-4 rounded-3xl border-white/5 group hover:border-white/20 transition-all">
                  <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest block mb-2">{group.label}</label>
                  <select className="bg-transparent text-[10px] md:text-[11px] font-black text-zinc-400 w-full outline-none cursor-pointer appearance-none uppercase" value={group.val} onChange={(e) => group.set(e.target.value as any)}>
                    {Object.values(group.opt).map(s => <option key={s} value={s} className="bg-black text-white">{s}</option>)}
                  </select>
                </div>
              ))}
              <button onClick={() => setIsConcise(!isConcise)} className={`glass p-4 rounded-3xl border-white/5 flex flex-col justify-center transition-all ${isConcise ? 'bg-white/5' : 'hover:bg-white/5'}`}>
                <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">Density</span>
                <span className={`text-[11px] font-black uppercase ${isConcise ? 'text-white' : 'text-zinc-500'}`}>{isConcise ? 'RAW' : 'DESC'}</span>
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
          {results.map((result) => (
            <PromptCard 
              key={result.id} 
              prompt={result} 
              onGeneratePreview={handleGeneratePreview} 
              onCopy={(text) => navigator.clipboard.writeText(text)} 
              onUpdate={(id, content, usage) => {
                updateTokens(usage);
                setResults(prev => prev.map(p => p.id === id ? { ...p, content } : p));
              }}
              onBridge={(content) => {
                setSeed(content);
                setMode('generate');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          ))}
        </section>
      </main>

      <footer className="py-20 border-t border-white/5 mt-32 bg-black/50">
        <div className="container mx-auto px-8 flex flex-col items-center">
            <div className="flex gap-12 mb-12 grayscale opacity-40 hover:opacity-100 transition-opacity">
                <i className="fab fa-discord text-2xl cursor-pointer hover:text-white"></i>
                <i className="fab fa-github text-2xl cursor-pointer hover:text-white"></i>
                <i className="fas fa-at text-2xl cursor-pointer hover:text-white"></i>
            </div>
            <p className="text-[10px] font-black text-zinc-800 uppercase tracking-[0.6em] text-center">
              SYSTEM PROMPTCRAFT &bull; ALL RIGHTS RESERVED &bull; MMXXV
            </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
