import type {
  AiProviderPreset,
  DeciderProtocol,
  ExtractorProtocol,
  EmailDecisionSignals,
  ExtractedFieldMeta,
} from "./ai/types";

export interface PaymentInfo {
  isPaymentReceipt: boolean;
  provider?: "PayPal" | "Klarna" | "Stripe" | "Apple Pay" | "Google Pay" | "Kreditkarte" | "Banküberweisung" | string | null;
  paidTo?: string | null;
  amount?: string | null;
  transactionId?: string | null;
  invoiceNumber?: string | null;
  dueDate?: string | null;
  confidence?: number;
}

export interface OrderInfo {
  isOrder: boolean;
  orderType?: "physical" | "digital" | "ticket" | "booking" | "subscription" | "service" | string | null;
  merchant?: string | null;
  orderId?: string | null;
  trackingNumber?: string | null;
  carrier?: string | null;
  productSummary?: string | null;
  amount?: string | null;
  stage?:
    | "ordered"
    | "payment_confirmed"
    | "tickets_issued"
    | "digital_delivered"
    | "shipped"
    | "out_for_delivery"
    | "delivered"
    | "return_initiated"
    | "return_dropped"
    | "returned"
    | "refunded"
    | "cancelled"
    | string
    | null;
  statusTitle?: string | null;
  statusDetail?: string | null;
  eventDate?: string | null;
  venue?: string | null;
  deliveryLocation?: string | null;
  estimatedDelivery?: string | null;
  confidence?: number;
}

export interface AiAnalysisResult {
  summary: string[];
  category: string;
  categoryConfidence?: number;
  categoryProbabilities?: Record<string, number>;
  signals?: EmailDecisionSignals;
  tags: string[];
  actionItems: {
    task: string;
    due?: string | null;
    completed?: boolean;
  }[];
  paymentInfo?: PaymentInfo | null;
  orderInfo?: OrderInfo | null;
  verificationCode?: ExtractedFieldMeta<string | null> | null;
  actionDeadline?: ExtractedFieldMeta<string | null> | null;
  extractedFields?: Record<string, ExtractedFieldMeta>;
  attachmentsAnalyzed?: {
    pdfCount: number;
    imageCount: number;
    filenames: string[];
  };
  pipeline?: {
    preset?: string;
    deciderModel?: string;
    deciderProtocol?: string;
    extractorModel?: string | null;
    extractorProtocol?: string | null;
    extractorSkipped?: boolean;
    summaryUsed?: boolean;
  };
  timestamp: number;
  _debug?: {
    model?: string;
    durationMs?: number;
    anonymizedInput?: string;
    rawOutput?: string;
    timestamp?: string;
    promptTokens?: number;
    completionTokens?: number;
    totalCostUsd?: number;
    stages?: Record<string, any>;
    decisions?: any;
    extractions?: any;
  };
}

export interface AiSettings {
  preset?: AiProviderPreset;
  deciderBaseUrl?: string;
  deciderApiKey?: string;
  deciderModel?: string;
  deciderProtocol?: DeciderProtocol;
  extractorBaseUrl?: string;
  extractorApiKey?: string;
  extractorModel?: string;
  extractorProtocol?: ExtractorProtocol;
  summaryEnabled?: boolean;
  summaryBaseUrl?: string;
  summaryApiKey?: string;
  summaryModel?: string;
  // Legacy fields retained for smooth migration
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  // Thresholds & preferences
  orderConfidenceThreshold?: number;
  receiptConfidenceThreshold?: number;
  fieldConfidenceThreshold?: number;
  extractAttachments?: boolean;
  /** Automatically analyze ONLY newly arriving emails (one by one) after initial import */
  autoAnalyzeNewEmails?: boolean;
  anonymizePii?: boolean;
  developerMode?: boolean;
  logoDevToken?: string;
}

export interface SyncBaseline {
  completedAt: number;
  maxUid: number;
  maxSeq: number;
  knownIds: string[];
}

const CACHE_PREFIX = "dopis:ai:cache:";
const SETTINGS_KEY = "dopis:ai:settings";
const BASELINE_PREFIX = "dopis:sync:baseline:";

export const DEFAULT_AI_SETTINGS: AiSettings = {
  preset: "openrouter_system_one",
  deciderBaseUrl: "https://openrouter.ai/api",
  deciderApiKey: "",
  deciderModel: "cloudflare/clef-flash",
  deciderProtocol: "openrouter_decisions",
  extractorBaseUrl: "https://openrouter.ai/api",
  extractorApiKey: "",
  extractorModel: "cloudflare/clairic",
  extractorProtocol: "openrouter_extractions",
  summaryEnabled: false,
  summaryBaseUrl: "https://openrouter.ai/api/v1",
  summaryApiKey: "",
  summaryModel: "openai/gpt-4o-mini",
  orderConfidenceThreshold: 0.55,
  receiptConfidenceThreshold: 0.55,
  fieldConfidenceThreshold: 0.65,
  extractAttachments: true,
  autoAnalyzeNewEmails: true,
  anonymizePii: true,
  developerMode: false,
  logoDevToken: "",
};

/**
 * Migrates legacy single-endpoint settings (baseUrl/apiKey/model) into the 2-stage System One schema.
 */
export function normalizeAiSettings(raw: Partial<AiSettings> = {}): AiSettings {
  const merged: AiSettings = { ...DEFAULT_AI_SETTINGS, ...raw };

  // Migrate legacy settings if preset was not explicitly set yet
  if (!raw.preset && raw.baseUrl) {
    const lower = raw.baseUrl.toLowerCase();
    if (lower.includes("openrouter.ai")) {
      merged.preset = "openrouter_system_one";
      merged.deciderBaseUrl = "https://openrouter.ai/api";
      merged.deciderProtocol = "openrouter_decisions";
      merged.deciderModel = raw.deciderModel || "cloudflare/clef-flash";
      merged.extractorBaseUrl = "https://openrouter.ai/api";
      merged.extractorProtocol = "openrouter_extractions";
      merged.extractorModel = raw.extractorModel || "cloudflare/clairic";
      merged.deciderApiKey = raw.deciderApiKey || raw.apiKey || "";
      merged.extractorApiKey = raw.extractorApiKey || raw.apiKey || "";
    } else if (lower.includes("/systemone")) {
      merged.preset = "self_hosted_system_one";
      merged.deciderBaseUrl = raw.baseUrl;
      merged.deciderProtocol = "systemone";
      merged.extractorBaseUrl = raw.extractorBaseUrl || raw.baseUrl;
      merged.extractorProtocol = raw.extractorProtocol || "clairic_native";
      merged.deciderApiKey = raw.deciderApiKey || raw.apiKey || "";
      merged.extractorApiKey = raw.extractorApiKey || raw.apiKey || "";
    } else {
      merged.preset = "openai_compatible";
      merged.deciderBaseUrl = raw.baseUrl;
      merged.deciderProtocol = "openai_compat";
      merged.deciderModel = raw.deciderModel || raw.model || "llama3.2";
      merged.extractorBaseUrl = raw.extractorBaseUrl || raw.baseUrl;
      merged.extractorProtocol = "openai_compat";
      merged.extractorModel = raw.extractorModel || raw.model || "llama3.2";
      merged.deciderApiKey = raw.deciderApiKey || raw.apiKey || "";
      merged.extractorApiKey = raw.extractorApiKey || raw.apiKey || "";
    }
  }

  if (merged.anonymizePii === undefined) merged.anonymizePii = true;
  if (merged.developerMode === undefined) merged.developerMode = false;
  if (merged.extractAttachments === undefined) merged.extractAttachments = true;
  if (merged.autoAnalyzeNewEmails === undefined) merged.autoAnalyzeNewEmails = true;

  return merged;
}

export function getAiSettings(): AiSettings {
  if (typeof window === "undefined") return { ...DEFAULT_AI_SETTINGS };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return normalizeAiSettings(parsed);
  } catch {
    return { ...DEFAULT_AI_SETTINGS };
  }
}

export function saveAiSettings(settings: AiSettings): void {
  if (typeof window === "undefined") return;
  try {
    const normalized = normalizeAiSettings(settings);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
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

export function setCachedAnalysis(id: string | number, result: Omit<AiAnalysisResult, "timestamp"> & { timestamp?: number }): void {
  if (typeof window === "undefined" || !id) return;
  try {
    const entry: AiAnalysisResult = {
      ...result,
      timestamp: result.timestamp || Date.now(),
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

/**
 * Tracks the initial import baseline per account + folder so that existing emails imported
 * during initial setup are NEVER auto-analyzed without user action, while genuinely new
 * incoming emails arriving afterwards can be analyzed automatically one by one.
 */
export function getSyncBaseline(accountEmail: string, folder = "inbox"): SyncBaseline | null {
  if (typeof window === "undefined" || !accountEmail) return null;
  try {
    const raw = localStorage.getItem(`${BASELINE_PREFIX}${accountEmail.toLowerCase()}:${folder.toLowerCase()}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSyncBaseline(accountEmail: string, folder: string, baseline: SyncBaseline): void {
  if (typeof window === "undefined" || !accountEmail) return;
  try {
    const trimmed: SyncBaseline = {
      completedAt: baseline.completedAt || Date.now(),
      maxUid: Number(baseline.maxUid) || 0,
      maxSeq: Number(baseline.maxSeq) || 0,
      knownIds: Array.isArray(baseline.knownIds) ? baseline.knownIds.slice(-1000) : [],
    };
    localStorage.setItem(
      `${BASELINE_PREFIX}${accountEmail.toLowerCase()}:${folder.toLowerCase()}`,
      JSON.stringify(trimmed)
    );
  } catch (e) {
    console.warn("Failed to persist sync baseline:", e);
  }
}

export function buildBaselineFromMails(
  mails: Array<{ id?: string | number; seq?: number; uid?: number }>
): SyncBaseline {
  let maxUid = 0;
  let maxSeq = 0;
  const knownIds: string[] = [];

  for (const m of mails || []) {
    const uid = Number(m?.uid) || 0;
    const seq = Number(m?.seq) || 0;
    if (uid > maxUid) maxUid = uid;
    if (seq > maxSeq) maxSeq = seq;
    const key = String(m?.uid || m?.id || m?.seq || "");
    if (key) knownIds.push(key);
  }

  return {
    completedAt: Date.now(),
    maxUid,
    maxSeq,
    knownIds,
  };
}

/**
 * Identifies emails that arrived AFTER the recorded baseline (i.e. genuinely new incoming emails).
 * Returns [] if no baseline exists yet (initial load must never auto-analyze existing emails).
 */
export function findNewEmailsSinceBaseline<T extends { id?: string | number; seq?: number; uid?: number }>(
  mails: T[],
  baseline: SyncBaseline | null
): T[] {
  if (!baseline || !Array.isArray(mails) || mails.length === 0) return [];

  const knownSet = new Set(baseline.knownIds || []);
  const newlyArrived: T[] = [];

  for (const m of mails) {
    const uid = Number(m?.uid) || 0;
    const seq = Number(m?.seq) || 0;
    const key = String(m?.uid || m?.id || m?.seq || "");

    if (key && knownSet.has(key)) continue;

    if (baseline.maxUid > 0 && uid > 0) {
      if (uid > baseline.maxUid) newlyArrived.push(m);
    } else if (baseline.maxSeq > 0 && seq > 0) {
      if (seq > baseline.maxSeq) newlyArrived.push(m);
    }
  }

  return newlyArrived;
}
