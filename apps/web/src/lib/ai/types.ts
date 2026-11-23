export type AiProviderPreset =
  | "openrouter_system_one"
  | "self_hosted_system_one"
  | "openai_compatible";

export type DeciderProtocol =
  | "openrouter_decisions"
  | "systemone"
  | "openai_compat";

export type ExtractorProtocol =
  | "openrouter_extractions"
  | "clairic_native"
  | "openai_compat";

export interface AiPipelineConfig {
  preset: AiProviderPreset;

  // Step 1: Decider (Clef / Clef-flash / Jev / Fallback)
  deciderBaseUrl: string;
  deciderApiKey?: string;
  deciderModel: string;
  deciderProtocol: DeciderProtocol;

  // Step 2: Extractor (Clairic / Fallback)
  extractorBaseUrl: string;
  extractorApiKey?: string;
  extractorModel: string;
  extractorProtocol: ExtractorProtocol;

  // Optional on-demand text summary model (never runs automatically)
  summaryEnabled?: boolean;
  summaryBaseUrl?: string;
  summaryApiKey?: string;
  summaryModel?: string;

  // Legacy OpenAI-compatible fields (kept for seamless migration)
  baseUrl?: string;
  apiKey?: string;
  model?: string;

  // Behavior & thresholds
  orderConfidenceThreshold: number;
  receiptConfidenceThreshold: number;
  fieldConfidenceThreshold: number;
  extractAttachments: boolean;
  autoAnalyzeNewEmails: boolean;
  anonymizePii: boolean;
  developerMode: boolean;
  logoDevToken?: string;
}

export interface EmailHeaderSignals {
  hasListUnsubscribe: boolean;
  listId?: string | null;
  precedence?: string | null;
  autoSubmitted?: string | null;
  mailer?: string | null;
  attachmentNames: string[];
  hasPdfAttachment: boolean;
  hasImageAttachment: boolean;
}

export interface EmailDecisionInput {
  subject: string;
  from: string;
  text: string;
  date?: string;
  headers?: EmailHeaderSignals;
}

export interface EmailDecisionSignals {
  isOrder: number;
  isPaymentReceipt: number;
  isNewsletter: number;
  hasActionItem: number;
  hasVerificationCode: number;
  urgencyScore: number; // 0..3
  urgencyLabel: "low" | "normal" | "high" | "critical";
}

export interface EmailDecisionResult {
  category: string;
  categoryConfidence: number;
  categoryProbabilities: Record<string, number>;
  orderType: string | null;
  orderTypeConfidence: number;
  orderStage: string | null;
  orderStageConfidence: number;
  signals: EmailDecisionSignals;
  refusals: string[];
  model: string;
  provider?: string;
  protocol: DeciderProtocol;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd?: number;
  raw?: unknown;
}

export interface ExtractedFieldMeta<T = string | number | string[] | null> {
  value: T;
  confidence?: number;
  pNull?: number;
  span?: [number, number] | null;
  excerpt?: string | null;
  source?: "text" | "image" | "document" | "llm";
  uncertain?: boolean;
}

export interface EmailExtractionAttachmentAsset {
  key: string;
  filename: string;
  mimeType: string;
  format: "png" | "jpg" | "jpeg" | "webp" | "pdf";
  base64: string;
}

export interface EmailExtractionInput {
  stateText: string;
  referenceDate?: string; // YYYY-MM-DD
  imageAssets?: EmailExtractionAttachmentAsset[];
  pdfDocuments?: EmailExtractionAttachmentAsset[];
}

export interface EmailExtractionResult {
  skipped: boolean;
  skipReason?: string;
  fields: Record<string, ExtractedFieldMeta>;
  verificationCode?: ExtractedFieldMeta<string | null> | null;
  actionDeadline?: ExtractedFieldMeta<string | null> | null;
  keyTopics?: string[];
  model?: string;
  provider?: string;
  protocol?: ExtractorProtocol;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  passes?: number;
  costUsd?: number;
  truncated?: boolean;
  raw?: unknown;
}

export interface PipelineStageTelemetry {
  used: boolean;
  skipped?: boolean;
  skipReason?: string;
  model?: string;
  protocol?: string;
  durationMs: number;
  inputTokens?: number;
  outputTokens?: number;
  passes?: number;
  costUsd?: number;
}
