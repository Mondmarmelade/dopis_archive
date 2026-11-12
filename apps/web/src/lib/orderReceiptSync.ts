import {
  getPocketBaseClient,
  isPocketBaseAvailable,
  ensurePocketBaseSchema,
  getReceiptFileUrl,
  type PbOrder,
  type PbReceipt,
  type PbEmailRecord,
} from "./pocketbase.ts";
import type { AiAnalysisResult, OrderInfo, PaymentInfo } from "./aiCache.ts";

export interface SyncResult {
  synced: boolean;
  order?: PbOrder | null;
  receipt?: PbReceipt | null;
  emailRecord?: PbEmailRecord | null;
  message?: string;
}

/**
 * Normalizes text for matching
 */
function cleanStr(val: any): string {
  if (!val) return "";
  return String(val).trim().toLowerCase();
}

/**
 * Persists and auto-links AI Analysis, Orders and Receipts in PocketBase
 */
export async function syncAnalysisToPocketBase(params: {
  userEmail: string;
  mailSeq: number | string;
  mailFolder?: string;
  mailSubject?: string;
  senderEmail?: string;
  senderName?: string;
  mailDate?: string;
  analysis: AiAnalysisResult;
  attachmentData?: { filename: string; mimeType: string; content: Uint8Array | ArrayBuffer } | null;
}): Promise<SyncResult> {
  const {
    userEmail,
    mailSeq,
    mailFolder = "inbox",
    mailSubject = "",
    senderEmail = "",
    senderName = "",
    mailDate = new Date().toISOString(),
    analysis,
    attachmentData,
  } = params;

  if (!userEmail) {
    return { synced: false, message: "Missing user email" };
  }

  const available = await isPocketBaseAvailable();
  if (!available) {
    return { synced: false, message: "PocketBase server is currently unreachable" };
  }

  await ensurePocketBaseSchema();
  const pb = getPocketBaseClient();

  let createdOrUpdatedOrder: PbOrder | null = null;
  let createdOrUpdatedReceipt: PbReceipt | null = null;

  try {
    const orderInfo: OrderInfo | undefined = analysis?.orderInfo ?? undefined;
    const paymentInfo: PaymentInfo | undefined = analysis?.paymentInfo ?? undefined;

    // 1. Process Order if identified
    if (orderInfo && orderInfo.isOrder) {
      const orderNumber = orderInfo.orderId ? String(orderInfo.orderId).trim() : "";
      const merchant = orderInfo.merchant ? String(orderInfo.merchant).trim() : senderName || senderEmail;
      const trackingNumber = orderInfo.trackingNumber ? String(orderInfo.trackingNumber).trim() : "";

      // Check if existing order matches this user
      let existingOrder: any = null;
      if (orderNumber) {
        try {
          existingOrder = await pb
            .collection("orders")
            .getFirstListItem(`user_email = "${userEmail}" && order_number = "${orderNumber}"`);
        } catch {}
      }

      if (!existingOrder && trackingNumber) {
        try {
          existingOrder = await pb
            .collection("orders")
            .getFirstListItem(`user_email = "${userEmail}" && tracking_number = "${trackingNumber}"`);
        } catch {}
      }

      const orderPayload: Partial<PbOrder> = {
        user_email: userEmail,
        order_number: orderNumber || existingOrder?.order_number || undefined,
        merchant: merchant || existingOrder?.merchant,
        order_type: orderInfo.orderType || existingOrder?.order_type || "physical",
        stage: orderInfo.stage || existingOrder?.stage || "ordered",
        status_title: orderInfo.statusTitle || existingOrder?.status_title,
        status_detail: orderInfo.statusDetail || existingOrder?.status_detail,
        amount: orderInfo.amount || existingOrder?.amount,
        carrier: orderInfo.carrier || existingOrder?.carrier,
        tracking_number: trackingNumber || existingOrder?.tracking_number,
        order_date: mailDate || existingOrder?.order_date,
        raw_metadata: {
          productSummary: orderInfo.productSummary,
          estimatedDelivery: orderInfo.estimatedDelivery,
          deliveryLocation: orderInfo.deliveryLocation,
          venue: orderInfo.venue,
          eventDate: orderInfo.eventDate,
          transactionId: paymentInfo?.transactionId,
          lastMailSeq: mailSeq,
        },
      };

      if (existingOrder) {
        createdOrUpdatedOrder = await pb.collection("orders").update(existingOrder.id, orderPayload);
      } else {
        createdOrUpdatedOrder = await pb.collection("orders").create(orderPayload);
      }
    }

    // 2. Process Receipt if identified
    const isReceipt =
      Boolean(paymentInfo?.isPaymentReceipt) ||
      analysis.category === "Rechnung" ||
      analysis.tags?.some((t) => ["rechnung", "quittung", "beleg", "invoice", "receipt"].includes(cleanStr(t)));

    if (isReceipt || paymentInfo?.amount) {
      const receiptTitle = mailSubject || "Zahlungsbeleg";
      const merchant = paymentInfo?.paidTo || orderInfo?.merchant || senderName || senderEmail;
      const amount = paymentInfo?.amount || orderInfo?.amount || "";
      const provider = paymentInfo?.provider || "";
      const transactionId = paymentInfo?.transactionId || "";

      // Check if existing receipt already saved for this mail
      let existingReceipt: any = null;
      try {
        existingReceipt = await pb
          .collection("receipts")
          .getFirstListItem(`user_email = "${userEmail}" && source_mail_id = "${mailSeq}"`);
      } catch {}

      // Try auto-linking with order
      let targetOrderId: string | null = createdOrUpdatedOrder?.id || existingReceipt?.order || null;

      if (!targetOrderId) {
        // Try linking by matching order_number or merchant
        if (orderInfo?.orderId) {
          try {
            const matchedOrder = await pb
              .collection("orders")
              .getFirstListItem(`user_email = "${userEmail}" && order_number = "${orderInfo.orderId}"`);
            if (matchedOrder) targetOrderId = matchedOrder.id;
          } catch {}
        }

        if (!targetOrderId && transactionId) {
          try {
            const matchedOrder = await pb
              .collection("orders")
              .getFirstListItem(
                `user_email = "${userEmail}" && raw_metadata.transactionId = "${transactionId}"`
              );
            if (matchedOrder) targetOrderId = matchedOrder.id;
          } catch {}
        }
      }

      // Prepare FormData for file upload if attachment present
      if (attachmentData && attachmentData.content) {
        const formData = new FormData();
        formData.append("user_email", userEmail);
        if (targetOrderId) formData.append("order", targetOrderId);
        formData.append("receipt_type", isReceipt ? "invoice" : "payment_receipt");
        formData.append("title", receiptTitle);
        formData.append("merchant", merchant);
        formData.append("amount", amount);
        formData.append("provider", provider);
        formData.append("transaction_id", transactionId);
        formData.append("date", mailDate);
        formData.append("source_mail_id", String(mailSeq));
        formData.append("source_subject", mailSubject);
        formData.append("notes", `Automatisch extrahiert aus Mail #${mailSeq}`);

        // Create Blob from Uint8Array/ArrayBuffer
        const blob = new Blob([attachmentData.content as any], { type: attachmentData.mimeType });
        formData.append("file", blob, attachmentData.filename);

        if (existingReceipt) {
          createdOrUpdatedReceipt = await pb.collection("receipts").update(existingReceipt.id, formData);
        } else {
          createdOrUpdatedReceipt = await pb.collection("receipts").create(formData);
        }
      } else {
        const receiptPayload: Partial<PbReceipt> = {
          user_email: userEmail,
          order: targetOrderId,
          receipt_type: isReceipt ? "invoice" : "payment_receipt",
          title: receiptTitle,
          merchant,
          amount,
          provider,
          transaction_id: transactionId,
          date: mailDate,
          source_mail_id: String(mailSeq),
          source_subject: mailSubject,
          notes: `Automatisch erfasst aus Mail #${mailSeq}`,
        };

        if (existingReceipt) {
          createdOrUpdatedReceipt = await pb.collection("receipts").update(existingReceipt.id, receiptPayload);
        } else {
          createdOrUpdatedReceipt = await pb.collection("receipts").create(receiptPayload);
        }
      }
    }

    // 3. Save Email Record
    try {
      let existingRecord: any = null;
      try {
        existingRecord = await pb
          .collection("email_records")
          .getFirstListItem(`user_email = "${userEmail}" && seq = ${mailSeq} && folder = "${mailFolder}"`);
      } catch {}

      const recordPayload: Partial<PbEmailRecord> = {
        user_email: userEmail,
        seq: Number(mailSeq),
        folder: mailFolder,
        subject: mailSubject,
        sender_email: senderEmail,
        sender_name: senderName,
        date: mailDate,
        ai_summary: analysis.summary || [],
        has_receipt: Boolean(createdOrUpdatedReceipt),
        is_order: Boolean(createdOrUpdatedOrder),
      };

      if (existingRecord) {
        await pb.collection("email_records").update(existingRecord.id, recordPayload);
      } else {
        await pb.collection("email_records").create(recordPayload);
      }
    } catch (e: any) {
      console.warn("Could not save email record:", e?.message);
    }

    return {
      synced: true,
      order: createdOrUpdatedOrder,
      receipt: createdOrUpdatedReceipt,
    };
  } catch (err: any) {
    console.error("Error syncing analysis to PocketBase:", err);
    return { synced: false, message: err?.message };
  }
}

/**
 * Fetch all orders for a user including linked receipts
 */
export async function getUserOrders(userEmail: string): Promise<PbOrder[]> {
  const available = await isPocketBaseAvailable();
  if (!available) return [];

  const pb = getPocketBaseClient();
  try {
    const orders = await pb.collection("orders").getFullList<PbOrder>({
      filter: `user_email = "${userEmail}"`,
      sort: "-id",
    });

    // Populate linked receipts for each order
    const receipts = await pb.collection("receipts").getFullList<PbReceipt>({
      filter: `user_email = "${userEmail}" && order != null`,
    });

    const receiptsByOrder: Record<string, PbReceipt[]> = {};
    for (const r of receipts) {
      if (r.order) {
        if (!receiptsByOrder[r.order]) receiptsByOrder[r.order] = [];
        receiptsByOrder[r.order].push({
          ...r,
          file: r.file ? getReceiptFileUrl(r) : null,
        });
      }
    }

    return orders.map((o) => ({
      ...o,
      expand: {
        receipts: o.id ? receiptsByOrder[o.id] || [] : [],
      },
    }));
  } catch (e: any) {
    console.error("Failed to fetch user orders:", e);
    return [];
  }
}

/**
 * Fetch all receipts for a user
 */
export async function getUserReceipts(userEmail: string): Promise<PbReceipt[]> {
  const available = await isPocketBaseAvailable();
  if (!available) return [];

  const pb = getPocketBaseClient();
  try {
    const receipts = await pb.collection("receipts").getFullList<PbReceipt>({
      filter: `user_email = "${userEmail}"`,
      sort: "-date",
      expand: "order",
    });

    return receipts.map((r) => ({
      ...r,
      file: r.file ? getReceiptFileUrl(r) : null,
    }));
  } catch (e: any) {
    console.error("Failed to fetch user receipts:", e);
    return [];
  }
}

/**
 * Manually link or unlink a receipt to an order
 */
export async function linkReceiptToOrder(receiptId: string, orderId: string | null): Promise<boolean> {
  const available = await isPocketBaseAvailable();
  if (!available) return false;

  const pb = getPocketBaseClient();
  try {
    await pb.collection("receipts").update(receiptId, {
      order: orderId || null,
    });
    return true;
  } catch (e: any) {
    console.error("Failed to link receipt to order:", e);
    return false;
  }
}
