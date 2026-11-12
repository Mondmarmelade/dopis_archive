import { createAiClient } from "../../../utils/aiClient.js";
import { handleOptions, jsonResponse } from "../../../utils/authHelper.js";
import { validateAiUrl } from "../../../utils/networkGuard.js";

export async function OPTIONS() {
  return handleOptions();
}

export async function POST({ request }) {
  let body = {};
  try {
    body = await request.json();
  } catch {}

  const baseUrl = body.baseUrl || body.baseURL || process.env.AI_BASE_URL || "http://localhost:11434/v1";
  const apiKey = body.apiKey || process.env.AI_API_KEY || "ollama";

  // Validate URL to prevent SSRF
  const urlCheck = validateAiUrl(baseUrl);
  if (!urlCheck.valid) {
    return jsonResponse(
      {
        success: false,
        error: urlCheck.error || "Ungültige Base-URL",
        models: [],
      },
      400
    );
  }

  try {
    const { client } = createAiClient({
      baseUrl: urlCheck.url,
      apiKey: apiKey,
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

    return jsonResponse({
      success: true,
      endpoint: urlCheck.url,
      models: modelList,
    });
  } catch (error) {
    console.error("Failed to fetch models from AI endpoint:", error.message);
    return jsonResponse(
      {
        success: false,
        error: `Modelle konnten nicht abgerufen werden: ${error.message}`,
        models: [],
      },
      200
    );
  }
}

export async function GET({ url }) {
  const baseUrl = url.searchParams.get("baseUrl") || process.env.AI_BASE_URL || "http://localhost:11434/v1";
  const apiKey = url.searchParams.get("apiKey") || process.env.AI_API_KEY || "ollama";

  const urlCheck = validateAiUrl(baseUrl);
  if (!urlCheck.valid) {
    return jsonResponse(
      {
        success: false,
        error: urlCheck.error || "Ungültige Base-URL",
        models: [],
      },
      400
    );
  }

  try {
    const { client } = createAiClient({
      baseUrl: urlCheck.url,
      apiKey: apiKey,
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

    return jsonResponse({
      success: true,
      endpoint: urlCheck.url,
      models: modelList,
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: `Modelle konnten nicht abgerufen werden: ${error.message}`,
        models: [],
      },
      200
    );
  }
}
