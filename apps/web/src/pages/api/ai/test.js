import { createAiClient } from "../../../utils/aiClient.js";
import { getCredentials, handleOptions, jsonResponse } from "../../../utils/authHelper.js";

export async function OPTIONS() {
  return handleOptions();
}

export async function POST({ request, cookies }) {
  const credentials = getCredentials(request, cookies);

  let body = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine, uses .env defaults
  }

  // If unauthenticated, allow testing only during onboarding setup with explicit endpoint
  if (!credentials || credentials.length < 4) {
    if (!body.baseUrl && !body.baseURL) {
      return jsonResponse(
        { error: "Unauthorized. Please provide a valid Bearer token or log in." },
        401
      );
    }
  }

  try {
    const { client, model, config } = createAiClient(body);

    const response = await client.chat.completions.create({
      model: model,
      messages: [
        {
          role: "user",
          content: "Respond with the single word 'OK' if you can read this message.",
        },
      ],
      max_tokens: 10,
    });

    const reply = response.choices?.[0]?.message?.content?.trim() || "";

    return jsonResponse({
      success: true,
      endpoint: config.baseURL,
      model: model,
      reply,
    });
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
