
import { GoogleGenAI, Type } from "@google/genai";
import { VisualStyle, LightingMode, Perspective, PromptExpansionResponse, TokenUsage, ImageGenerator } from "../types.ts";

/**
 * Utilizziamo gemini-2.5-flash come nel tuo esempio funzionante.
 * Questo modello supporta sia testo che analisi immagini (vision).
 */
const TEXT_MODEL = 'gemini-2.5-flash';
const IMAGE_GEN_MODEL = 'gemini-2.5-flash-image';

// Helper per ottenere l'API Key corretta, dando priorità a GEMINI_API_KEY
const getApiKey = () => (process.env.GEMINI_API_KEY || process.env.API_KEY) as string;

const getStyledPromptPart = (style: VisualStyle, lighting: LightingMode, perspective: Perspective) => {
  const parts = [];
  if (style !== VisualStyle.NEUTRAL) parts.push(`Preferred Style: ${style}`);
  else parts.push("Style: Neutral (follow the inherent aesthetic of the input)");
  
  if (lighting !== LightingMode.NEUTRAL) parts.push(`Lighting: ${lighting}`);
  else parts.push("Lighting: Natural/Auto (no forced lighting effects)");
  
  if (perspective !== Perspective.NEUTRAL) parts.push(`View/Lens: ${perspective}`);
  else parts.push("Perspective: Standard (no specific lens distortion)");
  
  return parts.join('\n');
};

const getGeneratorContext = (generator: ImageGenerator) => {
  switch (generator) {
    case ImageGenerator.MIDJOURNEY:
      return "Optimize for Midjourney v6. Use high-impact stylistic keywords, artistic descriptors, and end prompts with optional parameters like '--v 6.0' or '--stylize'. Focus on mood and texture.";
    case ImageGenerator.DALLE3:
      return "Optimize for DALL-E 3. Use descriptive, logical, and detailed full sentences. Focus on clarity and composition. Avoid technical jargon.";
    case ImageGenerator.FLUX:
      return "Optimize for Flux.1. Use highly descriptive natural language. Focus on hyper-realism and textures.";
    case ImageGenerator.SDXL:
      return "Optimize for Stable Diffusion XL. Use keyword-heavy formatting (tags) and specific technical terms like '8k resolution', 'highly detailed'.";
    case ImageGenerator.LEONARDO:
      return "Optimize for Leonardo AI. Use cinematic and evocative descriptors. Focus on professional digital art flair.";
    case ImageGenerator.META_AI:
      return "Optimize for Meta AI. Use a balanced mix of natural language and stylistic keywords.";
    default:
      return "Use a universal high-quality prompt format suitable for any modern image generator.";
  }
};

export const expandPrompt = async (
  seed: string, 
  style: VisualStyle, 
  lighting: LightingMode, 
  perspective: Perspective,
  isConcise: boolean,
  generator: ImageGenerator,
): Promise<PromptExpansionResponse> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const isSurprise = seed.startsWith("SURPRISE_ME:");
  
  const systemPrompt = `You are a world-class prompt architect specializing in generative AI.
  Transform basic ideas into "masterpiece-level" image generation prompts.
  
  Generator Target: ${generator}.
  ${getGeneratorContext(generator)}
  
  Visual Constraints:
  ${getStyledPromptPart(style, lighting, perspective)}
  
  Output Detail level: ${isConcise ? 'Extremely concise, minimal, keyword-driven' : 'Extended, descriptive, and immersive'}.
  
  Return ONLY a valid JSON object following the schema.`;

  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: isSurprise ? "Generate 3 random but highly creative image concepts." : seed,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          prompts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                content: { type: Type.STRING },
              },
              required: ["title", "content"]
            }
          }
        },
        required: ["prompts"]
      }
    },
  });

  const data = JSON.parse(response.text || '{"prompts": []}');
  return {
    prompts: data.prompts,
    usage: response.usageMetadata as TokenUsage
  };
};

export const extractPromptFromImage = async (
  base64Data: string,
  mimeType: string,
  style: VisualStyle,
  lighting: LightingMode,
  perspective: Perspective,
  isConcise: boolean,
  generator: ImageGenerator
): Promise<{ text: string, usage: TokenUsage }> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  
  const instruction = `Analyze this image deeply and deconstruct it into a high-fidelity text-to-image prompt.
  Target Model: ${generator}
  ${getGeneratorContext(generator)}
  Detail Level: ${isConcise ? 'Keywords only' : 'Descriptive sentences'}
  ${getStyledPromptPart(style, lighting, perspective)}
  
  Return only the prompt text.`;

  const response = await ai.models.generateContent({
    model: TEXT_MODEL, 
    contents: {
      parts: [
        { inlineData: { data: base64Data, mimeType } },
        { text: instruction }
      ]
    }
  });

  return {
    text: response.text?.trim() || "",
    usage: response.usageMetadata as TokenUsage
  };
};

export const modifyPrompt = async (currentPrompt: string, instruction: string): Promise<{ text: string, usage: TokenUsage }> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: TEXT_MODEL, 
    contents: `Original Prompt: "${currentPrompt}"\nModification Request: "${instruction}"\n\nRewrite the prompt to incorporate the changes. Return ONLY the new prompt string.`
  });
  return {
    text: response.text?.trim() || currentPrompt,
    usage: response.usageMetadata as TokenUsage
  };
};

export const generatePreviewImage = async (prompt: string): Promise<{ url: string, usage: TokenUsage }> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: IMAGE_GEN_MODEL,
    contents: { parts: [{ text: prompt }] },
    config: { imageConfig: { aspectRatio: "1:1" } },
  });

  const imagePart = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
  if (imagePart?.inlineData) {
    return {
      url: `data:image/png;base64,${imagePart.inlineData.data}`,
      usage: response.usageMetadata as TokenUsage
    };
  }
  throw new Error("Visual generation failed.");
};
