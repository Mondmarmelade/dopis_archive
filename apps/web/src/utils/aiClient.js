import OpenAI from "openai";
import { validateAiUrl } from "./networkGuard.js";

export function getAiConfig(overrides = {}) {
  const candidateUrl =
    overrides.baseURL ||
    overrides.baseUrl ||
    (typeof import.meta !== "undefined" && import.meta.env?.AI_BASE_URL) ||
    process.env.AI_BASE_URL ||
    "http://localhost:11434/v1";

  const urlCheck = validateAiUrl(candidateUrl);
  if (!urlCheck.valid) {
    throw new Error(`Ungültige oder unzulässige AI Base-URL: ${urlCheck.error}`);
  }

  const baseURL = urlCheck.url;

  const apiKey =
    overrides.apiKey ||
    (typeof import.meta !== "undefined" && import.meta.env?.AI_API_KEY) ||
    process.env.AI_API_KEY ||
    "ollama";

  const model =
    overrides.model ||
    (typeof import.meta !== "undefined" && import.meta.env?.AI_MODEL) ||
    process.env.AI_MODEL ||
    "llama3.2";

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
