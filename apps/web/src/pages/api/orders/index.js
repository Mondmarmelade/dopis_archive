import { getCredentials, handleOptions, jsonResponse } from "../../../utils/authHelper.js";
import { getUserOrders, syncAnalysisToPocketBase } from "../../../lib/orderReceiptSync.ts";
import { getPocketBaseClient, isPocketBaseAvailable } from "../../../lib/pocketbase.ts";

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
        orders: [],
        pocketBaseAvailable: false,
        warning: "PocketBase server is not reachable. Orders cannot be loaded.",
      },
      200
    );
  }

  try {
    const orders = await getUserOrders(userEmail);
    return jsonResponse({
      orders,
      pocketBaseAvailable: true,
      count: orders.length,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return jsonResponse({ error: error?.message || "Failed to fetch orders." }, 500);
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
    const body = await request.json();
    const pb = getPocketBaseClient();

    const orderData = {
      user_email: userEmail,
      order_number: body.order_number || "",
      merchant: body.merchant || "",
      order_type: body.order_type || "physical",
      stage: body.stage || "ordered",
      status_title: body.status_title || "",
      status_detail: body.status_detail || "",
      amount: body.amount || "",
      carrier: body.carrier || "",
      tracking_number: body.tracking_number || "",
      order_date: body.order_date || new Date().toISOString(),
      raw_metadata: body.raw_metadata || {},
    };

    let record;
    if (body.id) {
      record = await pb.collection("orders").update(body.id, orderData);
    } else {
      record = await pb.collection("orders").create(orderData);
    }

    return jsonResponse({ success: true, order: record });
  } catch (error) {
    console.error("Error saving order:", error);
    return jsonResponse({ error: error?.message || "Failed to save order." }, 500);
  }
}
