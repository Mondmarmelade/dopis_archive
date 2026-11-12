import { getCredentials, handleOptions, jsonResponse } from "../../../utils/authHelper.js";
import { linkReceiptToOrder } from "../../../lib/orderReceiptSync.ts";
import { isPocketBaseAvailable } from "../../../lib/pocketbase.ts";

export async function OPTIONS() {
  return handleOptions();
}

export async function POST({ cookies, request }) {
  const credentials = getCredentials(request, cookies);
  if (!credentials || credentials.length < 4) {
    return jsonResponse(
      { error: "Unauthorized. Please provide a valid Bearer token or log in." },
      401
    );
  }

  const available = await isPocketBaseAvailable();
  if (!available) {
    return jsonResponse({ error: "PocketBase is not reachable." }, 503);
  }

  try {
    const body = await request.json();
    const { receiptId, orderId, action = "link" } = body || {};

    if (!receiptId) {
      return jsonResponse({ error: "Missing required parameter 'receiptId'." }, 400);
    }

    const targetOrderId = action === "unlink" ? null : orderId;
    const success = await linkReceiptToOrder(receiptId, targetOrderId);

    if (success) {
      return jsonResponse({
        success: true,
        receiptId,
        orderId: targetOrderId,
        action,
      });
    } else {
      return jsonResponse({ error: "Failed to link or unlink receipt." }, 500);
    }
  } catch (error) {
    console.error("Error in /api/orders/link:", error);
    return jsonResponse({ error: error?.message || "Internal server error." }, 500);
  }
}
