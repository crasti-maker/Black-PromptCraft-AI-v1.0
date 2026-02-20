
import { GoogleGenAI, Type } from "@google/genai";
import { VisualStyle, LightingMode, Perspective, PromptExpansionResponse, TokenUsage, ImageGenerator } from "../types";

// Helper to get a fresh instance with the current process.env.API_KEY
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY as string });

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
      return "Optimize for Midjourney v6. Use high-impact stylistic keywords, artistic descriptors, and end prompts with optional parameters like '--v 6.0' or '--stylize'. Use commas to separate concepts. Focus on mood and texture.";
    case ImageGenerator.DALLE3:
      return "Optimize for DALL-E 3. Use descriptive, logical, and detailed full sentences. Explain the scene as if describing it to a master painter. Focus on clarity and composition. Avoid technical jargon.";
    case ImageGenerator.FLUX:
      return "Optimize for Flux.1. Use highly descriptive natural language. Focus on hyper-realism, textures, and if relevant, describe text that should appear in the image clearly (using quotes).";
    case ImageGenerator.SDXL:
      return "Optimize for Stable Diffusion XL. Use keyword-heavy formatting (tags), weights if necessary, and specific technical terms like '8k resolution', 'highly detailed', 'masterpiece', and 'intricate textures'.";
    case ImageGenerator.LEONARDO:
      return "Optimize for Leonardo AI. Use cinematic and evocative descriptors. Focus on mood, specialized lighting terms, and creative flair suitable for professional digital art.";
    case ImageGenerator.META_AI:
      return "Optimize for Meta AI (Llama 3 Image Gen). Use a balanced mix of natural language and stylistic keywords. Focus on clear subject description and environmental context.";
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
  const ai = getAI();
  const isSurprise = seed.startsWith("SURPRISE_ME:");
  // Use 'gemini-flash-latest' for text tasks as it maps to the most recent flash version.
  const modelName = 'gemini-flash-latest'; 
  
  const systemPrompt = `You are a world-class prompt architect specializing in generative AI.
  Your goal is to transform basic ideas into "masterpiece-level" image generation prompts.
  
  ${isSurprise 
    ? "Generate 3 completely unique, cinematic, and diverse concepts from scratch. Think outside the box." 
    : "Expand the user's seed into 3 professional, high-fidelity image generation prompts."}
  
  Rules for expansion:
  1. Describe the subject with vivid, high-end adjectives.
  2. Define the environment, atmosphere, and background in detail.
  3. Specify materials, textures, and fine details.
  4. Use professional photography or digital art terminology.
  
  Return ONLY a valid JSON object.
  
  Generator Target: ${generator}.
  ${getGeneratorContext(generator)}
  
  Visual Constraints:
  ${getStyledPromptPart(style, lighting, perspective)}
  
  Output Detail level: ${isConcise ? 'Extremely concise, minimal, keyword-driven (tokens)' : 'Extended, descriptive, and immersive (natural language)'}.`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: isSurprise ? "Generate 3 random masterpiece prompts." : seed,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 0 },
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
  const ai = getAI();
  const instruction = `Analyze this image deeply. Deconstruct it into a high-fidelity text-to-image prompt.
  Capture the core subject, the style, the color palette, and the specific lighting.
  
  Target Model: ${generator}
  ${getGeneratorContext(generator)}
  Detail Level: ${isConcise ? 'Extremely concise keywords' : 'Descriptive and atmospheric sentences'}
  ${getStyledPromptPart(style, lighting, perspective)}
  
  Return ONLY the prompt text. No preamble.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image', 
    contents: {
      parts: [
        { inlineData: { data: base64Data, mimeType } },
        { text: instruction }
      ]
    },
    config: { 
      temperature: 0.4,
      thinkingConfig: { thinkingBudget: 0 }
    }
  });

  return {
    text: response.text?.trim() || "",
    usage: response.usageMetadata as TokenUsage
  };
};

export const modifyPrompt = async (currentPrompt: string, instruction: string): Promise<{ text: string, usage: TokenUsage }> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-flash-latest', 
    contents: `Original Prompt: "${currentPrompt}"\nModification Request: "${instruction}"\n\nRewrite the prompt to perfectly incorporate the changes while maintaining the high-quality technical structure. Return ONLY the new prompt string.`,
    config: {
        temperature: 0.7,
        thinkingConfig: { thinkingBudget: 0 }
    }
  });
  return {
    text: response.text?.trim() || currentPrompt,
    usage: response.usageMetadata as TokenUsage
  };
};

export const generatePreviewImage = async (prompt: string): Promise<{ url: string, usage: TokenUsage }> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
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
