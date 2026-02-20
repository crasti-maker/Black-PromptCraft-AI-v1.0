
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { VisualStyle, LightingMode, Perspective, GeneratedPrompt, TokenUsage, ImageGenerator } from './types';
import { expandPrompt, generatePreviewImage, extractPromptFromImage } from './services/geminiService';
import { Button } from './components/Button';
import { PromptCard } from './components/PromptCard';
import { OnboardingGuide } from './components/OnboardingGuide';

type InputMode = 'generate' | 'extract';

const DAILY_TOKEN_LIMIT = 2000000;
const STORAGE_KEY = 'promptcraft_v4_storage';
const ONBOARDING_KEY = 'promptcraft_v4_onboarded';
const MAX_SAVED_ITEMS = 12;

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
  const [isDragging, setIsDragging] = useState(false);

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

    const saved = getStorage(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.results) setResults(parsed.results);
        if (parsed.sessionTokens) setSessionTokens(parsed.sessionTokens);
      } catch (e) { 
        console.error("Error parsing saved state:", e);
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
      } catch (e) {
        console.error("Error saving state to local storage:", e);
      }
    };
    const timeout = setTimeout(saveToStorage, 1000);
    return () => clearTimeout(timeout);
  }, [results, sessionTokens]);

  useEffect(() => {
    if (activeImageData && mode === 'extract') setIsSettingsDirty(true);
  }, [selectedStyle, selectedLighting, selectedPerspective, isConcise, selectedGenerator, activeImageData, mode]);

  const handleOnboardingComplete = () => {
    try { localStorage.setItem(ONBOARDING_KEY, 'true'); } catch (e) { console.error("Error setting onboarding complete:", e); }
    setShowOnboarding(false);
  };

  const updateTokens = (usage?: TokenUsage) => {
    if (usage?.totalTokenCount) {
      setSessionTokens(prev => prev + usage.totalTokenCount);
    }
  };

  const handleErrorAndKeyCheck = async (err: any) => {
    console.error("API call failed:", err);
    setError(err.message || "AI Engine offline or network timeout.");
  };

  const handleExpand = async (isRandom = false) => {
    if (!process.env.API_KEY) {
      setError("API Key not configured.");
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
      const response = await expandPrompt(effectiveSeed, selectedStyle, selectedLighting, selectedPerspective, isConcise, selectedGenerator); 
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
      setResults(prev => [...newResults, ...prev].slice(0, 30));
      if (!isRandom) setSeed('');
    } catch (err: any) {
      await handleErrorAndKeyCheck(err);
    } finally {
      setIsExpanding(false);
    }
  };

  const processImage = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setError("Max size: 10MB for image analysis.");
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
  };

  const runVisionAnalysis = async (imgData: {base64: string, mimeType: string}) => {
    if (!process.env.API_KEY) {
      setError("API Key not configured.");
      return;
    }

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
      setResults(prev => [newResult, ...prev].slice(0, 30));
      setIsSettingsDirty(false);
    } catch (err: any) {
      await handleErrorAndKeyCheck(err);
    } finally {
      setIsExpanding(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setMode('extract');
      processImage(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
  };

  const handleGeneratePreview = async (id: string, content: string) => {
    if (!process.env.API_KEY) {
      setError("API Key not configured.");
      return;
    }

    setResults(prev => prev.map(p => p.id === id ? { ...p, isGeneratingPreview: true } : p));
    try {
      const { url, usage } = await generatePreviewImage(content);
      updateTokens(usage);
      setResults(prev => prev.map(p => p.id === id ? { ...p, previewUrl: url, isGeneratingPreview: false } : p));
    } catch (err: any) {
      await handleErrorAndKeyCheck(err);
      setResults(prev => prev.map(p => p.id === id ? { ...p, isGeneratingPreview: false } : p));
    }
  };

  const stats = useMemo(() => {
    const used = (sessionTokens / DAILY_TOKEN_LIMIT) * 100;
    return { remaining: Math.max(0, DAILY_TOKEN_LIMIT - sessionTokens), percent: used };
  }, [sessionTokens]);

  return (
    <div 
      className="min-h-[100dvh] flex flex-col relative selection:bg-white/20 transition-colors duration-300"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {showOnboarding && <OnboardingGuide onComplete={handleOnboardingComplete} />}
      
      {isDragging && (
        <div className="fixed inset-0 z-[1000] bg-white/10 backdrop-blur-xl flex items-center justify-center border-[10px] border-dashed border-white/20 m-4 rounded-[3rem] pointer-events-none animate-in fade-in duration-300">
          <div className="flex flex-col items-center gap-8">
            <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center animate-bounce shadow-[0_0_50px_rgba(255,255,255,0.4)]">
              <i className="fas fa-cloud-arrow-up text-black text-5xl"></i>
            </div>
            <p className="text-4xl font-black uppercase tracking-[0.2em] text-white text-center">Neural Injection Detected</p>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-[100] glass border-b border-white/5 py-4 md:py-6 px-4 md:px-12 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-2xl flex items-center justify-center shadow-2xl group hover:rotate-12 transition-all cursor-pointer">
            <i className="fas fa-terminal text-black text-lg md:text-xl group-hover:scale-110 transition-transform"></i>
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tighter uppercase leading-none">
              PROMPT<span className="text-zinc-500">CRAFT</span>
            </h1>
            <p className="text-[8px] md:text-[9px] text-zinc-600 font-black uppercase tracking-[0.4em]">Neural OS v4.2</p>
          </div>
        </div>

        <div className="flex items-center gap-4 md:gap-8">
          <nav className="hidden lg:flex items-center gap-1 bg-zinc-900/50 p-1.5 rounded-2xl border border-white/5">
            <button onClick={() => setMode('generate')} className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'generate' ? 'bg-white text-black' : 'text-zinc-600 hover:text-zinc-400'}`}>Architect</button>
            <button onClick={() => setMode('extract')} className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'extract' ? 'bg-white text-black' : 'text-zinc-600 hover:text-zinc-400'}`}>Deconstruct</button>
          </nav>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end gap-1">
              <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Model Load</span>
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
             <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.6em] animate-pulse">Neural Engine Active</span>
             <h2 className="text-5xl md:text-8xl font-black tracking-tighter leading-none uppercase">
               {mode === 'generate' ? "Synthesize" : "Reverse"}<br />
               <span className="gradient-text">{mode === 'generate' ? "Prompts" : "Vision"}</span>
             </h2>
             {error && (
                <div role="alert" className="mt-4 px-6 py-3 bg-red-900/40 border border-red-700 text-red-300 rounded-xl text-xs font-medium max-w-lg mx-auto animate-in fade-in slide-in-from-top-2 duration-300">
                  <i className="fas fa-triangle-exclamation mr-2"></i> {error}
                </div>
              )}
          </div>
          
          <div className="space-y-8">
            <div className={`glass p-4 md:p-6 rounded-[2rem] flex flex-col md:flex-row items-stretch gap-4 shadow-2xl transition-all duration-700 border-white/10 ${mode === 'extract' ? 'bg-zinc-900/30 ring-1 ring-white/10' : ''}`}>
              {mode === 'generate' ? (
                <div className="flex flex-col flex-grow gap-4">
                  <div className="flex flex-col md:flex-row items-stretch gap-4">
                    <div className="flex-grow flex items-center px-6 py-5 relative bg-black/60 rounded-3xl border border-white/5 focus-within:border-white/40 transition-colors">
                      <input 
                        type="text" 
                        placeholder="Describe your vision..." 
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
                      <i className="fas fa-cloud-arrow-up text-3xl"></i>
                      <div className="flex flex-col items-start">
                        <span className="font-black text-[10px] md:text-xs uppercase tracking-[0.3em]">{activeImageData ? 'Replace Reference' : 'Load Neural Reference'}</span>
                        <span className="text-[8px] text-zinc-500 uppercase mt-1">Drag and Drop Support Active</span>
                      </div>
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
              <button onClick={() => setIsConcise(!isConcise)} className={`glass p-4 rounded-3xl border-white/5 flex flex-col justify-center transition-all ${isConcise ? 'bg-white/5 shadow-inner' : 'hover:bg-white/5'}`}>
                <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">Density</span>
                <span className={`text-[11px] font-black uppercase ${isConcise ? 'text-white' : 'text-zinc-500'}`}>{isConcise ? 'SHORT' : 'EXTENDED'}</span>
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          {results.map((result) => (
            <PromptCard 
              key={result.id} 
              prompt={result} 
              onGeneratePreview={handleGeneratePreview} 
              onCopy={(text) => {
                navigator.clipboard.writeText(text);
              }} 
              onUpdate={async (id, content, usage) => { 
                updateTokens(usage);
                setResults(prev => prev.map(p => p.id === id ? { ...p, content } : p));
              }}
              onBridge={(content) => {
                setSeed(content);
                setMode('generate');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onError={(err: any) => handleErrorAndKeyCheck(err)} 
            />
          ))}
          {results.length === 0 && !isExpanding && (
            <div className="col-span-full py-32 flex flex-col items-center opacity-20">
               <i className="fas fa-ghost text-6xl mb-6"></i>
               <p className="text-[10px] font-black uppercase tracking-[0.6em]">Awaiting Neural Seed</p>
            </div>
          )}
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
              SYSTEM PROMPTCRAFT &bull; POWERED BY GEMINI 2.5 FLASH &bull; MMXXV
            </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
