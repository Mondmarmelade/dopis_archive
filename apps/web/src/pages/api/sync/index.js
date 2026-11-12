import { getCredentials, handleOptions, jsonResponse } from "../../../utils/authHelper.js";
import {
  syncMailbox,
  getSyncState,
  getLocalEmailsCount,
  cancelSync,
} from "../../../lib/imapSyncEngine.ts";
import { isPocketBaseAvailable } from "../../../lib/pocketbase.ts";

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

  const url = new URL(request.url);
  const folder = url.searchParams.get("folder") || "inbox";
  const userEmail = credentials[0].user;

  const pbAvailable = await isPocketBaseAvailable();
  if (!pbAvailable) {
    return jsonResponse({
      pocketBaseAvailable: false,
      isSyncing: false,
      totalInDb: 0,
      needsInitialSync: false,
    });
  }

  const state = getSyncState(userEmail, folder);
  const totalInDb = await getLocalEmailsCount(userEmail, folder);

  return jsonResponse({
    pocketBaseAvailable: true,
    folder,
    isSyncing: state.isSyncing,
    current: state.current,
    total: state.total,
    message: state.message || (totalInDb > 0 ? "Synchronisiert" : "Erst-Import ausstehend"),
    error: state.error,
    lastSyncTime: state.lastSyncTime || null,
    totalInDb,
    needsInitialSync: (totalInDb === 0 && !state.lastSyncTime) || state.isSyncing,
    recentEmails: state.recentEmails || [],
  });
}

export async function POST({ cookies, request }) {
  const credentials = getCredentials(request, cookies);
  if (!credentials || credentials.length < 4) {
    return jsonResponse(
      { error: "Unauthorized. Please provide a valid Bearer token or log in." },
      401
    );
  }

  let body = {};
  try {
    body = await request.json();
  } catch {}

  const folder = body.folder || "inbox";
  const userEmail = credentials[0].user;

  // Handle explicit sync cancellation
  if (body.action === "cancel" || body.cancel === true) {
    cancelSync(userEmail, folder);
    return jsonResponse({
      success: true,
      cancelled: true,
      message: "Synchronisation abgebrochen",
      folder,
    });
  }

  const blocking = Boolean(body.blocking);

  const pbAvailable = await isPocketBaseAvailable();
  if (!pbAvailable) {
    return jsonResponse({ error: "PocketBase is not reachable." }, 503);
  }

  if (blocking) {
    // Await complete sync (used for initial import)
    const result = await syncMailbox(credentials, folder, { forceAll: true });
    return jsonResponse({
      success: result.success,
      totalSynced: result.totalSynced,
      error: result.error,
    });
  } else {
    // Non-blocking background sync
    syncMailbox(credentials, folder).catch((err) => {
      console.warn("Background mailbox sync error:", err?.message);
    });

    const state = getSyncState(userEmail, folder);
    return jsonResponse({
      started: true,
      folder,
      isSyncing: state.isSyncing,
    });
  }
}

export async function DELETE({ cookies, request }) {
  const credentials = getCredentials(request, cookies);
  if (!credentials || credentials.length < 4) {
    return jsonResponse(
      { error: "Unauthorized. Please provide a valid Bearer token or log in." },
      401
    );
  }

  const url = new URL(request.url);
  const folder = url.searchParams.get("folder") || "inbox";
  const userEmail = credentials[0].user;

  cancelSync(userEmail, folder);
  return jsonResponse({
    success: true,
    cancelled: true,
    message: "Synchronisation abgebrochen",
    folder,
  });
}
