declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export const getGeminiApiKey = async (): Promise<string | null> => {
  // Se la chiave è già presente nell'ambiente, usiamola senza chiedere nulla
  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }

  // Altrimenti, controlliamo se dobbiamo chiedere all'utente
  if (typeof window !== 'undefined' && window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) {
      await window.aistudio.openSelectKey();
      return process.env.GEMINI_API_KEY || null;
    }
  }
  return process.env.GEMINI_API_KEY || null;
};

export const checkApiKey = async (): Promise<boolean> => {
  const apiKey = await getGeminiApiKey();
  return !!apiKey;
};
