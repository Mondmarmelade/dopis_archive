import { getCredentials, handleOptions, jsonResponse } from "../../../utils/authHelper.js";
import { getUserReceipts } from "../../../lib/orderReceiptSync.ts";
import { getPocketBaseClient, isPocketBaseAvailable, getReceiptFileUrl } from "../../../lib/pocketbase.ts";

export async function OPTIONS() {
  return handleOptions();
}

export async function GET({ cookies, request }) {
  const credentials = getCredentials(request, cookies);
  if (!credentials || credentials.length < 4) {
    return jsonResponse(
      { error: "Unauthorized. Please provide a valid Bearer token or log in." },
      401
    );
  }

  const userEmail = credentials[0].user;
  const available = await isPocketBaseAvailable();
  if (!available) {
    return jsonResponse(
      {
        receipts: [],
        pocketBaseAvailable: false,
        warning: "PocketBase server is not reachable. Receipts cannot be loaded.",
      },
      200
    );
  }

  try {
    const receipts = await getUserReceipts(userEmail);
    return jsonResponse({
      receipts,
      pocketBaseAvailable: true,
      count: receipts.length,
    });
  } catch (error) {
    console.error("Error fetching receipts:", error);
    return jsonResponse({ error: error?.message || "Failed to fetch receipts." }, 500);
  }
}

export async function POST({ cookies, request }) {
  const credentials = getCredentials(request, cookies);
  if (!credentials || credentials.length < 4) {
    return jsonResponse(
      { error: "Unauthorized. Please provide a valid Bearer token or log in." },
      401
    );
  }

  const userEmail = credentials[0].user;
  const available = await isPocketBaseAvailable();
  if (!available) {
    return jsonResponse({ error: "PocketBase is not reachable." }, 503);
  }

  try {
    const contentType = request.headers.get("content-type") || "";
    const pb = getPocketBaseClient();
    let record;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      formData.set("user_email", userEmail);
      record = await pb.collection("receipts").create(formData);
    } else {
      const body = await request.json();
      const receiptData = {
        user_email: userEmail,
        order: body.order || null,
        receipt_type: body.receipt_type || "invoice",
        title: body.title || "Beleg",
        merchant: body.merchant || "",
        amount: body.amount || "",
        provider: body.provider || "",
        transaction_id: body.transaction_id || "",
        date: body.date || new Date().toISOString(),
        source_mail_id: body.source_mail_id || "",
        source_subject: body.source_subject || "",
        notes: body.notes || "",
        raw_metadata: body.raw_metadata || {},
      };

      if (body.id) {
        record = await pb.collection("receipts").update(body.id, receiptData);
      } else {
        record = await pb.collection("receipts").create(receiptData);
      }
    }

    return jsonResponse({
      success: true,
      receipt: {
        ...record,
        file: record.file ? getReceiptFileUrl(record) : null,
      },
    });
  } catch (error) {
    console.error("Error saving receipt:", error);
    return jsonResponse({ error: error?.message || "Failed to save receipt." }, 500);
  }
}
