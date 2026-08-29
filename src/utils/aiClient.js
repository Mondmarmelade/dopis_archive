import OpenAI from "openai";

export function getAiConfig(overrides = {}) {
  const baseURL =
    overrides.baseURL ||
    overrides.baseUrl ||
    import.meta.env.AI_BASE_URL ||
    "http://localhost:11434/v1";

  const apiKey =
    overrides.apiKey ||
    import.meta.env.AI_API_KEY ||
    "ollama";

  const model =
    overrides.model ||
    import.meta.env.AI_MODEL ||
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
