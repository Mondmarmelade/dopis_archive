export interface AiAnalysisResult {
  summary: string[];
  category: string;
  tags: string[];
  actionItems: {
    task: string;
    due?: string | null;
    completed?: boolean;
  }[];
  timestamp: number;
}

export interface AiSettings {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

const CACHE_PREFIX = "dopis:ai:cache:";
const SETTINGS_KEY = "dopis:ai:settings";

export function getAiSettings(): AiSettings {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveAiSettings(settings: AiSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error("Failed to save AI settings to localStorage:", e);
  }
}

export function getCachedAnalysis(id: string | number): AiAnalysisResult | null {
  if (typeof window === "undefined" || !id) return null;
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${id}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCachedAnalysis(id: string | number, result: Omit<AiAnalysisResult, "timestamp">): void {
  if (typeof window === "undefined" || !id) return;
  try {
    const entry: AiAnalysisResult = {
      ...result,
      timestamp: Date.now(),
    };
    localStorage.setItem(`${CACHE_PREFIX}${id}`, JSON.stringify(entry));
  } catch (e) {
    console.error("Failed to save AI analysis to localStorage cache:", e);
  }
}

export function toggleCachedActionItem(id: string | number, taskIndex: number): AiAnalysisResult | null {
  const current = getCachedAnalysis(id);
  if (!current || !current.actionItems || !current.actionItems[taskIndex]) return current;

  current.actionItems[taskIndex].completed = !current.actionItems[taskIndex].completed;
  setCachedAnalysis(id, current);
  return current;
}
