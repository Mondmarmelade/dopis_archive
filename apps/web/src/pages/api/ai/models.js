import { createAiClient } from "../../../utils/aiClient.js";
import { handleOptions, jsonResponse } from "../../../utils/authHelper.js";
import { validateAiUrl } from "../../../utils/networkGuard.js";

export async function OPTIONS() {
  return handleOptions();
}

async function fetchModelsForCapability({ baseUrl, apiKey, capability = "chat" }) {
  const urlCheck = validateAiUrl(baseUrl);
  if (!urlCheck.valid) {
    return {
      status: 400,
      payload: {
        success: false,
        error: urlCheck.error || "Ungültige Base-URL",
        models: [],
      },
    };
  }

  const normalizedUrl = urlCheck.url.replace(/\/+$/, "");
  const isOpenRouter = normalizedUrl.toLowerCase().includes("openrouter.ai");

  try {
    if (isOpenRouter) {
      let query = "";
      if (capability === "decisions") {
        query = "?output_modalities=decisions";
      } else if (capability === "extractions") {
        query = "?endpoints=/api/alpha/extractions";
      }

      const endpoint = `https://openrouter.ai/api/v1/models${query}`;
      const headers = { "Content-Type": "application/json" };
      if (apiKey && apiKey !== "ollama") {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const res = await fetch(endpoint, { headers });
      if (!res.ok) {
        throw new Error(`OpenRouter HTTP ${res.status}`);
      }
      const data = await res.json();
      const modelList = Array.isArray(data?.data)
        ? data.data.map((m) => m?.id).filter(Boolean)
        : [];

      // Sort preferred Cloudflare System One models to the top
      modelList.sort((a, b) => {
        const aCloudflare = a.startsWith("cloudflare/") ? 0 : 1;
        const bCloudflare = b.startsWith("cloudflare/") ? 0 : 1;
        if (aCloudflare !== bCloudflare) return aCloudflare - bCloudflare;
        return a.localeCompare(b);
      });

      return {
        status: 200,
        payload: {
          success: true,
          endpoint,
          capability,
          models: modelList,
        },
      };
    }

    // Standard OpenAI-compatible / Self-Hosted /v1/models discovery
    const { client } = createAiClient({
      baseUrl: urlCheck.url,
      apiKey: apiKey || "ollama",
    });

    const response = await client.models.list();
    const modelList = [];

    if (response && Array.isArray(response.data)) {
      for (const item of response.data) {
        if (item && item.id) {
          modelList.push(item.id);
        }
      }
    }

    modelList.sort((a, b) => a.localeCompare(b));

    return {
      status: 200,
      payload: {
        success: true,
        endpoint: urlCheck.url,
        capability,
        models: modelList,
      },
    };
  } catch (error) {
    console.error("Failed to fetch models from AI endpoint:", error.message);
    return {
      status: 200,
      payload: {
        success: false,
        error: `Modelle konnten nicht abgerufen werden: ${error.message}`,
        models: [],
      },
    };
  }
}

export async function POST({ request }) {
  let body = {};
  try {
    body = await request.json();
  } catch {}

  const baseUrl =
    body.baseUrl ||
    body.baseURL ||
    process.env.AI_BASE_URL ||
    "https://openrouter.ai/api";
  const apiKey = body.apiKey || process.env.OPENROUTER_API_KEY || process.env.AI_API_KEY || "ollama";
  const capability = body.capability || "chat";

  const { status, payload } = await fetchModelsForCapability({ baseUrl, apiKey, capability });
  return jsonResponse(payload, status);
}

export async function GET({ url }) {
  const baseUrl =
    url.searchParams.get("baseUrl") ||
    process.env.AI_BASE_URL ||
    "https://openrouter.ai/api";
  const apiKey =
    url.searchParams.get("apiKey") ||
    process.env.OPENROUTER_API_KEY ||
    process.env.AI_API_KEY ||
    "ollama";
  const capability = url.searchParams.get("capability") || "chat";

  const { status, payload } = await fetchModelsForCapability({ baseUrl, apiKey, capability });
  return jsonResponse(payload, status);
}
