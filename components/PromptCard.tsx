
import React, { useState } from 'react';
import { GeneratedPrompt, TokenUsage } from '../types';
import { Button } from './Button';
import { modifyPrompt } from '../services/geminiService';

interface PromptCardProps {
  prompt: GeneratedPrompt;
  onGeneratePreview: (id: string, content: string) => void;
  onCopy: (content: string) => void;
  onUpdate: (id: string, newContent: string, usage?: TokenUsage) => Promise<void>; // Updated to return Promise<void>
  onBridge?: (content: string) => void;
  onError: (error: any) => Promise<void>; // Added onError prop
}

export const PromptCard: React.FC<PromptCardProps> = ({ 
  prompt, 
  onGeneratePreview, 
  onCopy, 
  onUpdate,
  onBridge,
  onError // Destructure onError
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editInstruction, setEditInstruction] = useState('');
  const [isModifying, setIsModifying] = useState(false);

  const cleanText = (text: string) => text.replace(/^(Variation|Prompt|Variation\s\d|Prompt\s\d):\s*/i, '').trim();

  const handleCopy = () => {
    onCopy(cleanText(prompt.content));
    setCopied(true);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(30);
    }
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!prompt.previewUrl) return;
    const link = document.createElement('a');
    link.href = prompt.previewUrl;
    link.download = `PromptCraft_${prompt.title.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const textToShare = cleanText(prompt.content);
    const shareData = {
      title: 'PromptCraft AI Output',
      text: textToShare,
      url: window.location.origin
    };

    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        handleCopy();
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        handleCopy();
      }
    }
  };

  const handleModify = async () => {
    if (!editInstruction.trim()) return;
    setIsModifying(true);
    try {
      const { text, usage } = await modifyPrompt(prompt.content, editInstruction);
      await onUpdate(prompt.id, text, usage); // Await onUpdate
      setIsEditing(false);
      setEditInstruction('');
    } catch (err) {
      console.error("Modification failed", err);
      await onError(err); // Call onError handler
    } finally {
      setIsModifying(false);
    }
  };

  return (
    <div className="glass rounded-2xl overflow-hidden flex flex-col h-full group transition-all duration-700 hover:shadow-[0_0_40px_rgba(255,255,255,0.05)] border border-white/5 relative">
      
      {/* Token Usage Badge */}
      {prompt.usage && (
        <div className="absolute top-4 left-0 right-0 flex justify-center z-30 pointer-events-none">
          <div className="bg-black/90 backdrop-blur-xl px-3 py-1 rounded-full border border-white/10 shadow-2xl flex items-center gap-2 transform -translate-y-2 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500">
            <span className="text-[9px] font-mono text-white">{(prompt.usage.totalTokenCount || 0).toLocaleString()} tks</span>
          </div>
        </div>
      )}

      {/* Media Display Area */}
      <div className="relative aspect-square w-full bg-black flex items-center justify-center overflow-hidden">
        {prompt.previewUrl ? (
          <div className="relative w-full h-full">
            <img 
              src={prompt.previewUrl} 
              alt={prompt.title} 
              className="w-full h-full object-cover grayscale transition-all duration-1000 group-hover:grayscale-0 group-hover:scale-105 select-none"
              onContextMenu={(e) => e.preventDefault()}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-40 group-hover:opacity-60 transition-opacity duration-300"></div>
            
            <div className="absolute bottom-4 right-4 flex gap-2 z-20 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
              <button 
                onClick={handleDownload}
                className="w-10 h-10 bg-black/60 backdrop-blur-md border border-white/20 text-white rounded-xl flex items-center justify-center hover:bg-white hover:text-black transition-all shadow-xl"
              >
                <i className="fas fa-download text-sm"></i>
              </button>
              <button 
                onClick={handleShare}
                className="w-10 h-10 bg-black/60 backdrop-blur-md border border-white/20 text-white rounded-xl flex items-center justify-center hover:bg-white hover:text-black transition-all shadow-xl"
              >
                <i className="fas fa-share-nodes text-sm"></i>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            {prompt.isGeneratingPreview ? (
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                    <div className="w-10 h-10 border-2 border-white/10 border-t-white rounded-full animate-spin"></div>
                    <i className="fas fa-cube absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white text-[10px]"></i>
                </div>
                <p className="text-white text-[9px] font-black uppercase tracking-[0.3em] animate-pulse">Rendering...</p>
              </div>
            ) : (
              <>
                <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center border border-white/5 mb-2">
                    <i className="fas fa-image text-2xl text-zinc-700"></i>
                </div>
                <Button 
                    variant="outline" 
                    className="text-[9px] py-2 px-4 border-white/10 hover:bg-white hover:text-black" 
                    onClick={() => onGeneratePreview(prompt.id, prompt.content)}
                >
                    Visualize
                </Button>
              </>
            )}
          </div>
        )}
        
        {/* Badges Overlay */}
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-20">
          <span className="px-3 py-1 bg-white text-black rounded-lg text-[9px] font-black uppercase tracking-wider shadow-lg">
            {prompt.style.split('/')[0]}
          </span>
          {prompt.sourceImageUrl && (
             <span className="px-3 py-1 bg-zinc-900/80 backdrop-blur-md rounded-lg text-[9px] font-black uppercase tracking-wider border border-white/10 text-white shadow-lg flex items-center gap-1">
               <i className="fas fa-fingerprint"></i> Scanned
             </span>
          )}
        </div>

        {prompt.type === 'vision' && onBridge && (
          <button 
            onClick={() => onBridge(prompt.content)}
            className="absolute top-4 right-4 w-9 h-9 bg-white text-black rounded-xl flex items-center justify-center shadow-2xl transition-all transform hover:scale-105 active:scale-95 z-30 border border-white/20"
          >
            <i className="fas fa-bolt-lightning text-sm"></i>
          </button>
        )}
      </div>

      {/* Content Area */}
      <div className="p-6 flex flex-col flex-grow bg-zinc-900/30">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest truncate max-w-[70%]">{prompt.title}</h3>
          <button 
            onClick={() => setIsEditing(!isEditing)} 
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${isEditing ? 'bg-white text-black' : 'text-zinc-600 hover:text-white hover:bg-white/5'}`}
          >
            <i className={`fas ${isEditing ? 'fa-xmark' : 'fa-wand-magic'} text-[10px]`}></i>
          </button>
        </div>

        {isEditing ? (
          <div className="mb-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <textarea
              className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-xs text-zinc-300 outline-none h-32 resize-none focus:border-white/50 transition-all font-medium leading-relaxed"
              placeholder="Inject modifications..."
              value={editInstruction}
              onChange={(e) => setEditInstruction(e.target.value)}
            />
            <div className="flex gap-2">
              <Button 
                variant="primary" 
                className="flex-grow py-2 text-[10px] uppercase font-black" 
                onClick={handleModify} 
                isLoading={isModifying} 
                disabled={!editInstruction.trim()}
              >
                Apply
              </Button>
              <Button variant="ghost" className="px-3 py-2 text-[10px]" onClick={() => setIsEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="relative flex-grow min-h-[100px]">
            <div className="text-zinc-400 text-xs leading-relaxed overflow-y-auto max-h-40 scrollbar-none pr-1">
              <p className="whitespace-pre-wrap">{prompt.content}</p>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-zinc-900/40 to-transparent pointer-events-none"></div>
          </div>
        )}
        
        <div className="mt-6 pt-4 border-t border-white/5">
          <Button 
            className={`w-full text-[10px] py-3 uppercase font-black tracking-[0.2em] transition-all ${copied ? 'bg-zinc-700 text-white border-white/20' : ''}`} 
            variant={copied ? 'secondary' : 'primary'} 
            onClick={handleCopy} 
            icon={<i className={`fas ${copied ? 'fa-check' : 'fa-terminal'}`}></i>}
          >
            {copied ? 'Captured' : 'Execute Copy'}
          </Button>
        </div>
      </div>
    </div>
  );
};