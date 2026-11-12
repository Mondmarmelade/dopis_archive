import PostalMime from "postal-mime";
import { resolveMailboxPath } from "../../utils/imapHelpers.js";
import { getImapClient, evictClient } from "../../utils/imapPool.js";
import { getCredentials, handleOptions, jsonResponse } from "../../utils/authHelper.js";
import { getLocalEmailDetail } from "../../lib/imapSyncEngine.ts";
import { getPocketBaseClient, isPocketBaseAvailable } from "../../lib/pocketbase.ts";

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
  const rawSeq = url.searchParams.get("seq") || url.searchParams.get("id");
  const requestedFolder = (url.searchParams.get("folder") || "inbox").toLowerCase();

  if (!rawSeq) {
    return jsonResponse(
      { error: "Bad Request: Missing sequence parameter 'seq' or 'id'." },
      400
    );
  }

  const accountKey = credentials[0].user;

  // 1. Database-First: Check if email exists in PocketBase
  const pbAvailable = await isPocketBaseAvailable();
  if (pbAvailable) {
    try {
      const localDetail = await getLocalEmailDetail(accountKey, rawSeq, requestedFolder);
      if (localDetail) {
        return jsonResponse(
          {
            id: String(localDetail.seq || localDetail.id),
            pbId: localDetail.id,
            seq: localDetail.seq,
            uid: localDetail.uid,
            subject: localDetail.subject || "(Kein Betreff)",
            from: localDetail.from || { name: localDetail.sender_name || "", address: localDetail.sender_email || "" },
            name: localDetail.sender_name || localDetail.sender_email || "Unknown",
            email: localDetail.sender_email || "",
            to: localDetail.to || [],
            cc: localDetail.cc || [],
            date: localDetail.date,
            html: localDetail.html || null,
            text: localDetail.text || null,
            attachments: localDetail.attachments || [],
            flags: [
              ...(localDetail.read ? ["\\Seen"] : []),
              ...(localDetail.flagged ? ["\\Flagged"] : []),
            ],
            read: Boolean(localDetail.read),
            flagged: Boolean(localDetail.flagged),
            fromDb: true,
          },
          200,
          { "Cache-Control": "private, max-age=300" }
        );
      }
    } catch (dbErr) {
      console.warn("Local email detail check error:", dbErr?.message);
    }
  }

  // 2. Fallback to direct IMAP fetch
  const numericSeq = Number(rawSeq);
  if (isNaN(numericSeq) || numericSeq <= 0) {
    return jsonResponse(
      {
        error: `Invalid sequence parameter '${rawSeq}'. Must be a valid numeric sequence number.`,
      },
      400
    );
  }

  let client;
  try {
    client = await getImapClient(credentials);
  } catch (connectErr) {
    console.error(
      "IMAP initial connection failed, evicting and retrying once:",
      connectErr.message
    );
    evictClient(credentials);
    try {
      client = await getImapClient(credentials);
    } catch (retryErr) {
      return jsonResponse(
        { error: `IMAP Verbindung fehlgeschlagen: ${retryErr.message}` },
        502
      );
    }
  }

  let lock;
  try {
    const targetMailbox = await resolveMailboxPath(
      client,
      requestedFolder,
      accountKey
    );

    try {
      lock = await client.getMailboxLock(targetMailbox);
    } catch (lockErr) {
      console.warn(
        "Mailbox lock failed on pooled client, refreshing client:",
        lockErr.message
      );
      evictClient(credentials);
      client = await getImapClient(credentials);
      const refreshedTarget = await resolveMailboxPath(
        client,
        requestedFolder,
        accountKey
      );
      lock = await client.getMailboxLock(refreshedTarget);
    }

    let msg;
    try {
      msg = await client.fetchOne(`${numericSeq}`, {
        uid: true,
        source: true,
        envelope: true,
        flags: true,
      });
    } catch (fetchErr) {
      console.warn(`fetchOne error for seq ${numericSeq}:`, fetchErr.message);
      return jsonResponse(
        {
          error: `E-Mail (Seq ${numericSeq}) konnte auf dem Server nicht gefunden werden.`,
        },
        404
      );
    }

    if (!msg || !msg.source) {
      return jsonResponse(
        {
          error: `E-Mail (Seq ${numericSeq}) hat keinen Inhalt oder existiert nicht mehr.`,
        },
        404
      );
    }

    // Parse RFC822 raw message with PostalMime
    const parser = new PostalMime();
    const parsed = await parser.parse(msg.source);

    const fromObj =
      parsed.from || msg.envelope?.from?.[0] || { name: "", address: "" };

    const isRead = msg.flags ? msg.flags.has("\\Seen") : false;
    const isFlagged = msg.flags ? msg.flags.has("\\Flagged") : false;

    const attachmentsList = (parsed.attachments || []).map((att) => ({
      filename: att.filename,
      mimeType: att.mimeType,
      disposition: att.disposition,
      size: att.content ? att.content.byteLength : 0,
    }));

    // Cache this fetched email in PocketBase for future instant lookups
    if (pbAvailable) {
      try {
        const pb = getPocketBaseClient();
        await pb.collection("email_records").create({
          user_email: accountKey,
          uid: msg.uid,
          seq: msg.seq,
          folder: requestedFolder,
          message_id: parsed.messageId || msg.envelope?.messageId || "",
          subject: parsed.subject || msg.envelope?.subject || "(No Subject)",
          sender_email: fromObj.address || "",
          sender_name: fromObj.name || fromObj.address || "Unknown",
          from: fromObj,
          to: parsed.to || msg.envelope?.to || [],
          cc: parsed.cc || [],
          date: parsed.date || (msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : new Date().toISOString()),
          html: parsed.html || null,
          text: parsed.text || null,
          read: isRead,
          flagged: isFlagged,
          attachments: attachmentsList,
        });
      } catch (cacheErr) {
        console.warn("Could not cache fetched email in PocketBase:", cacheErr?.message);
      }
    }

    return jsonResponse(
      {
        id: String(msg.seq),
        seq: msg.seq,
        uid: msg.uid,
        subject: parsed.subject || msg.envelope?.subject || "(No Subject)",
        from: fromObj,
        name: fromObj.name || fromObj.address || "Unknown",
        email: fromObj.address || "",
        to: parsed.to || msg.envelope?.to || [],
        cc: parsed.cc || [],
        date:
          parsed.date ||
          (msg.envelope?.date
            ? new Date(msg.envelope.date).toISOString()
            : new Date().toISOString()),
        html: parsed.html || null,
        text: parsed.text || null,
        attachments: attachmentsList,
        flags: msg.flags ? Array.from(msg.flags) : [],
        read: isRead,
        flagged: isFlagged,
        fromDb: false,
      },
      200,
      { "Cache-Control": "private, max-age=300" }
    );
  } catch (error) {
    console.error("Error processing email in /api/email:", error);
    evictClient(credentials);
    return jsonResponse({ error: error.message }, 500);
  } finally {
    if (lock) {
      try {
        lock.release();
      } catch (e) {
        console.warn("Error releasing mailbox lock:", e.message);
      }
    }
  }
}
