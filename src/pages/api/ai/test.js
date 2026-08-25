import { createAiClient } from "../../../utils/aiClient";

export async function POST({ request, cookies }) {
  const authCookie = cookies.get("auth");
  if (!authCookie?.value) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine, uses .env defaults
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

    return new Response(
      JSON.stringify({
        success: true,
        endpoint: config.baseURL,
        model: model,
        reply,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI connection test failed:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to connect to AI endpoint",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
