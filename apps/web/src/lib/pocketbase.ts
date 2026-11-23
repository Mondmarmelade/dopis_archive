import PocketBase from "pocketbase";

export interface PbOrder {
  id?: string;
  user_email: string;
  order_number?: string;
  merchant?: string;
  order_type?: string;
  stage?: string;
  status_title?: string;
  status_detail?: string;
  amount?: string;
  carrier?: string;
  tracking_number?: string;
  order_date?: string;
  raw_metadata?: any;
  created?: string;
  updated?: string;
  expand?: {
    receipts?: PbReceipt[];
    email_records?: PbEmailRecord[];
  };
}

export interface PbReceipt {
  id?: string;
  user_email: string;
  order?: string | null;
  receipt_type?: string;
  title?: string;
  merchant?: string;
  amount?: string;
  provider?: string;
  transaction_id?: string;
  date?: string;
  file?: string | null;
  source_mail_id?: string;
  source_subject?: string;
  notes?: string;
  raw_metadata?: any;
  created?: string;
  updated?: string;
  expand?: {
    order?: PbOrder;
  };
}

export interface PbEmailRecord {
  id?: string;
  user_email: string;
  uid?: number;
  message_id?: string;
  seq?: number;
  folder?: string;
  subject?: string;
  sender_email?: string;
  sender_name?: string;
  date?: string;
  html?: string | null;
  text?: string | null;
  read?: boolean;
  flagged?: boolean;
  attachments?: any[];
  to?: any[];
  cc?: any[];
  from?: any;
  ai_summary?: any;
  ai_category?: string;
  ai_confidence?: number;
  ai_tags?: string[];
  ai_analysis?: any;
  ai_analyzed_at?: string;
  header_signals?: any;
  has_receipt?: boolean;
  is_order?: boolean;
  created?: string;
  updated?: string;
}

let pbInstance: PocketBase | null = null;
let isInitialized = false;

export function getPocketBaseUrl(): string {
  if (typeof process !== "undefined" && process.env?.POCKETBASE_URL) {
    return process.env.POCKETBASE_URL;
  }
  try {
    if (typeof import.meta !== "undefined" && (import.meta as any).env?.POCKETBASE_URL) {
      return (import.meta as any).env.POCKETBASE_URL;
    }
  } catch {}
  return "http://127.0.0.1:8090";
}

export function getPocketBaseClient(): PocketBase {
  if (!pbInstance) {
    pbInstance = new PocketBase(getPocketBaseUrl());
    // Auto cancellation disabled so multiple server requests don't cancel each other
    pbInstance.autoCancellation(false);
  }
  return pbInstance;
}

/**
 * Checks if PocketBase is reachable and responsive
 */
export async function isPocketBaseAvailable(): Promise<boolean> {
  try {
    const url = getPocketBaseUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${url}/api/health`, { signal: controller.signal });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

let superuserAuthPromise: Promise<void> | null = null;

export async function ensureSuperuserAuth(): Promise<void> {
  const pb = getPocketBaseClient();
  if (pb.authStore.isValid) return;

  if (superuserAuthPromise) return superuserAuthPromise;

  superuserAuthPromise = (async () => {
    try {
      const email =
        (typeof process !== "undefined" && process.env?.POCKETBASE_ADMIN_EMAIL) ||
        "admin@dopis.local";
      const pass =
        (typeof process !== "undefined" && process.env?.POCKETBASE_ADMIN_PASSWORD) ||
        "dopis_admin_secret_1234";

      await pb.collection("_superusers").authWithPassword(email, pass);
    } catch (e: any) {
      console.warn("PocketBase superuser auth warning:", e?.message);
    } finally {
      superuserAuthPromise = null;
    }
  })();

  return superuserAuthPromise;
}

/**
 * Ensures schema collections exist if not yet migrated.
 */
export async function ensurePocketBaseSchema(): Promise<void> {
  if (isInitialized) return;
  const pb = getPocketBaseClient();
  const available = await isPocketBaseAvailable();
  if (!available) return;

  await ensureSuperuserAuth();

  try {
    const collections = await pb.collections.getFullList();
    const colNames = new Set(collections.map((c) => c.name));

    if (!colNames.has("orders")) {
      try {
        await pb.collections.create({
          name: "orders",
          type: "base",
          listRule: "",
          viewRule: "",
          createRule: "",
          updateRule: "",
          deleteRule: "",
          fields: [
            { name: "user_email", type: "text", required: true },
            { name: "order_number", type: "text" },
            { name: "merchant", type: "text" },
            { name: "order_type", type: "text" },
            { name: "stage", type: "text" },
            { name: "status_title", type: "text" },
            { name: "status_detail", type: "text" },
            { name: "amount", type: "text" },
            { name: "carrier", type: "text" },
            { name: "tracking_number", type: "text" },
            { name: "order_date", type: "text" },
            { name: "raw_metadata", type: "json" },
          ],
        });
      } catch (e: any) {
        console.warn("Could not create 'orders' collection:", e?.message);
      }
    }

    if (!colNames.has("receipts")) {
      try {
        const ordersCol = await pb.collections.getOne("orders").catch(() => null);
        await pb.collections.create({
          name: "receipts",
          type: "base",
          listRule: "",
          viewRule: "",
          createRule: "",
          updateRule: "",
          deleteRule: "",
          fields: [
            { name: "user_email", type: "text", required: true },
            {
              name: "order",
              type: "relation",
              collectionId: ordersCol?.id || undefined,
              maxSelect: 1,
            },
            { name: "receipt_type", type: "text" },
            { name: "title", type: "text" },
            { name: "merchant", type: "text" },
            { name: "amount", type: "text" },
            { name: "provider", type: "text" },
            { name: "transaction_id", type: "text" },
            { name: "date", type: "text" },
            {
              name: "file",
              type: "file",
              maxSize: 15728640,
              mimeTypes: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
            },
            { name: "source_mail_id", type: "text" },
            { name: "source_subject", type: "text" },
            { name: "notes", type: "text" },
            { name: "raw_metadata", type: "json" },
          ],
        });
      } catch (e: any) {
        console.warn("Could not create 'receipts' collection:", e?.message);
      }
    }

    if (!colNames.has("email_records")) {
      try {
        await pb.collections.create({
          name: "email_records",
          type: "base",
          listRule: "",
          viewRule: "",
          createRule: "",
          updateRule: "",
          deleteRule: "",
          fields: [
            { name: "user_email", type: "text", required: true },
            { name: "message_id", type: "text" },
            { name: "seq", type: "number" },
            { name: "uid", type: "number" },
            { name: "folder", type: "text" },
            { name: "subject", type: "text" },
            { name: "sender_email", type: "text" },
            { name: "sender_name", type: "text" },
            { name: "date", type: "text" },
            { name: "html", type: "text", max: 10000000 },
            { name: "text", type: "text", max: 10000000 },
            { name: "read", type: "bool" },
            { name: "flagged", type: "bool" },
            { name: "attachments", type: "json" },
            { name: "to", type: "json" },
            { name: "cc", type: "json" },
            { name: "from", type: "json" },
            { name: "ai_summary", type: "json" },
            { name: "ai_category", type: "text" },
            { name: "ai_confidence", type: "number" },
            { name: "ai_tags", type: "json" },
            { name: "ai_analysis", type: "json" },
            { name: "ai_analyzed_at", type: "text" },
            { name: "header_signals", type: "json" },
            { name: "has_receipt", type: "bool" },
            { name: "is_order", type: "bool" },
          ],
        });
      } catch (e: any) {
        console.warn("Could not create 'email_records' collection:", e?.message);
      }
    } else {
      // If collection already exists, ensure html/text limits and AI fields are present
      try {
        const emailCol = await pb.collections.getOne("email_records");
        let modified = false;
        const existingFieldNames = new Set((emailCol.fields || []).map((f: any) => f.name));
        for (const field of (emailCol.fields || [])) {
          if ((field.name === "html" || field.name === "text") && (!field.max || field.max < 10000000)) {
            field.max = 10000000;
            modified = true;
          }
        }
        const requiredAiFields = [
          { name: "ai_category", type: "text" },
          { name: "ai_confidence", type: "number" },
          { name: "ai_tags", type: "json" },
          { name: "ai_analysis", type: "json" },
          { name: "ai_analyzed_at", type: "text" },
          { name: "header_signals", type: "json" },
        ];
        for (const f of requiredAiFields) {
          if (!existingFieldNames.has(f.name)) {
            emailCol.fields.push(f);
            modified = true;
          }
        }
        if (modified) {
          await pb.collections.update(emailCol.id, emailCol);
        }
      } catch (updateErr: any) {
        console.warn("Could not update 'email_records' field limits:", updateErr?.message);
      }
    }

    isInitialized = true;
  } catch (err: any) {
    console.warn("PocketBase schema check error:", err?.message);
  }
}

/**
 * Returns public download URL for a receipt file
 */
export function getReceiptFileUrl(receipt: PbReceipt): string | null {
  if (!receipt || !receipt.id || !receipt.file) return null;
  const baseUrl = getPocketBaseUrl().replace(/\/$/, "");
  return `${baseUrl}/api/files/receipts/${receipt.id}/${receipt.file}`;
}
