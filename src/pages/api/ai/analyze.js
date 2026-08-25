import { createAiClient } from "../../../utils/aiClient";
import { anonymizePii } from "../../../utils/aiAnonymizer";

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
  const startTime = performance.now();

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
  let cleanedContent = cleanEmailText(text, html);
  let senderInfo = from;
  let subjectInfo = subject;

  // Apply PII anonymization if enabled (enabled by default)
  const shouldAnonymize = settings.anonymizePii !== false;
  if (shouldAnonymize) {
    cleanedContent = anonymizePii(cleanedContent);
    senderInfo = anonymizePii(senderInfo);
    subjectInfo = anonymizePii(subjectInfo);
  }

  if (!cleanedContent && !subjectInfo) {
    return new Response(
      JSON.stringify({
        summary: ["Leere E-Mail ohne Inhalt."],
        category: "Sonstiges",
        tags: [],
        actionItems: [],
        _debug: {
          model: "none",
          durationMs: 0,
          anonymizedInput: "(empty)",
          rawOutput: "{}",
          timestamp: new Date().toISOString(),
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const systemPrompt = `Du bist ein hochentwickelter E-Mail-Klassifizierungs- und Analyse-Assistent für den E-Mail-Client 'Dopis'.
Deine Aufgabe ist es, die E-Mail präzise zu kategorisieren, zusammenzufassen und etwaige Handlungsaufforderungen zu extrahieren.

Antworte IMMER und AUSSCHLIESSLICH mit einem validen JSON-Objekt im folgenden Format (kein Markdown, keine Backticks):
{
  "summary": [
    "Prägnanter Kernpunkt 1 (auf Deutsch)",
    "Prägnanter Kernpunkt 2 (auf Deutsch)"
  ],
  "category": "Eine exakte Kategorie aus der Liste unten",
  "tags": ["1-3 kurze, relevante Schlagworte"],
  "actionItems": [
    {
      "task": "Konkrete To-Do oder Handlungsaufforderung",
      "due": "Frist/Datum oder null"
    }
  ]
}

KATEGORIEN & UNTERSCHEIDUNGSREGELN (Wähle genau eine):
1. "Spam": Unerwünschte Massenmails, Betrug, Phishing, verdächtige Gewinne/Erbschaften, dubiose Krypto-/Pillenangebote, gefälschte Rechnungen, unseriöse unbekannte Absender.
2. "Werbung": Legitime kommerzielle Produktwerbung, Rabattaktionen, Sonderangebote, Sales, Shopping-Deals von bekannten Marken und Online-Shops (z.B. Amazon Deals, Zalando, Otto, SaaS Promo).
3. "Newsletter": Abonnierte redaktionelle Inhalte, Fachartikel, Blogs, Magazine, Wissensbeiträge, wöchentliche/monatliche Digests.
4. "Rechnung": Kaufbelege, Rechnungen, Zahlungsbestätigungen, Quittungen, Bank-Abrechnungen, Verträge mit Beträgen.
5. "Benachrichtigung": Automatische Systemmeldungen, Sicherheitswarnungen, Login-Alerts, 2FA-Codes, Paket-/Versand-Tracking, Statusänderungen.
6. "Dringend": Zeitkritische persönliche oder berufliche Anfragen mit hoher Priorität oder naher Deadline.
7. "Persönlich": Direkte 1:1-Kommunikation von Freunden, Familie, Kollegen oder Kunden.
8. "Update": Produkt-Updates, Release Notes, Changelogs, Plattform-Ankündigungen.
9. "Sonstiges": Alles, was nicht in die obigen Kategorien passt.

WICHTIGE UNTERSCHEIDUNGSHILFE:
- "Werbung" vs "Spam": Werbung kommt von echten, legalen Shops/Diensten mit Rabatten/Produkten. Spam ist betrügerisch, aggressiv, phishing-verdächtig oder unverlangter dubioser Müll.
- "Werbung" vs "Newsletter": Werbung will Produkte/Dienste verkaufen oder bewerben. Ein Newsletter liefert redaktionellen Inhalt, Wissen oder Branchen-News.
- "Rechnung" vs "Benachrichtigung": Eine Rechnung enthält Geldbeträge oder Zahlungsbelege. Eine Benachrichtigung informiert über Status (z.B. "Paket versandt", "Passwort geändert").

REGELN:
1. 'summary': 1 bis maximal 3 kurze, informative Bullet-Points auf Deutsch.
2. 'tags': 1 bis 3 kurze Stichwörter (z.B. 'Rabatt', 'Finanzen', 'Sicherheit', 'Versand').
3. 'actionItems': Nur Aufgaben/To-Dos erfassen, die der Empfänger tatsächlich erledigen soll (z.B. "Zahlung veranlassen", "Termin bestätigen"). Bei reiner Werbung oder Newslettern bleibt actionItems leer [].`;

  const userContent = `Absender: ${senderInfo}\nBetreff: ${subjectInfo}\n\nInhalt:\n${cleanedContent}`;

  try {
    const { client, model } = createAiClient(settings);

    const response = await client.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const durationMs = Math.round(performance.now() - startTime);
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
        _debug: {
          model: model,
          durationMs: durationMs,
          anonymizedInput: userContent,
          rawOutput: rawOutput,
          timestamp: new Date().toISOString(),
          promptTokens: response.usage?.prompt_tokens,
          completionTokens: response.usage?.completion_tokens,
        },
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
