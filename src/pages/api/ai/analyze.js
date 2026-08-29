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
Deine Aufgabe ist es, die E-Mail präzise zu kategorisieren, zusammenzufassen, etwaige Handlungsaufforderungen zu extrahieren und Bestell-/Sendungsinformationen für das smarte Paket- und E-Commerce-Tracking zu erfassen.

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
  ],
  "orderInfo": {
    "isOrder": true,
    "merchant": "Händlername (z. B. Amazon, Otto, Zalando, eBay, Apple, etc.) oder null",
    "orderId": "Bestellnummer oder null",
    "trackingNumber": "Sendungsnummer / Tracking-ID oder null",
    "carrier": "DHL | Hermes | DPD | UPS | Amazon Logistics | GLS | FedEx | null",
    "productSummary": "Kurze prägnante Produkt-/Artikelbezeichnung oder null",
    "stage": "ordered | shipped | out_for_delivery | delivered | return_initiated | returned | refunded | null",
    "estimatedDelivery": "Voraussichtliches Lieferdatum (z.B. 'Dienstag, 2. Sept') oder null"
  }
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

BESTELL- & SENDUNGS-REGELN ('orderInfo'):
- Setze 'isOrder' nur auf true, wenn es sich um einen echten Kauf, eine Bestellung, einen Versand, eine Paketankündigung, Zustellung, Rechnung zu einer Ware oder Retoure/Erstattung handelt.
- 'stage' Zuordnung:
  - 'ordered': Bestellbestätigung, Auftragsbestätigung.
  - 'shipped': Versandbestätigung, Paket wurde verschickt.
  - 'out_for_delivery': In Zustellung, wird heute zugestellt.
  - 'delivered': Paket erfolgreich zugestellt / übergeben.
  - 'return_initiated': Retoure angemeldet / Retourenschein erstellt.
  - 'returned': Retoure im Lager eingegangen / abgegeben.
  - 'refunded': Erstattung veranlasst / Gutschrift erfolgt.
- Wenn keine Bestellung/Lieferung vorliegt, setze "orderInfo": null.

REGELN:
1. 'summary': 1 bis maximal 3 kurze, informative Bullet-Points auf Deutsch.
2. 'tags': 1 bis 3 kurze Stichwörter (z.B. 'Amazon', 'Versand', 'Rechnung', 'Elektronik').
3. 'actionItems': Nur Aufgaben/To-Dos erfassen, die der Empfänger tatsächlich erledigen soll.`;

  const userContent = `Absender: ${senderInfo}\nBetreff: ${subjectInfo}\n\nInhalt:\n${cleanedContent}`;

  try {
    const { client, model } = createAiClient(settings);
    let response;
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        response = await client.chat.completions.create({
          model: model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          temperature: 0.1,
          response_format: { type: "json_object" },
        });
        break;
      } catch (err) {
        const status = err.status || err.statusCode;
        const isTransient = status === 503 || status === 429 || status === 502 || status === 504;
        if (isTransient && attempt < maxRetries) {
          const delay = (attempt + 1) * 1200;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw err;
      }
    }

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
        orderInfo: null,
      };
    }

    const orderInfo =
      parsed.orderInfo && parsed.orderInfo.isOrder
        ? {
            isOrder: true,
            merchant: parsed.orderInfo.merchant || null,
            orderId: parsed.orderInfo.orderId || null,
            trackingNumber: parsed.orderInfo.trackingNumber || null,
            carrier: parsed.orderInfo.carrier || null,
            productSummary: parsed.orderInfo.productSummary || null,
            stage: parsed.orderInfo.stage || "ordered",
            estimatedDelivery: parsed.orderInfo.estimatedDelivery || null,
          }
        : null;

    return new Response(
      JSON.stringify({
        summary: Array.isArray(parsed.summary) ? parsed.summary : [String(parsed.summary || "")],
        category: parsed.category || "Sonstiges",
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
        orderInfo: orderInfo,
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
    const status = error.status || error.statusCode || 500;
    let friendlyMessage = error.message || "Failed to analyze email with AI";

    if (status === 503 || friendlyMessage.includes("503") || friendlyMessage.includes("ServiceUnavailable")) {
      friendlyMessage = "KI-Endpunkt vorübergehend überlastet (503 Service Unavailable). Bitte in wenigen Sekunden erneut versuchen.";
    } else if (status === 429 || friendlyMessage.includes("429") || friendlyMessage.includes("RateLimit")) {
      friendlyMessage = "Rate Limit erreicht (429 Too Many Requests). Bitte kurz warten.";
    }

    return new Response(
      JSON.stringify({
        error: friendlyMessage,
      }),
      { status: status >= 400 && status < 600 ? status : 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
