import OpenAI from "openai";
import type {
  AiPipelineConfig,
  EmailDecisionResult,
  EmailExtractionInput,
  EmailExtractionResult,
  ExtractedFieldMeta,
} from "./types";

interface ClairicFieldSpec {
  type: "text" | "number" | "date" | "datetime" | "list";
  instructions?: string;
  decimals?: number;
  items?: "text" | "number" | "date";
}

/**
 * Decides which typed fields to request from Clairic based on Step 1 (Clef) signals.
 * Returns null if the email does not warrant Step 2 extraction (e.g. promo/newsletter/spam).
 */
export function selectExtractionFields(
  decision: EmailDecisionResult,
  config: AiPipelineConfig
): { fields: Record<string, ClairicFieldSpec>; reasons: string[] } | null {
  const fields: Record<string, ClairicFieldSpec> = {};
  const reasons: string[] = [];

  const orderThreshold = config.orderConfidenceThreshold ?? 0.55;
  const receiptThreshold = config.receiptConfidenceThreshold ?? 0.55;

  const needOrder = decision.signals.isOrder >= orderThreshold;
  const needPayment =
    decision.signals.isPaymentReceipt >= receiptThreshold ||
    decision.category === "Rechnung";
  const needCode = decision.signals.hasVerificationCode >= 0.65;
  const needActionDeadline =
    decision.signals.hasActionItem >= 0.65 || decision.category === "Dringend";

  if (needOrder) {
    reasons.push("order");
    fields.merchant = {
      type: "text",
      instructions: "Name of the merchant, online store, airline, or ticket vendor",
    };
    fields.order_id = {
      type: "text",
      instructions: "Exact order number, booking reference, or confirmation code",
    };
    fields.tracking_number = {
      type: "text",
      instructions: "Parcel tracking number or shipment ID, if present",
    };
    fields.carrier = {
      type: "text",
      instructions: "Shipping carrier name (e.g. DHL, Hermes, DPD, UPS, GLS, Amazon Logistics, FedEx)",
    };
    fields.product_summary = {
      type: "text",
      instructions: "Short product, ticket, or booking title",
    };
    fields.total_amount = {
      type: "number",
      decimals: 2,
      instructions: "Total order amount as a number",
    };
    fields.currency = {
      type: "text",
      instructions: "Currency code or symbol for the total amount (e.g. EUR, USD, €)",
    };
    fields.estimated_delivery = {
      type: "date",
      instructions: "Estimated or actual delivery date",
    };
    fields.delivery_location = {
      type: "text",
      instructions: "Delivery location, Packstation, parcel shop, or recipient note if stated",
    };

    if (decision.orderType === "ticket" || decision.orderType === "booking") {
      fields.event_date = {
        type: "datetime",
        instructions: "Start date and time of the event, concert, train, flight, or booking",
      };
      fields.venue = {
        type: "text",
        instructions: "Venue name, hotel, or travel route (e.g. Berlin Hbf -> München Hbf)",
      };
    }
  }

  if (needPayment) {
    reasons.push("payment_or_invoice");
    fields.payment_provider = {
      type: "text",
      instructions: "Payment provider (e.g. PayPal, Klarna, Stripe, Apple Pay, Kreditkarte, Banküberweisung)",
    };
    fields.paid_to = {
      type: "text",
      instructions: "Recipient or merchant name that was paid or issued the invoice",
    };
    fields.invoice_number = {
      type: "text",
      instructions: "Invoice number or receipt number, if present",
    };
    fields.payment_amount = {
      type: "number",
      decimals: 2,
      instructions: "Invoice or payment amount as a number",
    };
    fields.payment_currency = {
      type: "text",
      instructions: "Currency code or symbol for the invoice/payment amount (e.g. EUR, USD, €)",
    };
    fields.transaction_id = {
      type: "text",
      instructions: "Payment transaction ID or reference code",
    };
    fields.due_date = {
      type: "date",
      instructions: "Payment due date for the invoice, if any",
    };
  }

  if (needCode) {
    reasons.push("verification_code");
    fields.verification_code = {
      type: "text",
      instructions: "Exact one-time login, 2FA, or verification code",
    };
  }

  if (needActionDeadline) {
    reasons.push("action_deadline");
    fields.action_deadline = {
      type: "date",
      instructions: "Deadline or due date for the requested action, if mentioned",
    };
  }

  if (Object.keys(fields).length === 0) {
    return null;
  }

  return { fields, reasons };
}

function resolveExtractionsEndpoint(baseUrl: string, protocol: AiPipelineConfig["extractorProtocol"]): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (protocol === "openrouter_extractions") {
    if (trimmed.endsWith("/alpha/extractions")) return trimmed;
    if (trimmed.endsWith("/api/v1")) return `${trimmed.slice(0, -3)}/alpha/extractions`;
    if (trimmed.endsWith("/api")) return `${trimmed}/alpha/extractions`;
    return `${trimmed}/api/alpha/extractions`;
  }
  // Self-hosted Clairic native endpoint
  if (trimmed.endsWith("/extractions") || trimmed.endsWith("/clairic")) {
    return trimmed;
  }
  if (trimmed.endsWith("/v1")) {
    return `${trimmed}/extractions`;
  }
  return `${trimmed}/v1/extractions`;
}

function sliceByCodePoints(text: string, start: number, end: number): string | null {
  if (!text || typeof start !== "number" || typeof end !== "number" || start < 0 || end <= start) {
    return null;
  }
  try {
    const chars = Array.from(text);
    const ctxStart = Math.max(0, start - 25);
    const ctxEnd = Math.min(chars.length, end + 25);
    const prefix = ctxStart > 0 ? "…" : "";
    const suffix = ctxEnd < chars.length ? "…" : "";
    return `${prefix}${chars.slice(ctxStart, ctxEnd).join("").replace(/\s+/g, " ").trim()}${suffix}`;
  } catch {
    return null;
  }
}

function parseClairicResponse(
  payload: any,
  stateText: string,
  config: AiPipelineConfig,
  durationMs: number
): EmailExtractionResult {
  const body = payload?.result && payload?.result?.answers ? payload.result : payload;
  const rawAnswers = body?.answers || {};
  const fieldThreshold = config.fieldConfidenceThreshold ?? 0.65;
  const fields: Record<string, ExtractedFieldMeta> = {};

  for (const [key, ans] of Object.entries<any>(rawAnswers)) {
    if (!ans || typeof ans !== "object") continue;

    const pNull = typeof ans.p_null === "number" ? ans.p_null : undefined;
    const confidence = typeof ans.confidence === "number" ? ans.confidence : undefined;
    let value = ans.value !== undefined ? ans.value : null;

    // Filter out values that the model deems absent (p_null > 0.5)
    if (pNull !== undefined && pNull > 0.5) {
      value = null;
    }

    const span: [number, number] | null =
      Array.isArray(ans.span) && ans.span.length === 2 ? [ans.span[0], ans.span[1]] : null;

    const excerpt =
      value !== null && span ? sliceByCodePoints(body?.state_text || stateText, span[0], span[1]) : null;

    const uncertain =
      value !== null && confidence !== undefined && confidence < fieldThreshold;

    fields[key] = {
      value,
      confidence,
      pNull,
      span,
      excerpt,
      source: ans.source === "image" || ans.source === "document" ? ans.source : "text",
      uncertain,
    };
  }

  return {
    skipped: false,
    fields,
    verificationCode: fields.verification_code?.value ? (fields.verification_code as ExtractedFieldMeta<string | null>) : null,
    actionDeadline: fields.action_deadline?.value ? (fields.action_deadline as ExtractedFieldMeta<string | null>) : null,
    keyTopics: Array.isArray(fields.key_topics?.value) ? (fields.key_topics.value as string[]) : [],
    model: body?.model || config.extractorModel,
    provider: body?.provider,
    protocol: config.extractorProtocol,
    durationMs,
    inputTokens: body?.usage?.input_tokens ?? 0,
    outputTokens: body?.usage?.output_tokens ?? 0,
    passes: body?.usage?.passes,
    costUsd: typeof body?.usage?.cost === "number" ? body.usage.cost : undefined,
    truncated: Boolean(body?.truncated),
    raw: body,
  };
}

async function runOpenAiCompatExtractor(
  input: EmailExtractionInput,
  fieldSpecs: Record<string, ClairicFieldSpec>,
  config: AiPipelineConfig,
  startTime: number
): Promise<EmailExtractionResult> {
  const client = new OpenAI({
    baseURL: config.extractorBaseUrl,
    apiKey: config.extractorApiKey || "ollama",
    maxRetries: 2,
    timeout: 40000,
    dangerouslyAllowBrowser: false,
  });

  const fieldDescriptions = Object.entries(fieldSpecs)
    .map(([k, spec]) => `- "${k}" (${spec.type}): ${spec.instructions || k}`)
    .join("\n");

  const systemPrompt = `You are a precise structured data extractor.
Extract ONLY the requested fields from the email inside <untrusted_email>.
If a field is not clearly stated, set it to null. Never invent values.
Reference date for relative dates: ${input.referenceDate || new Date().toISOString().slice(0, 10)}.
Respond ONLY with valid JSON containing these exact keys:
${fieldDescriptions}`;

  const response = await client.chat.completions.create({
    model: config.extractorModel,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `<untrusted_email>\n${input.stateText.slice(0, 6000)}\n</untrusted_email>` },
    ],
  });

  const durationMs = Math.round(performance.now() - startTime);
  let raw = response.choices?.[0]?.message?.content?.trim() || "{}";
  if (raw.startsWith("```")) {
    raw = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  let parsed: Record<string, any> = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  const fields: Record<string, ExtractedFieldMeta> = {};
  for (const key of Object.keys(fieldSpecs)) {
    const val = parsed[key] !== undefined && parsed[key] !== "" ? parsed[key] : null;
    fields[key] = {
      value: val,
      source: "llm",
      uncertain: false,
    };
  }

  return {
    skipped: false,
    fields,
    verificationCode: fields.verification_code?.value ? (fields.verification_code as ExtractedFieldMeta<string | null>) : null,
    actionDeadline: fields.action_deadline?.value ? (fields.action_deadline as ExtractedFieldMeta<string | null>) : null,
    keyTopics: [],
    model: config.extractorModel,
    protocol: "openai_compat",
    durationMs,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
    raw: parsed,
  };
}

/**
 * Step 2: Conditionally extracts typed fields via Clairic (OpenRouter Extractions API
 * or Self-Hosted Clairic) or falls back to an OpenAI-compatible JSON endpoint.
 */
export async function runEmailExtraction(
  input: EmailExtractionInput,
  decision: EmailDecisionResult,
  config: AiPipelineConfig,
  fetchImpl: typeof fetch = fetch
): Promise<EmailExtractionResult> {
  const selection = selectExtractionFields(decision, config);
  if (!selection) {
    return {
      skipped: true,
      skipReason: `Kein Bestell-, Rechnungs-, 2FA- oder Frist-Signal erkannt (${decision.category})`,
      fields: {},
      durationMs: 0,
      inputTokens: 0,
      outputTokens: 0,
    };
  }

  const startTime = performance.now();

  if (config.extractorProtocol === "openai_compat") {
    return runOpenAiCompatExtractor(input, selection.fields, config, startTime);
  }

  const endpoint = resolveExtractionsEndpoint(config.extractorBaseUrl, config.extractorProtocol);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.extractorApiKey) {
    headers["Authorization"] = `Bearer ${config.extractorApiKey}`;
  }
  if (config.extractorProtocol === "openrouter_extractions") {
    headers["HTTP-Referer"] = "https://dopis.app";
    headers["X-Title"] = "Dopis Mail";
  }

  const payload: Record<string, any> = {
    model: config.extractorModel,
    state: input.stateText,
    fields: selection.fields,
  };

  if (input.referenceDate) {
    payload.reference_date = input.referenceDate;
  }

  // Attach image assets in the protocol-appropriate format
  if (input.imageAssets && input.imageAssets.length > 0) {
    const capped = input.imageAssets.slice(0, 4);
    if (config.extractorProtocol === "openrouter_extractions") {
      // OpenRouter Extractions API uses a top-level assets map referenced by key in state
      const assetsMap: Record<string, { type: "image"; format: string; data_base64: string }> = {};
      for (const img of capped) {
        assetsMap[img.key] = {
          type: "image",
          format: img.format === "jpeg" ? "jpg" : img.format,
          data_base64: img.base64,
        };
      }
      payload.assets = assetsMap;
    } else {
      // Self-hosted Clairic native images array
      payload.images = capped.map((img) => ({
        content_type: img.mimeType,
        base64: img.base64,
      }));
    }
  }

  // Native PDF documents are only supported on self-hosted/native Clairic (not OpenRouter)
  if (
    config.extractorProtocol === "clairic_native" &&
    input.pdfDocuments &&
    input.pdfDocuments.length > 0
  ) {
    payload.documents = input.pdfDocuments.slice(0, 4).map((doc) => ({
      content_type: "application/pdf",
      base64: doc.base64,
    }));
  }

  let lastError: any = null;
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const res = await fetchImpl(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        const err: any = new Error(`Extractor API error (${res.status}): ${errText.slice(0, 300)}`);
        err.status = res.status;
        if ((res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504) && attempt < 2) {
          await new Promise((r) => setTimeout(r, (attempt + 1) * 900));
          lastError = err;
          continue;
        }
        throw err;
      }

      const data = await res.json();
      const durationMs = Math.round(performance.now() - startTime);
      return parseClairicResponse(data, input.stateText, config, durationMs);
    } catch (err: any) {
      lastError = err;
      if (attempt < 2 && (!err?.status || err.status >= 500 || err.status === 429)) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 900));
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error("Extractor request failed");
}

/**
 * Lightweight 1-field smoke test for Step 2 (used by /api/ai/test).
 */
export async function testExtractorConnection(
  config: AiPipelineConfig,
  fetchImpl: typeof fetch = fetch
): Promise<{ ok: boolean; model: string; protocol: string; durationMs: number; detail?: string; error?: string }> {
  const startTime = performance.now();
  try {
    if (config.extractorProtocol === "openai_compat") {
      const client = new OpenAI({
        baseURL: config.extractorBaseUrl,
        apiKey: config.extractorApiKey || "ollama",
        maxRetries: 1,
        timeout: 20000,
        dangerouslyAllowBrowser: false,
      });
      const res = await client.chat.completions.create({
        model: config.extractorModel,
        messages: [{ role: "user", content: 'Return JSON {"order_id":"12345"}' }],
        max_tokens: 20,
      });
      return {
        ok: true,
        model: config.extractorModel,
        protocol: "openai_compat",
        durationMs: Math.round(performance.now() - startTime),
        detail: res.choices?.[0]?.message?.content?.trim().slice(0, 40) || "OK",
      };
    }

    const endpoint = resolveExtractionsEndpoint(config.extractorBaseUrl, config.extractorProtocol);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.extractorApiKey) headers["Authorization"] = `Bearer ${config.extractorApiKey}`;
    if (config.extractorProtocol === "openrouter_extractions") {
      headers["HTTP-Referer"] = "https://dopis.app";
      headers["X-Title"] = "Dopis Mail";
    }

    const res = await fetchImpl(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.extractorModel,
        state: "Invoice INV-2291 total 49.90 EUR.",
        fields: {
          invoice_number: { type: "text", instructions: "Invoice number" },
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        model: config.extractorModel,
        protocol: config.extractorProtocol,
        durationMs: Math.round(performance.now() - startTime),
        error: `HTTP ${res.status}: ${text.slice(0, 200)}`,
      };
    }

    const data = await res.json();
    const unwrapped = data?.result?.answers ? data.result : data;
    const val = unwrapped?.answers?.invoice_number?.value;
    return {
      ok: true,
      model: unwrapped?.model || config.extractorModel,
      protocol: config.extractorProtocol,
      durationMs: Math.round(performance.now() - startTime),
      detail: val ? `extracted="${val}"` : "OK",
    };
  } catch (err: any) {
    return {
      ok: false,
      model: config.extractorModel,
      protocol: config.extractorProtocol,
      durationMs: Math.round(performance.now() - startTime),
      error: err?.message || "Verbindung fehlgeschlagen",
    };
  }
}
