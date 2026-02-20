
export interface TokenUsage {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

export type GenerationType = 'text' | 'vision';

export interface GeneratedPrompt {
  id: string;
  title: string;
  content: string;
  style: string;
  previewUrl?: string;
  sourceImageUrl?: string;
  isGeneratingPreview?: boolean;
  usage?: TokenUsage;
  type: GenerationType;
}

export interface PromptExpansionResponse {
  prompts: {
    title: string;
    content: string;
  }[];
  usage: TokenUsage;
}

export const ImageGenerator = {
  UNIVERSAL: "Universal (General)",
  MIDJOURNEY: "Midjourney v6",
  DALLE3: "DALL-E 3",
  FLUX: "Flux.1 (Realism)",
  SDXL: "Stable Diffusion XL",
  LEONARDO: "Leonardo AI",
  META_AI: "Meta AI (Llama 3)"
} as const;
export type ImageGenerator = typeof ImageGenerator[keyof typeof ImageGenerator];

export const VisualStyle = {
  NEUTRAL: "Neutral / Auto",
  CINEMATIC: "Cinematic Masterpiece",
  PHOTOREALISTIC: "Hyper-Photorealistic",
  DIGITAL_ART: "Professional Digital Art",
  CYBERPUNK: "Cyberpunk / High-Tech",
  ANIME: "Modern Anime / Studio Ghibli",
  STEAMPUNK: "Steampunk / Clockwork",
  SYNTHWAVE: "Synthwave / 80s Retro",
  DOUBLE_EXPOSURE: "Double Exposure Art",
  VAPORWAVE: "Vaporwave Aesthetic",
  ISOMETRIC: "Isometric 3D Render",
  UKIYO_E: "Ukiyo-e (Japanese Woodblock)",
  POP_ART: "Pop Art / Andy Warhol",
  OIL_PAINTING: "Classic Oil Painting",
  MINIMALIST: "Minimalist / Flat Design",
  FANTASY: "High Fantasy / Epic",
  SURREALISM: "Surrealism / Dali Style",
  PIXEL_ART: "High-Def Pixel Art",
  DARK_ACADEMIA: "Dark Academia / Gothic",
  STREET_PHOTOGRAPHY: "Candid Street Photography",
  NOIR: "Film Noir / Monochrome",
  PENCIL_SKETCH: "Hand-drawn Pencil Sketch",
  WATERCOLOR: "Fluid Watercolor",
  BAROQUE: "Baroque / Ornate / Grandiose",
  CLAYMATION: "Claymation / Stop-motion",
  STAINED_GLASS: "Gothic Stained Glass",
  GLITCH_ART: "Digital Glitch Art",
  GRAFFITI: "Graffiti / Street Art",
  RENAISSANCE: "Renaissance Masterpiece",
  PLASTIC_TOY: "Plastic Toy / Vinyl Figure"
} as const;
export type VisualStyle = typeof VisualStyle[keyof typeof VisualStyle];

export const LightingMode = {
  NEUTRAL: "Neutral / Auto",
  GOLDEN_HOUR: "Golden Hour (Warm)",
  NEON_GLOW: "Neon / Cyber Glow",
  RIM_LIGHTING: "Cinematic Rim Lighting",
  VOLUMETRIC: "Volumetric Light / Tyndall",
  DAPPLED_LIGHT: "Dappled Sunbeams",
  CHIAROSCURO: "Chiaroscuro / Caravaggio",
  MOODY: "Moody & Atmospheric",
  SOFT_STUDIO: "Soft Studio / High-Key",
  NATURAL: "Natural Sunlight",
  MOONLIGHT: "Ethereal Moonlight",
  CANDLELIGHT: "Candlelight / Warm Glow",
  AURORA: "Aurora / Plasma Glow",
  BIOLUMINESCENT: "Bioluminescent / Bio-glow",
  REMBRANDT: "Rembrandt Lighting",
  GOD_RAYS: "Heavenly God Rays",
  BLACKLIGHT: "Ultraviolet / Blacklight",
  FIRE_LIGHT: "Flickering Firelight",
  FLAT_LOG: "Flat & Neutral (Raw Color)"
} as const;
export type LightingMode = typeof LightingMode[keyof typeof LightingMode];

export const Perspective = {
  NEUTRAL: "Neutral / Auto",
  WIDE_ANGLE: "Wide Angle (Contextual)",
  FISHEYE: "Extreme Fisheye (180°)",
  MACRO: "Macro / Close-up",
  LOW_ANGLE: "Low Angle (Heroic)",
  WORM_EYE: "Worm's Eye View",
  BIRD_EYE: "Bird's Eye View",
  SATELLITE: "Satellite / Orbital",
  TILT_SHIFT: "Tilt-Shift (Miniature)",
  PANORAMIC: "Extreme Panoramic",
  EYE_LEVEL: "Standard Eye Level",
  DUTCH_ANGLE: "Dutch Angle (Tilted)",
  POV: "First-Person (POV)",
  TELEPHOTO: "Telephoto Compression",
  TOP_DOWN: "Top-down (Flat Lay)",
  SIDE_PROFILE: "Side Profile Silhouette",
  DRONE_SHOT: "Dynamic Drone Shot"
} as const;
export type Perspective = typeof Perspective[keyof typeof Perspective];
