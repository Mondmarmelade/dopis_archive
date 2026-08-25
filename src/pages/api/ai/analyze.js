import { createAiClient } from "../../../utils/aiClient";

function cleanEmailText(text, html) {
  let raw = text || "";
  if (!raw && html) {
    // Strip basic html tags if only html is present
    raw = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  // Truncate to reasonable length (approx 4000 characters) to save tokens and avoid latency
  return raw.slice(0, 4000);
}

export async function POST({ request, cookies }) {
  const authCookie = cookies.get("auth");
  if (!authCookie?.value) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { subject = "", from = "", text = "", html = "", settings = {} } = body;
  const cleanedContent = cleanEmailText(text, html);

  if (!cleanedContent && !subject) {
    return new Response(
      JSON.stringify({
        summary: ["Leere E-Mail ohne Inhalt."],
        category: "Sonstiges",
        tags: [],
        actionItems: [],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const systemPrompt = `Du bist ein intelligenter E-Mail-Assistent für den E-Mail-Client 'Dopis'.
Deine Aufgabe ist es, eine E-Mail strukturiert zu analysieren und ein valides JSON-Objekt zurückzugeben.

Antworte IMMER und AUSSCHLIESSLICH mit einem JSON-Objekt im folgenden Format (ohne Markdown-Formatierungsblöcke oder zusätzlichen Text):
{
  "summary": [
    "Prägnanter Kernpunkt 1 (auf Deutsch)",
    "Prägnanter Kernpunkt 2 (auf Deutsch)"
  ],
  "category": "Eine aus: Rechnung, Newsletter, Dringend, Benachrichtigung, Persönlich, Update, Sonstiges",
  "tags": ["1-3 kurze, relevante Stichworte/Tags"],
  "actionItems": [
    {
      "task": "Konkrete To-Do oder Handlungsaufforderung (falls vorhanden)",
      "due": "Frist/Datum oder null"
    }
  ]
}

Regeln:
1. 'summary': 1 bis maximal 3 kurze, informative Bullet-Points auf Deutsch.
2. 'category': Wähle genau die passendste Kategorie (z.B. 'Rechnung' bei Rechnungen/Zahlungen, 'Newsletter' bei Newslettern/Werbung, 'Dringend' bei dringenden Anfragen, 'Benachrichtigung' bei Systemmeldungen, 'Persönlich' bei privater Korrespondenz, 'Update' bei Statusberichten).
3. 'tags': 1 bis 3 kurze Schlagwörter (z.B. 'Finanzen', 'Termin', 'Hosting', 'Sicherheit').
4. 'actionItems': Nur Aufgaben/To-Dos erfassen, die der Empfänger der E-Mail tatsächlich erledigen soll. Falls keine Handlungsaufforderung existiert, leeres Array [].`;

  const userContent = `Absender: ${from}\nBetreff: ${subject}\n\nInhalt:\n${cleanedContent}`;

  try {
    const { client, model } = createAiClient(settings);

    const response = await client.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    let rawOutput = response.choices?.[0]?.message?.content?.trim() || "{}";

    // Strip ```json ... ``` wrapper if model included it
    if (rawOutput.startsWith("```")) {
      rawOutput = rawOutput.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    let parsed;
    try {
      parsed = JSON.parse(rawOutput);
    } catch {
      parsed = {
        summary: [subject || "E-Mail analysiert."],
        category: "Sonstiges",
        tags: [],
        actionItems: [],
      };
    }

    return new Response(
      JSON.stringify({
        summary: Array.isArray(parsed.summary) ? parsed.summary : [String(parsed.summary || "")],
        category: parsed.category || "Sonstiges",
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI analysis failed:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Failed to analyze email with AI",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
