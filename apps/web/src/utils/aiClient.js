import OpenAI from "openai";
import { validateAiUrl } from "./networkGuard.js";

function envVar(key) {
  if (typeof import.meta !== "undefined" && import.meta.env?.[key]) {
    return import.meta.env[key];
  }
  if (typeof process !== "undefined" && process.env?.[key]) {
    return process.env[key];
  }
  return undefined;
}

/**
 * Infers the best decider protocol from a base URL and optional preset.
 */
export function inferDeciderProtocol(baseUrl = "", preset = "") {
  const lower = String(baseUrl || "").toLowerCase();
  if (preset === "openrouter_system_one" || lower.includes("openrouter.ai")) {
    return "openrouter_decisions";
  }
  if (preset === "self_hosted_system_one" || lower.includes("/systemone") || lower.includes("/decisions")) {
    return "systemone";
  }
  return "openai_compat";
}

/**
 * Infers the best extractor protocol from a base URL and optional preset.
 */
export function inferExtractorProtocol(baseUrl = "", preset = "") {
  const lower = String(baseUrl || "").toLowerCase();
  if (preset === "openrouter_system_one" || lower.includes("openrouter.ai")) {
    return "openrouter_extractions";
  }
  if (preset === "self_hosted_system_one" || lower.includes("/extractions") || lower.includes("clairic")) {
    return "clairic_native";
  }
  return "openai_compat";
}

/**
 * Resolves the full 2-stage System One pipeline configuration from client overrides + env defaults,
 * while staying 100% backwards-compatible with legacy AI_BASE_URL / AI_API_KEY / AI_MODEL settings.
 */
export function resolvePipelineConfig(overrides = {}) {
  const openRouterEnvKey = envVar("OPENROUTER_API_KEY");
  const legacyBaseUrl = overrides.baseURL || overrides.baseUrl || envVar("AI_BASE_URL");
  const legacyApiKey = overrides.apiKey || envVar("AI_API_KEY");
  const legacyModel = overrides.model || envVar("AI_MODEL");

  // Determine preset
  let preset = overrides.preset;
  if (!preset) {
    if (
      overrides.deciderBaseUrl?.toLowerCase().includes("openrouter.ai") ||
      legacyBaseUrl?.toLowerCase().includes("openrouter.ai") ||
      (!legacyBaseUrl && openRouterEnvKey)
    ) {
      preset = "openrouter_system_one";
    } else if (
      overrides.deciderProtocol === "systemone" ||
      overrides.deciderBaseUrl?.toLowerCase().includes("/systemone")
    ) {
      preset = "self_hosted_system_one";
    } else if (legacyBaseUrl) {
      preset = "openai_compatible";
    } else {
      preset = "openrouter_system_one";
    }
  }

  const defaultBaseUrl =
    preset === "openrouter_system_one"
      ? "https://openrouter.ai/api"
      : preset === "self_hosted_system_one"
      ? "http://localhost:30000/v1"
      : "http://localhost:11434/v1";

  const candidateDeciderUrl =
    overrides.deciderBaseUrl ||
    legacyBaseUrl ||
    envVar("AI_DECIDER_BASE_URL") ||
    defaultBaseUrl;

  const deciderCheck = validateAiUrl(candidateDeciderUrl);
  if (!deciderCheck.valid) {
    throw new Error(`Ungültige oder unzulässige Decider-URL: ${deciderCheck.error}`);
  }

  const candidateExtractorUrl =
    overrides.extractorBaseUrl ||
    overrides.deciderBaseUrl ||
    legacyBaseUrl ||
    envVar("AI_EXTRACTOR_BASE_URL") ||
    defaultBaseUrl;

  const extractorCheck = validateAiUrl(candidateExtractorUrl);
  if (!extractorCheck.valid) {
    throw new Error(`Ungültige oder unzulässige Extractor-URL: ${extractorCheck.error}`);
  }

  const deciderProtocol =
    overrides.deciderProtocol || inferDeciderProtocol(deciderCheck.url, preset);
  const extractorProtocol =
    overrides.extractorProtocol || inferExtractorProtocol(extractorCheck.url, preset);

  const deciderApiKey =
    overrides.deciderApiKey ||
    legacyApiKey ||
    (deciderProtocol === "openrouter_decisions" ? openRouterEnvKey : undefined) ||
    "ollama";

  const extractorApiKey =
    overrides.extractorApiKey ||
    overrides.deciderApiKey ||
    legacyApiKey ||
    (extractorProtocol === "openrouter_extractions" ? openRouterEnvKey : undefined) ||
    "ollama";

  const defaultDeciderModel =
    deciderProtocol === "openrouter_decisions"
      ? "cloudflare/clef-flash"
      : deciderProtocol === "systemone"
      ? "clef-flash"
      : legacyModel || "llama3.2";

  const defaultExtractorModel =
    extractorProtocol === "openrouter_extractions"
      ? "cloudflare/clairic"
      : extractorProtocol === "clairic_native"
      ? "clairic"
      : legacyModel || "llama3.2";

  const deciderModel =
    overrides.deciderModel ||
    envVar("AI_DECIDER_MODEL") ||
    (deciderProtocol === "openai_compat" ? legacyModel : undefined) ||
    defaultDeciderModel;

  const extractorModel =
    overrides.extractorModel ||
    envVar("AI_EXTRACTOR_MODEL") ||
    (extractorProtocol === "openai_compat" ? legacyModel : undefined) ||
    defaultExtractorModel;

  // Optional on-demand text summary endpoint
  let summaryBaseUrl = overrides.summaryBaseUrl || envVar("AI_SUMMARY_BASE_URL");
  if (summaryBaseUrl) {
    const summaryCheck = validateAiUrl(summaryBaseUrl);
    if (!summaryCheck.valid) {
      throw new Error(`Ungültige oder unzulässige Summary-URL: ${summaryCheck.error}`);
    }
    summaryBaseUrl = summaryCheck.url;
  } else if (preset === "openrouter_system_one") {
    summaryBaseUrl = "https://openrouter.ai/api/v1";
  } else {
    summaryBaseUrl = deciderCheck.url;
  }

  return {
    preset,
    deciderBaseUrl: deciderCheck.url,
    deciderApiKey,
    deciderModel,
    deciderProtocol,
    extractorBaseUrl: extractorCheck.url,
    extractorApiKey,
    extractorModel,
    extractorProtocol,
    summaryEnabled: Boolean(overrides.summaryEnabled),
    summaryBaseUrl,
    summaryApiKey: overrides.summaryApiKey || deciderApiKey,
    summaryModel: overrides.summaryModel || envVar("AI_SUMMARY_MODEL") || legacyModel || "openai/gpt-4o-mini",
    baseUrl: deciderCheck.url,
    apiKey: deciderApiKey,
    model: deciderModel,
    orderConfidenceThreshold: Number(overrides.orderConfidenceThreshold ?? 0.55),
    receiptConfidenceThreshold: Number(overrides.receiptConfidenceThreshold ?? 0.55),
    fieldConfidenceThreshold: Number(overrides.fieldConfidenceThreshold ?? 0.65),
    extractAttachments: overrides.extractAttachments !== false,
    autoAnalyzeNewEmails: overrides.autoAnalyzeNewEmails !== false,
    anonymizePii: overrides.anonymizePii !== false,
    developerMode: Boolean(overrides.developerMode),
    logoDevToken: overrides.logoDevToken || "",
  };
}

/**
 * Legacy helper kept for backwards compatibility with existing callers.
 */
export function getAiConfig(overrides = {}) {
  const candidateUrl =
    overrides.baseURL ||
    overrides.baseUrl ||
    envVar("AI_BASE_URL") ||
    "http://localhost:11434/v1";

  const urlCheck = validateAiUrl(candidateUrl);
  if (!urlCheck.valid) {
    throw new Error(`Ungültige oder unzulässige AI Base-URL: ${urlCheck.error}`);
  }

  const baseURL = urlCheck.url;
  const apiKey = overrides.apiKey || envVar("AI_API_KEY") || envVar("OPENROUTER_API_KEY") || "ollama";
  const model = overrides.model || envVar("AI_MODEL") || "llama3.2";

  return { baseURL, apiKey, model };
}

export function createAiClient(overrides = {}) {
  const config = getAiConfig(overrides);
  const client = new OpenAI({
    baseURL: config.baseURL,
    apiKey: config.apiKey,
    maxRetries: 2,
    timeout: 45000,
    dangerouslyAllowBrowser: false,
  });

  return { client, model: config.model, config };
}
