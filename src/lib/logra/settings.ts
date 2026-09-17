// Ajustes de IA: motor (local en el dispositivo / nube) y tamaño de modelo.
// Todo se guarda en localStorage; no sale nada del dispositivo.
export type Engine = "local" | "cloud";
export type Tier = "light" | "balanced";

export type AISettings = {
  engine: Engine;
  tier: Tier;
};

const KEY = "logra10:ai-settings";
const DEFAULTS: AISettings = { engine: "local", tier: "light" };

const listeners = new Set<(s: AISettings) => void>();

export function getAISettings(): AISettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<AISettings>;
    return {
      engine: parsed.engine === "cloud" ? "cloud" : "local",
      tier: parsed.tier === "balanced" ? "balanced" : "light",
    };
  } catch {
    return DEFAULTS;
  }
}

export function setAISettings(next: Partial<AISettings>) {
  const merged = { ...getAISettings(), ...next };
  try {
    localStorage.setItem(KEY, JSON.stringify(merged));
  } catch {
    /* sin espacio: se usan valores por defecto */
  }
  listeners.forEach((l) => l(merged));
}

export function subscribeAISettings(fn: (s: AISettings) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const MODELS: Record<Tier, { chat: string; asr: string; label: string; size: string }> = {
  light: {
    chat: "onnx-community/Qwen2.5-0.5B-Instruct",
    asr: "Xenova/whisper-base",
    label: "Ligero",
    size: "~450 MB",
  },
  balanced: {
    chat: "onnx-community/Qwen2.5-1.5B-Instruct",
    asr: "Xenova/whisper-small",
    label: "Equilibrado",
    size: "~1,2 GB",
  },
};
