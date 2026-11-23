import test from "node:test";
import assert from "node:assert/strict";
import { anonymizePii } from "../src/utils/aiAnonymizer.js";
import { validateAiUrl } from "../src/utils/networkGuard.js";
import { resolvePipelineConfig } from "../src/utils/aiClient.js";
import {
  cleanEmailBody,
  extractHeaderSignals,
  buildDeciderState,
  buildExtractorState,
  toIsoDateOnly,
} from "../src/lib/ai/heuristics.ts";
import { runEmailDecisions } from "../src/lib/ai/decider.ts";
import { runEmailExtraction, selectExtractionFields } from "../src/lib/ai/extractor.ts";
import { buildStructuredOverview } from "../src/lib/ai/summarizer.ts";
import { extractPdfTextFromBuffer } from "../src/lib/ai/attachments.ts";
import {
  normalizeAiSettings,
  buildBaselineFromMails,
  findNewEmailsSinceBaseline,
} from "../src/lib/aiCache.ts";

test("1. aiAnonymizer redacts PII while preserving order numbers, DHL tracking IDs, and transaction IDs", () => {
  const sample =
    "Hallo max.mustermann@example.com, deine Amazon Bestellung 302-1234567-8901234 wurde mit DHL Sendungsnummer 00340434161094012345 verschickt. PayPal Transaktion 9AB12345CD6789012. Rückfragen unter +49 170 1234567 oder Tel: 030 / 9876543. IBAN DE89 3704 0044 0532 0130 00.";

  const cleaned = anonymizePii(sample);

  assert.ok(cleaned.includes("[EMAIL]"), "Email should be redacted");
  assert.ok(cleaned.includes("[IBAN]"), "IBAN should be redacted");
  assert.ok(cleaned.includes("[TELEFON]"), "Genuine phone numbers should be redacted");
  assert.ok(cleaned.includes("302-1234567-8901234"), "Amazon order number must be preserved");
  assert.ok(cleaned.includes("00340434161094012345"), "DHL tracking number must be preserved");
  assert.ok(cleaned.includes("9AB12345CD6789012"), "PayPal transaction ID must be preserved");
});

test("2. networkGuard always blocks cloud metadata and gates RFC1918 LAN hosts behind ALLOW_PRIVATE_AI_HOSTS", () => {
  const metaDefault = validateAiUrl("http://169.254.169.254/latest/meta-data", {
    allowLocalhost: true,
    allowPrivateLan: true,
  });
  assert.equal(metaDefault.valid, false, "Cloud metadata IP must ALWAYS be blocked");

  const lanBlocked = validateAiUrl("http://192.168.1.50:30000/v1", {
    allowLocalhost: false,
    allowPrivateLan: false,
  });
  assert.equal(lanBlocked.valid, false, "Private LAN host must be blocked by default");

  const lanAllowed = validateAiUrl("http://192.168.1.50:30000/v1", {
    allowLocalhost: false,
    allowPrivateLan: true,
  });
  assert.equal(lanAllowed.valid, true, "Private LAN host must be allowed with explicit opt-in");

  const openRouter = validateAiUrl("https://openrouter.ai/api", {
    allowLocalhost: false,
    allowPrivateLan: false,
  });
  assert.equal(openRouter.valid, true, "Public OpenRouter URL must be allowed");
});

test("3. resolvePipelineConfig & normalizeAiSettings handle OpenRouter, Self-Hosted, and legacy migration", () => {
  const orCfg = resolvePipelineConfig({
    preset: "openrouter_system_one",
    deciderApiKey: "sk-or-test",
  });
  assert.equal(orCfg.deciderProtocol, "openrouter_decisions");
  assert.equal(orCfg.extractorProtocol, "openrouter_extractions");
  assert.equal(orCfg.deciderModel, "cloudflare/clef-flash");
  assert.equal(orCfg.extractorModel, "cloudflare/clairic");

  const legacyMigrated = normalizeAiSettings({
    baseUrl: "http://localhost:11434/v1",
    model: "qwen3:8b",
    apiKey: "ollama",
  });
  assert.equal(legacyMigrated.preset, "openai_compatible");
  assert.equal(legacyMigrated.deciderProtocol, "openai_compat");
  assert.equal(legacyMigrated.deciderModel, "qwen3:8b");
  assert.equal(legacyMigrated.extractorModel, "qwen3:8b");
});

test("4. Step 1 (Clef via OpenRouter /api/alpha/decisions) parses choice/noul/score and handles refusals fail-closed", async () => {
  let capturedUrl = "";
  let capturedBody = null;

  const mockFetch = async (url, init) => {
    capturedUrl = String(url);
    capturedBody = JSON.parse(init.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        model: "cloudflare/clef-flash",
        provider: "Cloudflare",
        answers: {
          category: {
            type: "choice",
            choice: "Benachrichtigung",
            confidence: 0.94,
            probabilities: { Benachrichtigung: 0.94, Werbung: 0.04, Sonstiges: 0.02 },
          },
          is_order: { type: "noul", noul: 0.96 },
          is_payment_receipt: { type: "noul", noul: 0.12 },
          is_newsletter: { type: "noul", noul: 0.01 },
          has_action_item: { type: "noul", noul: 0.15 },
          has_verification_code: { type: "refusal" },
          urgency: { type: "score", score: 1.6, confidence: 0.8 },
          order_type: { type: "choice", choice: "physical", confidence: 0.92 },
          order_stage: { type: "choice", choice: "shipped", confidence: 0.91 },
        },
        usage: { input_tokens: 320, output_tokens: 0, cost: 0.000012 },
      }),
    };
  };

  const config = resolvePipelineConfig({
    preset: "openrouter_system_one",
    deciderApiKey: "sk-or-test",
  });

  const result = await runEmailDecisions(
    {
      subject: "Dein Paket wurde versendet",
      from: "Amazon <versand@amazon.de>",
      text: "Deine Bestellung 302-1234567-8901234 ist mit DHL unterwegs.",
      headers: extractHeaderSignals([{ key: "List-Unsubscribe", value: "<mailto:unsub@x.de>" }], []),
    },
    config,
    mockFetch
  );

  assert.equal(capturedUrl, "https://openrouter.ai/api/alpha/decisions");
  assert.equal(capturedBody.model, "cloudflare/clef-flash");
  assert.equal(result.category, "Benachrichtigung");
  assert.equal(result.categoryConfidence, 0.94);
  assert.equal(result.signals.isOrder, 0.96);
  assert.equal(result.signals.hasVerificationCode, 0, "Refused question must fail closed to 0");
  assert.deepEqual(result.refusals, ["has_verification_code"]);
  assert.equal(result.orderType, "physical");
  assert.equal(result.orderStage, "shipped");
});

test("5. Routing Gate skips Step 2 (Clairic) for newsletters/promos and triggers Step 2 for orders/invoices", async () => {
  const config = resolvePipelineConfig({
    preset: "openrouter_system_one",
    deciderApiKey: "sk-or-test",
  });

  const newsletterDecision = {
    category: "Newsletter",
    categoryConfidence: 0.95,
    categoryProbabilities: { Newsletter: 0.95 },
    orderType: null,
    orderTypeConfidence: 0,
    orderStage: null,
    orderStageConfidence: 0,
    signals: {
      isOrder: 0.02,
      isPaymentReceipt: 0.01,
      isNewsletter: 0.97,
      hasActionItem: 0.05,
      hasVerificationCode: 0.0,
      urgencyScore: 0.1,
      urgencyLabel: "low",
    },
    refusals: [],
    model: "cloudflare/clef-flash",
    protocol: "openrouter_decisions",
    durationMs: 95,
    inputTokens: 250,
    outputTokens: 0,
  };

  assert.equal(selectExtractionFields(newsletterDecision, config), null);

  let fetchCalled = false;
  const skippedRes = await runEmailExtraction(
    { stateText: "Weekly tech digest..." },
    newsletterDecision,
    config,
    async () => {
      fetchCalled = true;
      throw new Error("Should not call extractor for plain newsletter");
    }
  );
  assert.equal(skippedRes.skipped, true);
  assert.equal(fetchCalled, false);

  // Now test an order/invoice decision that SHOULD trigger Clairic
  const orderDecision = {
    ...newsletterDecision,
    category: "Rechnung",
    orderType: "physical",
    orderStage: "shipped",
    signals: {
      ...newsletterDecision.signals,
      isOrder: 0.93,
      isPaymentReceipt: 0.88,
      isNewsletter: 0.01,
    },
  };

  let extractionUrl = "";
  let extractionPayload = null;
  const mockClairicFetch = async (url, init) => {
    extractionUrl = String(url);
    extractionPayload = JSON.parse(init.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        model: "cloudflare/clairic",
        answers: {
          merchant: { type: "text", value: "Northwind Shop", confidence: 0.99, p_null: 0.001, span: [0, 14] },
          order_id: { type: "text", value: "302-1234567-8901234", confidence: 0.98, p_null: 0.002 },
          tracking_number: { type: "text", value: "00340434161094012345", confidence: 0.52, p_null: 0.05 },
          carrier: { type: "text", value: "DHL", confidence: 0.97, p_null: 0.01 },
          total_amount: { type: "number", value: 89.5, confidence: 0.96, p_null: 0.005 },
          currency: { type: "text", value: "EUR", confidence: 0.99, p_null: 0.001 },
          due_date: { type: "date", value: "2026-12-01", confidence: 0.92, p_null: 0.02 },
          transaction_id: { type: "text", value: "FAKE", confidence: 0.9, p_null: 0.85 },
        },
        usage: { input_tokens: 510, output_tokens: 0, passes: 3, cost: 0.000051 },
      }),
    };
  };

  const extracted = await runEmailExtraction(
    {
      stateText: "Northwind Shop Bestellung 302-1234567-8901234 über 89,50 EUR via DHL 00340434161094012345",
      referenceDate: toIsoDateOnly("2026-11-23T10:00:00Z"),
    },
    orderDecision,
    config,
    mockClairicFetch
  );

  assert.equal(extractionUrl, "https://openrouter.ai/api/alpha/extractions");
  assert.equal(extractionPayload.reference_date, "2026-11-23");
  assert.equal(extracted.skipped, false);
  assert.equal(extracted.fields.merchant.value, "Northwind Shop");
  assert.equal(extracted.fields.tracking_number.uncertain, true, "Confidence 0.52 < 0.65 must be flagged uncertain");
  assert.equal(extracted.fields.transaction_id.value, null, "p_null 0.85 > 0.5 must be nulled out");

  const overview = buildStructuredOverview({
    decision: orderDecision,
    extraction: extracted,
    subject: "Rechnung & Versand",
    from: "shop@northwind.de",
  });
  assert.ok(overview.summary.some((s) => s.includes("Northwind Shop")));
  assert.ok(overview.actionItems.some((a) => a.due === "2026-12-01"));
});

test("6. Import-Baseline logic never auto-queues initial emails, only newly arriving UIDs afterwards", () => {
  const initialBatch = [
    { id: "1", seq: 1, uid: 100 },
    { id: "2", seq: 2, uid: 101 },
    { id: "3", seq: 3, uid: 102 },
  ];

  // Without baseline -> returns empty (no auto-analysis on first load)
  assert.deepEqual(findNewEmailsSinceBaseline(initialBatch, null), []);

  const baseline = buildBaselineFromMails(initialBatch);
  assert.equal(baseline.maxUid, 102);

  // Same batch after baseline -> still zero new emails
  assert.deepEqual(findNewEmailsSinceBaseline(initialBatch, baseline), []);

  // A brand-new email arrives with UID 103 -> ONLY UID 103 is returned
  const updatedBatch = [{ id: "4", seq: 4, uid: 103 }, ...initialBatch];
  const newlyArrived = findNewEmailsSinceBaseline(updatedBatch, baseline);
  assert.equal(newlyArrived.length, 1);
  assert.equal(newlyArrived[0].uid, 103);
});

test("7. Heuristics & PDF extractor work cleanly on HTML bodies and minimal PDFs", async () => {
  const cleaned = cleanEmailBody(
    null,
    "<style>.x{color:red}</style><p>Rechnung <b>INV-42</b></p><p>Betrag: 19,99 €</p>"
  );
  assert.ok(cleaned.includes("Rechnung"));
  assert.ok(cleaned.includes("INV-42"));
  assert.ok(!cleaned.includes("color:red"));

  const state = buildDeciderState({
    from: "billing@acme.test",
    subject: "Invoice",
    body: "A".repeat(5000),
    headers: extractHeaderSignals([{ key: "List-Unsubscribe", value: "<https://acme.test/u>" }], []),
  });
  assert.ok(state.length <= 2850, "Clef state must stay compact under 2K token budget");
  assert.ok(state.includes("List-Unsubscribe: present"));

  const extState = buildExtractorState({
    from: "billing@acme.test",
    subject: "Invoice",
    body: "See attached",
    pdfTexts: [{ filename: "inv.pdf", text: "Total 49.00 EUR" }],
    imageAssetKeys: [{ key: "att_img_1", filename: "receipt.png" }],
  });
  assert.ok(extState.includes("att_img_1"), "Asset key must be referenced in extractor state");
  assert.ok(extState.includes("Total 49.00 EUR"));

  // Gracefully handle invalid/empty PDF buffer without throwing
  const emptyPdfRes = await extractPdfTextFromBuffer(new Uint8Array([1, 2, 3]));
  assert.equal(emptyPdfRes, "");
});
