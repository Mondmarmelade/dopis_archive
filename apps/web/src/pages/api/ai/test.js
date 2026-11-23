import { resolvePipelineConfig } from "../../../utils/aiClient.js";
import { getCredentials, handleOptions, jsonResponse } from "../../../utils/authHelper.js";
import { testDeciderConnection } from "../../../lib/ai/decider.ts";
import { testExtractorConnection } from "../../../lib/ai/extractor.ts";

export async function OPTIONS() {
  return handleOptions();
}

export async function POST({ request, cookies }) {
  const credentials = getCredentials(request, cookies);

  let body = {};
  try {
    body = await request.json();
  } catch {}

  // Allow unauthenticated test during onboarding if explicit endpoint/preset is passed
  if (!credentials || credentials.length < 4) {
    if (!body.baseUrl && !body.baseURL && !body.deciderBaseUrl && !body.preset) {
      return jsonResponse(
        { error: "Unauthorized. Please provide a valid Bearer token or log in." },
        401
      );
    }
  }

  try {
    const config = resolvePipelineConfig(body);

    const [deciderResult, extractorResult] = await Promise.all([
      testDeciderConnection(config),
      testExtractorConnection(config),
    ]);

    const allOk = deciderResult.ok && extractorResult.ok;

    return jsonResponse(
      {
        success: allOk,
        preset: config.preset,
        endpoint: config.deciderBaseUrl,
        model: `${config.deciderModel} + ${config.extractorModel}`,
        stages: {
          decider: deciderResult,
          extractor: extractorResult,
        },
        error: allOk
          ? undefined
          : [
              !deciderResult.ok ? `Schritt 1 (Einordnung): ${deciderResult.error}` : null,
              !extractorResult.ok ? `Schritt 2 (Auslesung): ${extractorResult.error}` : null,
            ]
              .filter(Boolean)
              .join(" | "),
      },
      allOk ? 200 : 502
    );
  } catch (error) {
    console.error("AI connection test failed:", error);
    return jsonResponse(
      {
        success: false,
        error: error.message || "Failed to connect to AI endpoint",
      },
      500
    );
  }
}
