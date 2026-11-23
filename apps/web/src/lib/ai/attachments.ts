import PostalMime from "postal-mime";
import type { EmailExtractionAttachmentAsset } from "./types";
import { getImapClient } from "../../utils/imapPool.js";
import { resolveMailboxPath } from "../../utils/imapHelpers.js";

const MAX_SINGLE_FILE_BYTES = 4 * 1024 * 1024; // 4 MiB per file (Clairic / OpenRouter limit)
const MAX_TOTAL_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MiB combined
const MAX_PDF_TEXT_CHARS = 6000;
const MAX_IMAGES = 4;

export interface PreparedEmailAttachments {
  pdfTexts: Array<{ filename: string; text: string }>;
  imageAssets: EmailExtractionAttachmentAsset[];
  pdfDocuments: EmailExtractionAttachmentAsset[];
  primaryReceiptAttachment: {
    filename: string;
    mimeType: string;
    content: Uint8Array;
  } | null;
}

/**
 * Extracts readable text from a PDF buffer using `unpdf` (works in Node.js without canvas).
 */
export async function extractPdfTextFromBuffer(
  buffer: Uint8Array | ArrayBuffer,
  maxChars = MAX_PDF_TEXT_CHARS
): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const pdf = await getDocumentProxy(uint8);
    const { text } = await extractText(pdf, { mergePages: true });
    if (!text || typeof text !== "string") return "";
    return text.replace(/\s+/g, " ").trim().slice(0, maxChars);
  } catch (err: any) {
    console.warn("PDF text extraction warning (non-fatal):", err?.message);
    return "";
  }
}

function detectImageFormat(mimeType: string, filename: string): "png" | "jpg" | "webp" | null {
  const m = (mimeType || "").toLowerCase();
  const n = (filename || "").toLowerCase();
  if (m === "image/png" || n.endsWith(".png")) return "png";
  if (m === "image/jpeg" || m === "image/jpg" || n.endsWith(".jpg") || n.endsWith(".jpeg")) return "jpg";
  if (m === "image/webp" || n.endsWith(".webp")) return "webp";
  return null;
}

function isPdfAttachment(mimeType: string, filename: string): boolean {
  const m = (mimeType || "").toLowerCase();
  const n = (filename || "").toLowerCase();
  return m === "application/pdf" || n.endsWith(".pdf");
}

/**
 * Processes parsed MIME attachments into:
 * - extracted PDF text (for OpenRouter Clairic text state)
 * - Base64 image assets (up to 4 PNG/JPEG/WebP images within 4 MiB / 8 MiB limits)
 * - Base64 PDF documents (for self-hosted native Clairic)
 * - primaryReceiptAttachment (raw bytes for PocketBase receipt file upload)
 */
export async function prepareAttachmentsForExtraction(
  rawAttachments: Array<{
    filename?: string;
    mimeType?: string;
    content?: Uint8Array | ArrayBuffer;
    disposition?: string;
  }> = []
): Promise<PreparedEmailAttachments> {
  const pdfTexts: Array<{ filename: string; text: string }> = [];
  const imageAssets: EmailExtractionAttachmentAsset[] = [];
  const pdfDocuments: EmailExtractionAttachmentAsset[] = [];
  let primaryReceiptAttachment: PreparedEmailAttachments["primaryReceiptAttachment"] = null;
  let totalImageBytes = 0;

  for (let i = 0; i < rawAttachments.length; i++) {
    const att = rawAttachments[i];
    if (!att || !att.content) continue;

    const bytes = att.content instanceof Uint8Array ? att.content : new Uint8Array(att.content);
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_SINGLE_FILE_BYTES) continue;

    const filename = att.filename || `attachment_${i + 1}`;
    const mimeType = att.mimeType || "application/octet-stream";

    if (isPdfAttachment(mimeType, filename)) {
      if (!primaryReceiptAttachment) {
        primaryReceiptAttachment = { filename, mimeType: "application/pdf", content: bytes };
      }

      if (pdfTexts.length < 2) {
        const extracted = await extractPdfTextFromBuffer(bytes);
        if (extracted) {
          pdfTexts.push({ filename, text: extracted });
        }
      }

      if (pdfDocuments.length < 4) {
        pdfDocuments.push({
          key: `att_pdf_${pdfDocuments.length + 1}`,
          filename,
          mimeType: "application/pdf",
          format: "pdf",
          base64: Buffer.from(bytes).toString("base64"),
        });
      }
      continue;
    }

    // Skip tiny inline tracking pixels or signature icons (< 12 KB)
    if (bytes.byteLength < 12 * 1024) continue;

    const imgFormat = detectImageFormat(mimeType, filename);
    if (imgFormat && imageAssets.length < MAX_IMAGES && totalImageBytes + bytes.byteLength <= MAX_TOTAL_IMAGE_BYTES) {
      totalImageBytes += bytes.byteLength;
      const canonicalMime =
        imgFormat === "png" ? "image/png" : imgFormat === "webp" ? "image/webp" : "image/jpeg";

      if (!primaryReceiptAttachment && att.disposition !== "inline") {
        primaryReceiptAttachment = { filename, mimeType: canonicalMime, content: bytes };
      }

      imageAssets.push({
        key: `att_img_${imageAssets.length + 1}`,
        filename,
        mimeType: canonicalMime,
        format: imgFormat,
        base64: Buffer.from(bytes).toString("base64"),
      });
    }
  }

  return {
    pdfTexts,
    imageAssets,
    pdfDocuments,
    primaryReceiptAttachment,
  };
}

/**
 * Fetches raw attachments for a specific email directly from IMAP only when Step 1
 * identified an order or invoice/receipt that has attachments worth reading.
 */
export async function fetchEmailAttachmentsFromImap(params: {
  credentials: any[];
  seq: number | string;
  folder?: string;
}): Promise<PreparedEmailAttachments> {
  const { credentials, seq, folder = "inbox" } = params;
  const empty: PreparedEmailAttachments = {
    pdfTexts: [],
    imageAssets: [],
    pdfDocuments: [],
    primaryReceiptAttachment: null,
  };

  const numericSeq = Number(seq);
  if (!credentials || credentials.length < 4 || Number.isNaN(numericSeq) || numericSeq <= 0) {
    return empty;
  }

  let lock: any = null;
  try {
    const client = await getImapClient(credentials);
    const mailboxPath = await resolveMailboxPath(client, folder, credentials[0].user);
    lock = await client.getMailboxLock(mailboxPath);

    const msg = await client.fetchOne(`${numericSeq}`, { source: true });
    if (!msg || !msg.source) return empty;

    const parser = new PostalMime();
    const parsed = await parser.parse(msg.source);
    return await prepareAttachmentsForExtraction(parsed.attachments || []);
  } catch (err: any) {
    console.warn("Attachment fetch for Clairic skipped (non-fatal):", err?.message);
    return empty;
  } finally {
    if (lock) {
      try {
        lock.release();
      } catch {}
    }
  }
}
