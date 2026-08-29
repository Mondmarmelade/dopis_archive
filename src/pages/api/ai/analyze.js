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
Deine Aufgabe ist es, die E-Mail präzise zu kategorisieren, zusammenzufassen, etwaige Handlungsaufforderungen zu extrahieren sowie Bestellungen (physische Pakete, digitale Güter, Tickets, Buchungen, Abos) und Zahlungsbelege (PayPal, Klarna, Stripe, Bank) intelligent zu strukturieren.

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
  "paymentInfo": {
    "isPaymentReceipt": true,
    "provider": "PayPal | Klarna | Stripe | Apple Pay | Google Pay | Kreditkarte | Banküberweisung | null",
    "paidTo": "Empfänger / Händlername (z. B. 'CTS Eventim AG', 'Steam Games', 'Spotify', 'Deutsche Bahn', 'Amazon') oder null",
    "amount": "Geldbetrag mit Währung (z. B. '89,00 EUR', '14,99 €') oder null",
    "transactionId": "Transaktionsnummer / Transaktionscode (z. B. '9AB12345CD') oder null"
  },
  "orderInfo": {
    "isOrder": true,
    "orderType": "physical | digital | ticket | booking | subscription | service",
    "merchant": "Händlername (z. B. Eventim, Deutsche Bahn, Amazon, Otto, Steam, Apple, Airbnb, etc.) oder null",
    "orderId": "Bestellnummer oder Buchungsnummer oder null",
    "trackingNumber": "Sendungsnummer / Tracking-ID oder null",
    "carrier": "DHL | Hermes | DPD | UPS | Amazon Logistics | GLS | FedEx | null",
    "productSummary": "Kurze prägnante Produkt-/Ticket-/Buchungsbezeichnung (z. B. '2x Tickets: Rammstein Tour 2026', 'ICE Ticket Berlin-München', 'Sony Kopfhörer') oder null",
    "amount": "Gesamtbetrag (z. B. '89,00 €') oder null",
    "stage": "ordered | payment_confirmed | tickets_issued | digital_delivered | shipped | out_for_delivery | delivered | return_initiated | return_dropped | returned | refunded | cancelled | null",
    "statusTitle": "Prägnanter Ereignis-Titel auf Deutsch (z. B. 'Bestellung bestätigt', 'Zahlung via PayPal bestätigt', 'Tickets bereitgestellt', 'Versand erfolgt', 'In Zustellung', 'Paket zugestellt', 'Retourenschein erstellt', 'Erstattung verbucht') oder null",
    "statusDetail": "Wichtige Kontext-Details auf Deutsch (z. B. 'Zahlung über 89,00 € autorisiert', '2 E-Tickets als PDF im Anhang', 'Zustellung heute bis 15:00 Uhr', 'An Nachbar übergeben') oder null",
    "eventDate": "Datum & Uhrzeit des Events / der Reise (z. B. '24. Okt 2026, 20:00 Uhr') oder null",
    "venue": "Veranstaltungsort / Strecke (z. B. 'Olympiastadion Berlin', 'Berlin Hbf -> München Hbf') oder null",
    "deliveryLocation": "Ablageort, Packstation oder Empfängername oder null",
    "estimatedDelivery": "Voraussichtliches Lieferdatum/Zeitfenster oder null"
  }
}

KATEGORIEN & UNTERSCHEIDUNGSREGELN (Wähle genau eine):
1. "Spam": Unerwünschte Massenmails, Betrug, Phishing, verdächtige Gewinne/Erbschaften, dubiose Krypto-/Pillenangebote, gefälschte Rechnungen, unseriöse unbekannte Absender.
2. "Werbung": Legitime kommerzielle Produktwerbung, Rabattaktionen, Sonderangebote, Sales, Shopping-Deals von bekannten Marken und Online-Shops (z.B. Amazon Deals, Zalando, Otto, SaaS Promo).
3. "Newsletter": Abonnierte redaktionelle Inhalte, Fachartikel, Blogs, Magazine, Wissensbeiträge, wöchentliche/monatliche Digests.
4. "Rechnung": Kaufbelege, Rechnungen, Zahlungsbestätigungen (PayPal, Klarna, Bank), Quittungen, Abrechnungen.
5. "Benachrichtigung": Automatische Systemmeldungen, Sicherheitswarnungen, Login-Alerts, 2FA-Codes, Paket-/Versand-Tracking, Ticketbereitstellung, Statusänderungen.
6. "Dringend": Zeitkritische persönliche oder berufliche Anfragen mit hoher Priorität oder naher Deadline.
7. "Persönlich": Direkte 1:1-Kommunikation von Freunden, Familie, Kollegen oder Kunden.
8. "Update": Produkt-Updates, Release Notes, Changelogs, Plattform-Ankündigungen.
9. "Sonstiges": Alles, was nicht in die obigen Kategorien passt.

BESTELL-, TICKET- & ZAHLUNGS-REGELN:
- Setze 'paymentInfo' nur, wenn es sich um einen Zahlungsdienstleister-Beleg handelt (z.B. PayPal "Ihre Zahlung an...", Klarna Abrechnung, Stripe Beleg, Kreditkartenabrechnung).
- 'orderType' Zuordnung:
  - 'physical': Physische Waren & Pakete (Amazon, Otto, Kleidung, Elektronik).
  - 'ticket': Konzert-, Theater-, Kino-, Festival-, Sport- oder Bahntickets (Eventim, Ticketmaster, Deutsche Bahn).
  - 'booking': Hotel, Flug, Airbnb, Mietwagen, Tischreservierung.
  - 'digital': Software, E-Books, Games (Steam, Playstation), Lizenzschlüssel, Downloads.
  - 'subscription': Spotify, Netflix, SaaS-Abos, Mitgliedschaften.
  - 'service': Dienstleistungen, Handwerker, Beratung.
- 'stage' Zuordnung:
  - 'ordered': Bestellung/Buchung aufgegeben oder bestätigt.
  - 'payment_confirmed': Zahlung erhalten / Beleg erstellt.
  - 'tickets_issued': Tickets generiert / E-Tickets bereitgestellt / Barcode vorhanden.
  - 'digital_delivered': Digitales Produkt bereitgestellt / Zugang freigeschaltet.
  - 'shipped': Physisches Paket verschickt.
  - 'out_for_delivery': In Zustellung heute.
  - 'delivered': Zugestellt / übergeben.
  - 'return_initiated': Retoure angemeldet.
  - 'return_dropped': Retoure abgegeben.
  - 'returned': Retoure eingegangen.
  - 'refunded': Erstattung veranlasst / Gutschrift verbucht.
  - 'cancelled': Storniert.
- Wenn keine Bestellung/Lieferung/Ticket vorliegt, setze "orderInfo": null.
- Wenn kein Zahlungsbeleg vorliegt, setze "paymentInfo": null.

REGELN:
1. 'summary': 1 bis maximal 3 kurze, informative Bullet-Points auf Deutsch.
2. 'tags': 1 bis 3 kurze Stichwörter (z.B. 'PayPal', 'Eventim', 'Tickets', 'Rechnung', 'Konzert').
3. 'actionItems': Nur Aufgaben erfassen, die der Nutzer erledigen soll.`;

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
        paymentInfo: null,
        orderInfo: null,
      };
    }

    const paymentInfo =
      parsed.paymentInfo && parsed.paymentInfo.isPaymentReceipt
        ? {
            isPaymentReceipt: true,
            provider: parsed.paymentInfo.provider || null,
            paidTo: parsed.paymentInfo.paidTo || null,
            amount: parsed.paymentInfo.amount || null,
            transactionId: parsed.paymentInfo.transactionId || null,
          }
        : null;

    const orderInfo =
      parsed.orderInfo && (parsed.orderInfo.isOrder || parsed.orderInfo.orderType)
        ? {
            isOrder: true,
            orderType: parsed.orderInfo.orderType || "physical",
            merchant: parsed.orderInfo.merchant || null,
            orderId: parsed.orderInfo.orderId || null,
            trackingNumber: parsed.orderInfo.trackingNumber || null,
            carrier: parsed.orderInfo.carrier || null,
            productSummary: parsed.orderInfo.productSummary || null,
            amount: parsed.orderInfo.amount || null,
            stage: parsed.orderInfo.stage || "ordered",
            statusTitle: parsed.orderInfo.statusTitle || null,
            statusDetail: parsed.orderInfo.statusDetail || null,
            eventDate: parsed.orderInfo.eventDate || null,
            venue: parsed.orderInfo.venue || null,
            deliveryLocation: parsed.orderInfo.deliveryLocation || null,
            estimatedDelivery: parsed.orderInfo.estimatedDelivery || null,
          }
        : null;

    return new Response(
      JSON.stringify({
        summary: Array.isArray(parsed.summary) ? parsed.summary : [String(parsed.summary || "")],
        category: parsed.category || "Sonstiges",
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
        paymentInfo: paymentInfo,
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
