import PostalMime from "postal-mime";
import { resolveMailboxPath } from "../utils/imapHelpers.js";
import { getImapClient, evictClient } from "../utils/imapPool.js";
import {
  getPocketBaseClient,
  isPocketBaseAvailable,
  ensurePocketBaseSchema,
  ensureSuperuserAuth,
  type PbEmailRecord,
} from "./pocketbase.ts";

export interface SyncedMailSummary {
  seq: number;
  uid?: number;
  subject: string;
  senderName: string;
  senderEmail: string;
  date: string;
  snippet: string;
  hasAttachments?: boolean;
}

export interface SyncState {
  isSyncing: boolean;
  folder: string;
  total: number;
  current: number;
  error?: string | null;
  lastSyncTime?: number;
  message?: string;
  recentEmails?: SyncedMailSummary[];
}

// Global active sync state tracker per user and folder
const syncStates: Record<string, SyncState> = {};
// Flags to abort in-flight sync loops on user request
const syncAbortFlags: Record<string, boolean> = {};

export function cancelSync(userEmail: string, folder = "inbox"): boolean {
  const key = `${userEmail}:${folder.toLowerCase()}`;
  syncAbortFlags[key] = true;
  updateSyncState(userEmail, folder, {
    isSyncing: false,
    lastSyncTime: Date.now(),
    message: "Synchronisation abgebrochen",
  });
  return true;
}

export function getSyncState(userEmail: string, folder = "inbox"): SyncState {
  const key = `${userEmail}:${folder.toLowerCase()}`;
  return (
    syncStates[key] || {
      isSyncing: false,
      folder,
      total: 0,
      current: 0,
    }
  );
}

export function updateSyncState(userEmail: string, folder: string, partial: Partial<SyncState>): SyncState {
  const key = `${userEmail}:${folder.toLowerCase()}`;
  const current = getSyncState(userEmail, folder);
  syncStates[key] = { ...current, ...partial };
  return syncStates[key];
}

/**
 * Checks if a folder has any cached emails in PocketBase for the user
 */
export async function getLocalEmailsCount(userEmail: string, folder = "inbox"): Promise<number> {
  const available = await isPocketBaseAvailable();
  if (!available) return 0;

  const pb = getPocketBaseClient();
  try {
    const res = await pb.collection("email_records").getList(1, 1, {
      filter: `user_email = "${userEmail}" && folder = "${folder.toLowerCase()}"`,
    });
    return res.totalItems;
  } catch {
    return 0;
  }
}

/**
 * Fetch cached emails from PocketBase directly for ultra-fast UI rendering
 */
export async function getLocalEmails(
  userEmail: string,
  folder = "inbox",
  page = 1,
  perPage = 100
): Promise<PbEmailRecord[]> {
  const available = await isPocketBaseAvailable();
  if (!available) return [];

  const pb = getPocketBaseClient();
  try {
    const res = await pb.collection("email_records").getList<PbEmailRecord>(page, perPage, {
      filter: `user_email = "${userEmail}" && folder = "${folder.toLowerCase()}"`,
      sort: "-date",
    });
    return res.items;
  } catch (e: any) {
    console.error("Failed to query local emails from PocketBase:", e?.message);
    return [];
  }
}

/**
 * Fetch a single email's full content directly from PocketBase
 */
export async function getLocalEmailDetail(
  userEmail: string,
  seqOrId: string | number,
  folder = "inbox"
): Promise<PbEmailRecord | null> {
  const available = await isPocketBaseAvailable();
  if (!available) return null;

  const pb = getPocketBaseClient();
  const folderClean = folder.toLowerCase();

  try {
    // Try matching by id first
    if (typeof seqOrId === "string" && seqOrId.length >= 15) {
      const byId = await pb.collection("email_records").getOne<PbEmailRecord>(seqOrId).catch(() => null);
      if (byId && byId.user_email === userEmail) return byId;
    }

    // Match by seq and folder
    const numSeq = Number(seqOrId);
    if (!isNaN(numSeq)) {
      const match = await pb.collection("email_records").getFirstListItem<PbEmailRecord>(
        `user_email = "${userEmail}" && folder = "${folderClean}" && seq = ${numSeq}`
      ).catch(() => null);
      if (match) return match;
    }

    return null;
  } catch (e: any) {
    console.warn("Local email detail lookup error:", e?.message);
    return null;
  }
}

/**
 * Full sync: Ingests missing emails into PocketBase, removes deleted ones, and updates flags
 */
export async function syncMailbox(
  credentials: any[],
  folder = "inbox",
  options: { forceAll?: boolean; batchSize?: number } = {}
): Promise<{ success: boolean; totalSynced: number; error?: string }> {
  const userEmail = credentials[0]?.user;
  if (!userEmail) return { success: false, totalSynced: 0, error: "Missing user email" };

  const state = getSyncState(userEmail, folder);
  if (state.isSyncing) {
    return { success: true, totalSynced: state.current, error: "Sync already in progress" };
  }

  const pbAvailable = await isPocketBaseAvailable();
  if (!pbAvailable) {
    return { success: false, totalSynced: 0, error: "PocketBase is not reachable" };
  }

  await ensurePocketBaseSchema();
  await ensureSuperuserAuth();
  const pb = getPocketBaseClient();
  const folderClean = folder.toLowerCase();
  const batchSize = options.batchSize || 15;
  const key = `${userEmail}:${folderClean}`;
  syncAbortFlags[key] = false;

  updateSyncState(userEmail, folderClean, {
    isSyncing: true,
    message: "Verbinde mit IMAP-Server...",
    error: null,
    current: 0,
    total: 0,
    recentEmails: [],
  });

  let client: any = null;
  let lock: any = null;

  try {
    client = await getImapClient(credentials);
    const targetMailbox = await resolveMailboxPath(client, folderClean, userEmail);
    lock = await client.getMailboxLock(targetMailbox);

    // 1. Fetch all message envelopes and flags from IMAP
    updateSyncState(userEmail, folderClean, { message: "Lade Postfach-Index..." });
    const imapMessages: any[] = [];

    for await (const msg of client.fetch("1:*", {
      uid: true,
      envelope: true,
      flags: true,
    })) {
      if (syncAbortFlags[key]) break;
      imapMessages.push(msg);
    }

    if (syncAbortFlags[key]) {
      return { success: true, totalSynced: 0, error: "Synchronisation abgebrochen" };
    }

    // 2. Fetch existing records in PocketBase for this folder
    const existingPbRecords = await pb.collection("email_records").getFullList<PbEmailRecord>({
      filter: `user_email = "${userEmail}" && folder = "${folderClean}"`,
      fields: "id,uid,seq,read,flagged",
    });

    const pbByUid = new Map<number, PbEmailRecord>();
    for (const rec of existingPbRecords) {
      if (rec.uid) pbByUid.set(rec.uid, rec);
    }

    const imapUids = new Set(imapMessages.map((m) => m.uid));

    // Identify missing messages that need download (sort newest first for immediate usability)
    const missingMessages = imapMessages
      .filter((m) => !pbByUid.has(m.uid))
      .sort((a, b) => (Number(b.seq) || 0) - (Number(a.seq) || 0));

    // Identify messages deleted on IMAP
    const deletedPbRecords = existingPbRecords.filter((rec) => rec.uid && !imapUids.has(rec.uid));

    updateSyncState(userEmail, folderClean, {
      total: missingMessages.length,
      current: 0,
      message: missingMessages.length > 0
        ? `Lade ${missingMessages.length} neue E-Mails herunter...`
        : "Postfach aktuell. Prüfe Status...",
    });

    let syncedCount = 0;

    // 3. Batch download and ingest missing messages
    if (missingMessages.length > 0) {
      for (let i = 0; i < missingMessages.length; i += batchSize) {
        if (syncAbortFlags[key]) {
          console.log(`Sync aborted by user for ${key}`);
          break;
        }
        const batch = missingMessages.slice(i, i + batchSize);

        for (const msgMeta of batch) {
          if (syncAbortFlags[key]) break;
          try {
            const fullMsg = await client.fetchOne(`${msgMeta.seq}`, {
              uid: true,
              source: true,
            });

            if (fullMsg && fullMsg.source) {
              const parser = new PostalMime();
              const parsed = await parser.parse(fullMsg.source);
              const fromItem = parsed.from || msgMeta.envelope?.from?.[0] || { name: "", address: "" };
              const isRead = msgMeta.flags ? msgMeta.flags.has("\\Seen") : false;
              const isFlagged = msgMeta.flags ? msgMeta.flags.has("\\Flagged") : false;

              const attachmentsMeta = (parsed.attachments || []).map((att) => ({
                filename: att.filename || "attachment",
                mimeType: att.mimeType || "application/octet-stream",
                size: att.content ? (att.content.byteLength || 0) : 0,
              }));

              let htmlContent = parsed.html || null;
              if (htmlContent && htmlContent.length > 8000000) {
                htmlContent = htmlContent.slice(0, 8000000) + "... (HTML gekürzt)";
              }

              let textContent = parsed.text || null;
              if (textContent && textContent.length > 8000000) {
                textContent = textContent.slice(0, 8000000) + "... (Text gekürzt)";
              }

              let dateStr = parsed.date;
              if (!dateStr && msgMeta.envelope?.date) {
                try {
                  dateStr = new Date(msgMeta.envelope.date).toISOString();
                } catch {
                  dateStr = new Date().toISOString();
                }
              }
              if (!dateStr) {
                dateStr = new Date().toISOString();
              }

              const record: Partial<PbEmailRecord> = {
                user_email: String(userEmail),
                uid: Number(msgMeta.uid) || 0,
                seq: Number(msgMeta.seq) || 0,
                folder: folderClean,
                message_id: String(parsed.messageId || msgMeta.envelope?.messageId || ""),
                subject: String(parsed.subject || msgMeta.envelope?.subject || "(Kein Betreff)").slice(0, 2000),
                sender_email: String(fromItem.address || "").slice(0, 500),
                sender_name: String(fromItem.name || fromItem.address || "Unbekannt").slice(0, 500),
                from: fromItem,
                to: parsed.to || msgMeta.envelope?.to || [],
                cc: parsed.cc || [],
                date: dateStr,
                html: htmlContent,
                text: textContent,
                read: isRead,
                flagged: isFlagged,
                attachments: attachmentsMeta,
              };

              await pb.collection("email_records").create(record);

              const cleanSnippet = (parsed.text || "")
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 140);

              const summaryItem: SyncedMailSummary = {
                seq: Number(msgMeta.seq) || 0,
                uid: Number(msgMeta.uid) || 0,
                subject: String(parsed.subject || msgMeta.envelope?.subject || "(Kein Betreff)"),
                senderName: String(fromItem.name || fromItem.address || "Unbekannt"),
                senderEmail: String(fromItem.address || ""),
                date: dateStr,
                snippet: cleanSnippet,
                hasAttachments: attachmentsMeta.length > 0,
              };

              const currentRecent = getSyncState(userEmail, folderClean).recentEmails || [];
              const updatedRecent = [...currentRecent, summaryItem].slice(-12);

              syncedCount++;
              updateSyncState(userEmail, folderClean, {
                current: syncedCount,
                recentEmails: updatedRecent,
                message: `Importiere E-Mails: ${syncedCount} / ${missingMessages.length}...`,
              });
            }
          } catch (itemErr: any) {
            const errDetail = itemErr?.response?.data
              ? JSON.stringify(itemErr.response.data)
              : (itemErr?.message || itemErr);
            console.warn(`Error parsing/saving msg seq ${msgMeta.seq}:`, errDetail);
            syncedCount++;
            updateSyncState(userEmail, folderClean, {
              current: syncedCount,
              message: `Importiere E-Mails: ${syncedCount} / ${missingMessages.length}...`,
            });
          }
        }
      }
    }

    if (syncAbortFlags[key]) {
      updateSyncState(userEmail, folderClean, {
        isSyncing: false,
        lastSyncTime: Date.now(),
        message: "Synchronisation abgebrochen",
      });
      return { success: true, totalSynced: syncedCount, error: "Synchronisation abgebrochen" };
    }

    // 4. Update flags for existing messages if changed on IMAP
    for (const msg of imapMessages) {
      const pbRec = pbByUid.get(msg.uid);
      if (pbRec && pbRec.id) {
        const isRead = msg.flags ? msg.flags.has("\\Seen") : false;
        const isFlagged = msg.flags ? msg.flags.has("\\Flagged") : false;

        if (pbRec.read !== isRead || pbRec.flagged !== isFlagged || pbRec.seq !== msg.seq) {
          try {
            await pb.collection("email_records").update(pbRec.id, {
              read: isRead,
              flagged: isFlagged,
              seq: msg.seq,
            });
          } catch {}
        }
      }
    }

    // 5. Clean up messages deleted on server
    for (const delRec of deletedPbRecords) {
      if (delRec.id) {
        try {
          await pb.collection("email_records").delete(delRec.id);
        } catch {}
      }
    }

    updateSyncState(userEmail, folderClean, {
      isSyncing: false,
      lastSyncTime: Date.now(),
      message: `Synchronisiert (${syncedCount} neue Mails geladen)`,
    });

    return { success: true, totalSynced: syncedCount };
  } catch (err: any) {
    console.error("Error during IMAP sync:", err);
    updateSyncState(userEmail, folderClean, {
      isSyncing: false,
      error: err?.message || "Synchronisationsfehler",
    });
    if (client) evictClient(credentials);
    return { success: false, totalSynced: 0, error: err?.message };
  } finally {
    if (lock) {
      try {
        lock.release();
      } catch {}
    }
  }
}
