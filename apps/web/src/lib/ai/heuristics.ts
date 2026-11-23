import type { EmailHeaderSignals } from "./types";

const MAX_CLEF_STATE_CHARS = 2800;
const MAX_CLAIRIC_STATE_CHARS = 11500;

/**
 * Strips HTML tags, styles, scripts, and noisy tracking URLs into clean readable text.
 */
export function cleanEmailBody(text?: string | null, html?: string | null, maxChars = MAX_CLAIRIC_STATE_CHARS): string {
  let raw = typeof text === "string" ? text.trim() : "";

  if (!raw && typeof html === "string" && html.trim()) {
    raw = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(?:br|\/p|\/div|\/tr|\/li|\/h[1-6])[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'");
  }

  if (!raw) return "";

  // Collapse very long tracking URLs so they do not waste tokens
  raw = raw.replace(/https?:\/\/[^\s]{90,}/gi, (url) => {
    try {
      const parsed = new URL(url);
      return `${parsed.origin}${parsed.pathname.slice(0, 32)}…`;
    } catch {
      return "[LINK]";
    }
  });

  // Normalize whitespace while keeping paragraph breaks
  raw = raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (raw.length > maxChars) {
    return raw.slice(0, maxChars).trim();
  }
  return raw;
}

/**
 * Extracts deterministic RFC header signals from PostalMime parsed headers or pre-stored signals.
 */
export function extractHeaderSignals(
  headers?: Array<{ key?: string; value?: string }> | Record<string, any> | null,
  attachments?: Array<{ filename?: string; mimeType?: string; contentType?: string }> | null
): EmailHeaderSignals {
  const map = new Map<string, string>();

  if (Array.isArray(headers)) {
    for (const h of headers) {
      if (h?.key && h?.value !== undefined && h?.value !== null) {
        map.set(String(h.key).toLowerCase(), String(h.value));
      }
    }
  } else if (headers && typeof headers === "object") {
    // Support already-computed EmailHeaderSignals object
    if ("hasListUnsubscribe" in headers) {
      return {
        hasListUnsubscribe: Boolean(headers.hasListUnsubscribe),
        listId: headers.listId || null,
        precedence: headers.precedence || null,
        autoSubmitted: headers.autoSubmitted || null,
        mailer: headers.mailer || null,
        attachmentNames: Array.isArray(headers.attachmentNames) ? headers.attachmentNames : [],
        hasPdfAttachment: Boolean(headers.hasPdfAttachment),
        hasImageAttachment: Boolean(headers.hasImageAttachment),
      };
    }
    for (const [k, v] of Object.entries(headers)) {
      if (v !== undefined && v !== null) {
        map.set(k.toLowerCase(), String(v));
      }
    }
  }

  const attachmentList = Array.isArray(attachments) ? attachments : [];
  const attachmentNames = attachmentList
    .map((a) => a?.filename)
    .filter((name): name is string => Boolean(name && typeof name === "string"))
    .slice(0, 10);

  const hasPdfAttachment = attachmentList.some((a) => {
    const mime = String(a?.mimeType || a?.contentType || "").toLowerCase();
    const name = String(a?.filename || "").toLowerCase();
    return mime.includes("pdf") || name.endsWith(".pdf");
  });

  const hasImageAttachment = attachmentList.some((a) => {
    const mime = String(a?.mimeType || a?.contentType || "").toLowerCase();
    const name = String(a?.filename || "").toLowerCase();
    return (
      mime === "image/png" ||
      mime === "image/jpeg" ||
      mime === "image/webp" ||
      /\.(png|jpe?g|webp)$/i.test(name)
    );
  });

  return {
    hasListUnsubscribe: map.has("list-unsubscribe") || map.has("list-unsubscribe-post"),
    listId: map.get("list-id") || null,
    precedence: map.get("precedence") || null,
    autoSubmitted: map.get("auto-submitted") || null,
    mailer: map.get("x-mailer") || map.get("x-sg-eid") || null,
    attachmentNames,
    hasPdfAttachment,
    hasImageAttachment,
  };
}

/**
 * Builds a compact state string for Clef (stays well within the 2K token Workers AI ceiling).
 */
export function buildDeciderState(params: {
  from: string;
  subject: string;
  body: string;
  date?: string;
  headers?: EmailHeaderSignals;
}): string {
  const { from, subject, body, date, headers } = params;
  const headerNotes: string[] = [];

  if (headers?.hasListUnsubscribe) headerNotes.push("List-Unsubscribe: present");
  if (headers?.listId) headerNotes.push(`List-Id: ${headers.listId.slice(0, 80)}`);
  if (headers?.precedence) headerNotes.push(`Precedence: ${headers.precedence}`);
  if (headers?.autoSubmitted && headers.autoSubmitted.toLowerCase() !== "no") {
    headerNotes.push(`Auto-Submitted: ${headers.autoSubmitted}`);
  }
  if (headers?.attachmentNames && headers.attachmentNames.length > 0) {
    headerNotes.push(`Attachments: ${headers.attachmentNames.join(", ")}`);
  }

  const metaLines = [
    `From: ${from || "Unknown"}`,
    `Subject: ${subject || "(No Subject)"}`,
    date ? `Date: ${date}` : null,
    headerNotes.length > 0 ? `Header-Signals: ${headerNotes.join(" | ")}` : null,
  ].filter(Boolean);

  const prefix = `${metaLines.join("\n")}\n\nBody:\n`;
  const remainingBudget = Math.max(400, MAX_CLEF_STATE_CHARS - prefix.length);
  const clippedBody = body.length > remainingBudget ? `${body.slice(0, remainingBudget)}…` : body;

  return `${prefix}${clippedBody}`;
}

/**
 * Builds the richer text state for Clairic extraction (email body + extracted PDF text + image asset references).
 */
export function buildExtractorState(params: {
  from: string;
  subject: string;
  body: string;
  date?: string;
  pdfTexts?: Array<{ filename: string; text: string }>;
  imageAssetKeys?: Array<{ key: string; filename: string }>;
}): string {
  const { from, subject, body, date, pdfTexts = [], imageAssetKeys = [] } = params;

  const sections: string[] = [
    `From: ${from || "Unknown"}\nSubject: ${subject || "(No Subject)"}${date ? `\nDate: ${date}` : ""}`,
  ];

  if (imageAssetKeys.length > 0) {
    // OpenRouter Extractions API requires every asset key to be referenced in state when state has text
    const refs = imageAssetKeys.map((img) => `- ${img.filename}: ${img.key}`).join("\n");
    sections.push(`Attached Images:\n${refs}`);
  }

  sections.push(`Email Body:\n${body}`);

  if (pdfTexts.length > 0) {
    const pdfBlock = pdfTexts
      .map((pdf) => `--- PDF Attachment: ${pdf.filename} ---\n${pdf.text}`)
      .join("\n\n");
    sections.push(pdfBlock);
  }

  const combined = sections.join("\n\n");
  if (combined.length <= MAX_CLAIRIC_STATE_CHARS) {
    return combined;
  }

  // Keep headers + asset references + beginning of body + PDF text within limit
  return combined.slice(0, MAX_CLAIRIC_STATE_CHARS);
}

/**
 * Parses an ISO date string into YYYY-MM-DD for Clairic's reference_date parameter.
 */
export function toIsoDateOnly(dateInput?: string | Date | null): string {
  if (dateInput) {
    const parsed = new Date(dateInput);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }
  return new Date().toISOString().slice(0, 10);
}
