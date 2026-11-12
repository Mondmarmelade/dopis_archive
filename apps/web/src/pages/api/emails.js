import { resolveMailboxPath } from "../../utils/imapHelpers.js";
import { getCredentials, handleOptions, jsonResponse } from "../../utils/authHelper.js";
import {
  getLocalEmails,
  getLocalEmailsCount,
  syncMailbox,
  getSyncState,
} from "../../lib/imapSyncEngine.ts";
import { isPocketBaseAvailable } from "../../lib/pocketbase.ts";
import { getImapClient } from "../../utils/imapPool.js";

export async function OPTIONS() {
  return handleOptions();
}

export async function GET({ cookies, params, request }) {
  const credentials = getCredentials(request, cookies);
  if (!credentials || credentials.length < 4) {
    return jsonResponse(
      { error: "Unauthorized. Please provide a valid Bearer token or log in." },
      401
    );
  }

  const url = new URL(request.url);
  const requestedFolder = (url.searchParams.get("folder") || "inbox").toLowerCase();
  const userEmail = credentials[0].user;

  const pbAvailable = await isPocketBaseAvailable();

  // 1. Database-First: Check if PocketBase has records
  if (pbAvailable) {
    try {
      const localCount = await getLocalEmailsCount(userEmail, requestedFolder);
      const syncState = getSyncState(userEmail, requestedFolder);

      if (localCount > 0) {
        const pbRecords = await getLocalEmails(userEmail, requestedFolder, 1, 250);

        const msgs = pbRecords.map((r) => ({
          id: String(r.seq || r.id),
          pbId: r.id,
          seq: r.seq,
          uid: r.uid,
          name: r.sender_name || r.sender_email || "Unknown",
          email: r.sender_email || "",
          from: r.from || { name: r.sender_name || "", address: r.sender_email || "" },
          subject: r.subject || "(Kein Betreff)",
          date: r.date,
          read: Boolean(r.read),
          isUnread: !r.read,
          flagged: Boolean(r.flagged),
          isFlagged: Boolean(r.flagged),
          flags: [
            ...(r.read ? ["\\Seen"] : []),
            ...(r.flagged ? ["\\Flagged"] : []),
          ],
          hasReceipt: Boolean(r.has_receipt),
          isOrder: Boolean(r.is_order),
        }));

        // Trigger background delta sync if not syncing and last sync > 60s ago
        const now = Date.now();
        if (!syncState.isSyncing && (!syncState.lastSyncTime || now - syncState.lastSyncTime > 60000)) {
          syncMailbox(credentials, requestedFolder).catch(() => {});
        }

        return jsonResponse({
          account: userEmail,
          folder: requestedFolder,
          mailbox: requestedFolder,
          msgs,
          emails: msgs,
          fromDb: true,
          total: localCount,
          isSyncing: syncState.isSyncing,
        });
      }

      // If database is empty and not currently syncing, signal frontend that initial import is needed
      if (localCount === 0 && !syncState.isSyncing) {
        if (!syncState.lastSyncTime) {
          return jsonResponse({
            account: userEmail,
            folder: requestedFolder,
            mailbox: requestedFolder,
            msgs: [],
            emails: [],
            fromDb: true,
            total: 0,
            needsInitialSync: true,
            isSyncing: false,
          });
        }
        // If initial sync was skipped/cancelled, fall through to IMAP fallback below
      }

      // If currently syncing initial import
      if (syncState.isSyncing && localCount === 0) {
        return jsonResponse({
          account: userEmail,
          folder: requestedFolder,
          mailbox: requestedFolder,
          msgs: [],
          emails: [],
          fromDb: true,
          total: 0,
          needsInitialSync: true,
          isSyncing: true,
          syncProgress: syncState,
        });
      }
    } catch (dbErr) {
      console.warn("Error reading emails from PocketBase, falling back to IMAP:", dbErr);
    }
  }

  // 2. Direct IMAP Fallback (if PocketBase is offline or error occurred)
  try {
    const client = await getImapClient(credentials);
    const targetMailbox = await resolveMailboxPath(client, requestedFolder, userEmail);
    const lock = await client.getMailboxLock(targetMailbox);

    try {
      const msgs = [];

      for await (const msg of client.fetch("1:*", {
        uid: true,
        envelope: true,
        flags: true,
      })) {
        const fromItem = msg.envelope?.from?.[0];
        const isRead = msg.flags ? msg.flags.has("\\Seen") : false;
        const isFlagged = msg.flags ? msg.flags.has("\\Flagged") : false;

        msgs.push({
          id: String(msg.seq),
          seq: msg.seq,
          uid: msg.uid,
          name: fromItem?.name || fromItem?.address || "Unknown",
          email: fromItem?.address || "",
          from: {
            name: fromItem?.name || "",
            address: fromItem?.address || "",
          },
          subject: msg.envelope?.subject || "(No Subject)",
          date: msg.envelope?.date
            ? new Date(msg.envelope.date).toISOString()
            : new Date().toISOString(),
          read: isRead,
          isUnread: !isRead,
          flagged: isFlagged,
          isFlagged: isFlagged,
          envelope: msg.envelope,
          flags: msg.flags ? Array.from(msg.flags) : [],
        });
      }

      msgs.reverse();

      return jsonResponse({
        account: userEmail,
        folder: requestedFolder,
        mailbox: targetMailbox,
        msgs,
        emails: msgs,
        fromDb: false,
      });
    } finally {
      lock.release();
    }
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}
