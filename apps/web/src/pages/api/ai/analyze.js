import { resolvePipelineConfig } from "../../../utils/aiClient.js";
import { anonymizePii } from "../../../utils/aiAnonymizer.js";
import { getCredentials, handleOptions, jsonResponse } from "../../../utils/authHelper.js";
import { syncAnalysisToPocketBase } from "../../../lib/orderReceiptSync.ts";
import { getLocalEmailDetail } from "../../../lib/imapSyncEngine.ts";
import {
  cleanEmailBody,
  extractHeaderSignals,
  buildExtractorState,
  toIsoDateOnly,
} from "../../../lib/ai/heuristics.ts";
import { runEmailDecisions } from "../../../lib/ai/decider.ts";
import { runEmailExtraction, selectExtractionFields } from "../../../lib/ai/extractor.ts";
import { fetchEmailAttachmentsFromImap } from "../../../lib/ai/attachments.ts";
import { buildStructuredOverview, generateOptionalTextSummary } from "../../../lib/ai/summarizer.ts";

export async function OPTIONS() {
  return handleOptions();
}

function formatAmountString(amount, currency) {
  if (amount === null || amount === undefined || amount === "") return null;
  const num = typeof amount === "number" ? amount : Number(String(amount).replace(",", "."));
  const curr = typeof currency === "string" && currency.trim() ? currency.trim().toUpperCase() : "EUR";
  if (!Number.isNaN(num)) {
    const formatted = num.toFixed(2).replace(".", ",");
    return curr === "EUR" || curr === "€" ? `${formatted} €` : `${formatted} ${curr}`;
  }
  return `${amount}${currency ? ` ${currency}` : ""}`;
}

export async function POST({ request, cookies }) {
  const startTime = performance.now();

  const credentials = getCredentials(request, cookies);
  if (!credentials || credentials.length < 4) {
    return jsonResponse(
      { error: "Unauthorized. Please provide a valid Bearer token or log in." },
      401
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const {
    subject = "",
    from = "",
    text = "",
    html = "",
    date = "",
    seq = "",
    id = "",
    folder = "inbox",
    headers = null,
    attachments = null,
    settings = {},
    forceTextSummary = false,
  } = body;

  const userEmail = credentials[0]?.user;
  const mailSeq = seq || id || "";

  // Optionally enrich with stored header_signals / attachments metadata from PocketBase
  let storedHeaders = headers;
  let storedAttachments = attachments;
  let fallbackText = text;
  let fallbackHtml = html;

  if ((!storedHeaders || (!fallbackText && !fallbackHtml)) && userEmail && mailSeq) {
    try {
      const localRecord = await getLocalEmailDetail(userEmail, mailSeq, folder);
      if (localRecord) {
        if (!storedHeaders && localRecord.header_signals) storedHeaders = localRecord.header_signals;
        if (!storedAttachments && localRecord.attachments) storedAttachments = localRecord.attachments;
        if (!fallbackText && localRecord.text) fallbackText = localRecord.text;
        if (!fallbackHtml && localRecord.html) fallbackHtml = localRecord.html;
      }
    } catch {}
  }

  const headerSignals = extractHeaderSignals(storedHeaders, storedAttachments);
  let cleanedBody = cleanEmailBody(fallbackText, fallbackHtml);
  let senderInfo = from;
  let subjectInfo = subject;

  let config;
  try {
    config = resolvePipelineConfig(settings);
  } catch (cfgErr) {
    return jsonResponse({ error: cfgErr.message }, 400);
  }

  if (config.anonymizePii) {
    cleanedBody = anonymizePii(cleanedBody);
    senderInfo = anonymizePii(senderInfo);
    subjectInfo = anonymizePii(subjectInfo);
  }

  if (!cleanedBody && !subjectInfo) {
    return jsonResponse({
      summary: ["Leere E-Mail ohne Inhalt."],
      category: "Sonstiges",
      categoryConfidence: 1,
      tags: [],
      actionItems: [],
      paymentInfo: null,
      orderInfo: null,
      pipeline: "system_one",
      _debug: {
        model: "none",
        durationMs: 0,
        timestamp: new Date().toISOString(),
      },
    });
  }

  try {
    // =========================================================================
    // STEP 1: Fast Classification & Routing (Clef / System One / Fallback)
    // =========================================================================
    const decision = await runEmailDecisions(
      {
        subject: subjectInfo,
        from: senderInfo,
        text: cleanedBody,
        date: date || undefined,
        headers: headerSignals,
      },
      config
    );

    // =========================================================================
    // STEP 2: Conditional Typed Extraction (Clairic / Fallback) + Attachments
    // =========================================================================
    const needsExtraction = Boolean(selectExtractionFields(decision, config));
    let preparedAttachments = {
      pdfTexts: [],
      imageAssets: [],
      pdfDocuments: [],
      primaryReceiptAttachment: null,
    };

    const hasReadableAttachment =
      headerSignals.hasPdfAttachment ||
      headerSignals.hasImageAttachment ||
      (Array.isArray(storedAttachments) && storedAttachments.length > 0);

    const shouldFetchAttachments =
      needsExtraction &&
      config.extractAttachments &&
      hasReadableAttachment &&
      Boolean(mailSeq) &&
      (decision.signals.isOrder >= config.orderConfidenceThreshold ||
        decision.signals.isPaymentReceipt >= config.receiptConfidenceThreshold ||
        decision.category === "Rechnung");

    if (shouldFetchAttachments) {
      preparedAttachments = await fetchEmailAttachmentsFromImap({
        credentials,
        seq: mailSeq,
        folder,
      });

      if (config.anonymizePii && preparedAttachments.pdfTexts.length > 0) {
        preparedAttachments.pdfTexts = preparedAttachments.pdfTexts.map((pdf) => ({
          filename: pdf.filename,
          text: anonymizePii(pdf.text),
        }));
      }
    }

    const extractorState = buildExtractorState({
      from: senderInfo,
      subject: subjectInfo,
      body: cleanedBody,
      date: date || undefined,
      pdfTexts: preparedAttachments.pdfTexts,
      imageAssetKeys: preparedAttachments.imageAssets.map((img) => ({
        key: img.key,
        filename: img.filename,
      })),
    });

    const extraction = await runEmailExtraction(
      {
        stateText: extractorState,
        referenceDate: toIsoDateOnly(date),
        imageAssets: preparedAttachments.imageAssets,
        pdfDocuments: preparedAttachments.pdfDocuments,
      },
      decision,
      config
    );

    // =========================================================================
    // Map Step 1 + Step 2 results into Dopis's structured orderInfo & paymentInfo
    // =========================================================================
    const f = extraction.fields || {};

    const isPayment =
      decision.signals.isPaymentReceipt >= config.receiptConfidenceThreshold ||
      (decision.category === "Rechnung" &&
        Boolean(f.payment_amount?.value || f.invoice_number?.value || f.payment_provider?.value));

    const paymentInfo = isPayment
      ? {
          isPaymentReceipt: true,
          provider: f.payment_provider?.value || null,
          paidTo: f.paid_to?.value || f.merchant?.value || null,
          amount: formatAmountString(
            f.payment_amount?.value ?? f.total_amount?.value,
            f.payment_currency?.value ?? f.currency?.value
          ),
          transactionId: f.transaction_id?.value || null,
          invoiceNumber: f.invoice_number?.value || null,
          dueDate: f.due_date?.value || null,
          confidence: decision.signals.isPaymentReceipt,
        }
      : null;

    const isOrder = decision.signals.isOrder >= config.orderConfidenceThreshold;
    const orderInfo = isOrder
      ? {
          isOrder: true,
          orderType: decision.orderType || "physical",
          merchant: f.merchant?.value || f.paid_to?.value || null,
          orderId: f.order_id?.value || null,
          trackingNumber: f.tracking_number?.value || null,
          carrier: f.carrier?.value || null,
          productSummary: f.product_summary?.value || null,
          amount: formatAmountString(
            f.total_amount?.value ?? f.payment_amount?.value,
            f.currency?.value ?? f.payment_currency?.value
          ),
          stage: decision.orderStage || "ordered",
          statusTitle: null,
          statusDetail: null,
          eventDate: f.event_date?.value || null,
          venue: f.venue?.value || null,
          deliveryLocation: f.delivery_location?.value || null,
          estimatedDelivery: f.estimated_delivery?.value || null,
          confidence: decision.signals.isOrder,
        }
      : null;

    // =========================================================================
    // Build structured German overview (0 LLM tokens) + optional On-Demand text summary
    // =========================================================================
    const overview = buildStructuredOverview({
      decision,
      extraction,
      subject: subjectInfo,
      from: senderInfo,
    });

    let summary = overview.summary;
    let actionItems = overview.actionItems;
    let summaryStage = {
      used: false,
      skipped: true,
      skipReason: "System-One-Übersicht verwendet (kein Text-LLM nötig)",
      durationMs: 0,
    };

    if (forceTextSummary && config.summaryEnabled) {
      try {
        const llmSummary = await generateOptionalTextSummary({
          subject: subjectInfo,
          from: senderInfo,
          body: cleanedBody,
          config,
        });
        summary = llmSummary.summary;
        if (llmSummary.actionItems.length > 0) {
          actionItems = llmSummary.actionItems;
        }
        summaryStage = {
          used: true,
          skipped: false,
          model: llmSummary.model,
          protocol: "openai_compat",
          durationMs: llmSummary.durationMs,
          inputTokens: llmSummary.promptTokens,
          outputTokens: llmSummary.completionTokens,
        };
      } catch (sumErr) {
        console.warn("Optional text summary failed (falling back to structured overview):", sumErr?.message);
      }
    }

    const totalDurationMs = Math.round(performance.now() - startTime);
    const totalInputTokens =
      (decision.inputTokens || 0) +
      (extraction.inputTokens || 0) +
      (summaryStage.inputTokens || 0);
    const totalOutputTokens =
      (decision.outputTokens || 0) +
      (extraction.outputTokens || 0) +
      (summaryStage.outputTokens || 0);
    const totalCostUsd =
      typeof decision.costUsd === "number" || typeof extraction.costUsd === "number"
        ? Number(((decision.costUsd || 0) + (extraction.costUsd || 0)).toFixed(6))
        : undefined;

    const analysisResult = {
      summary,
      category: decision.category,
      categoryConfidence: decision.categoryConfidence,
      categoryProbabilities: decision.categoryProbabilities,
      signals: decision.signals,
      tags: overview.tags,
      actionItems,
      paymentInfo,
      orderInfo,
      verificationCode: extraction.verificationCode || null,
      actionDeadline: extraction.actionDeadline || null,
      extractedFields: extraction.fields || {},
      attachmentsAnalyzed: {
        pdfCount: preparedAttachments.pdfTexts.length,
        imageCount: preparedAttachments.imageAssets.length,
        filenames: [
          ...preparedAttachments.pdfTexts.map((p) => p.filename),
          ...preparedAttachments.imageAssets.map((i) => i.filename),
        ],
      },
      pipeline: {
        preset: config.preset,
        deciderModel: decision.model,
        deciderProtocol: decision.protocol,
        extractorModel: extraction.skipped ? null : extraction.model,
        extractorProtocol: extraction.skipped ? null : extraction.protocol,
        extractorSkipped: extraction.skipped,
        summaryUsed: summaryStage.used,
      },
      timestamp: Date.now(),
      _debug: {
        model: extraction.skipped
          ? decision.model
          : `${decision.model} + ${extraction.model}`,
        durationMs: totalDurationMs,
        timestamp: new Date().toISOString(),
        promptTokens: totalInputTokens,
        completionTokens: totalOutputTokens,
        totalCostUsd,
        stages: {
          decider: {
            used: true,
            model: decision.model,
            protocol: decision.protocol,
            durationMs: decision.durationMs,
            inputTokens: decision.inputTokens,
            outputTokens: decision.outputTokens,
            costUsd: decision.costUsd,
          },
          extractor: {
            used: !extraction.skipped,
            skipped: extraction.skipped,
            skipReason: extraction.skipReason,
            model: extraction.model,
            protocol: extraction.protocol,
            durationMs: extraction.durationMs,
            inputTokens: extraction.inputTokens,
            outputTokens: extraction.outputTokens,
            passes: extraction.passes,
            costUsd: extraction.costUsd,
          },
          summarizer: summaryStage,
        },
        decisions: decision.raw,
        extractions: extraction.raw,
      },
    };

    // Always persist analysis into PocketBase SQLite (not only for orders/receipts!)
    let pocketBaseSync = null;
    if (userEmail && mailSeq) {
      try {
        pocketBaseSync = await syncAnalysisToPocketBase({
          userEmail,
          mailSeq,
          mailFolder: folder,
          mailSubject: subject,
          senderEmail: from,
          senderName: from,
          mailDate: date || new Date().toISOString(),
          analysis: analysisResult,
          attachmentData: preparedAttachments.primaryReceiptAttachment,
        });
      } catch (syncErr) {
        console.warn("PocketBase background sync error (non-fatal):", syncErr?.message);
      }
    }

    return jsonResponse({
      ...analysisResult,
      pocketBaseSync,
    });
  } catch (error) {
    console.error("AI analysis failed:", error);
    const status = error.status || error.statusCode || 500;
    let friendlyMessage = error.message || "Failed to analyze email with AI";

    if (status === 503 || friendlyMessage.includes("503") || friendlyMessage.includes("ServiceUnavailable")) {
      friendlyMessage =
        "KI-Endpunkt vorübergehend überlastet (503 Service Unavailable). Bitte in wenigen Sekunden erneut versuchen.";
    } else if (status === 429 || friendlyMessage.includes("429") || friendlyMessage.includes("RateLimit")) {
      friendlyMessage = "Rate Limit erreicht (429 Too Many Requests). Bitte kurz warten.";
    } else if (status === 401 || friendlyMessage.includes("401")) {
      friendlyMessage = "Authentifizierung fehlgeschlagen (401). Bitte API-Key in den Einstellungen prüfen.";
    }

    return jsonResponse(
      { error: friendlyMessage },
      status >= 400 && status < 600 ? status : 500
    );
  }
}
