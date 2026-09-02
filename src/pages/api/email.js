import PostalMime from "postal-mime";
import { decryptData } from "../../utils/cryptography";
import { resolveMailboxPath } from "../../utils/imapHelpers";
import { getImapClient, evictClient } from "../../utils/imapPool";

export async function GET({ cookies, params, request }) {
  const authCookie = cookies.get("auth");
  if (!authCookie?.value) {
    return new Response(
      JSON.stringify({ error: "Unauthorized. Please log in." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const credentials = decryptData(authCookie.value);
  if (!credentials || credentials.length < 4) {
    return new Response(
      JSON.stringify({ error: "Invalid credentials." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const url = new URL(request.url);
  const rawSeq = url.searchParams.get("seq");
  const requestedFolder = url.searchParams.get("folder") || "inbox";

  if (!rawSeq) {
    return new Response(
      JSON.stringify({ error: "Bad Request: Missing sequence parameter 'seq'." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Ensure sequence is numeric
  const numericSeq = Number(rawSeq);
  if (isNaN(numericSeq) || numericSeq <= 0) {
    return new Response(
      JSON.stringify({ error: `Invalid sequence parameter '${rawSeq}'. Must be a valid numeric sequence number.` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const accountKey = credentials[0].user;
  let client;

  try {
    client = await getImapClient(credentials);
  } catch (connectErr) {
    console.error("IMAP initial connection failed, evicting and retrying once:", connectErr.message);
    evictClient(credentials);
    try {
      client = await getImapClient(credentials);
    } catch (retryErr) {
      return new Response(
        JSON.stringify({ error: `IMAP Verbindung fehlgeschlagen: ${retryErr.message}` }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  let lock;
  try {
    const targetMailbox = await resolveMailboxPath(client, requestedFolder, accountKey);

    try {
      lock = await client.getMailboxLock(targetMailbox);
    } catch (lockErr) {
      console.warn("Mailbox lock failed on pooled client, refreshing client:", lockErr.message);
      evictClient(credentials);
      client = await getImapClient(credentials);
      const refreshedTarget = await resolveMailboxPath(client, requestedFolder, accountKey);
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
      return new Response(
        JSON.stringify({ error: `E-Mail (Seq ${numericSeq}) konnte auf dem Server nicht gefunden werden.` }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!msg || !msg.source) {
      return new Response(
        JSON.stringify({ error: `E-Mail (Seq ${numericSeq}) hat keinen Inhalt oder existiert nicht mehr.` }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse RFC822 raw message with PostalMime
    const parser = new PostalMime();
    const parsed = await parser.parse(msg.source);

    return new Response(
      JSON.stringify({
        id: String(msg.seq),
        seq: msg.seq,
        uid: msg.uid,
        subject: parsed.subject || msg.envelope?.subject || "(No Subject)",
        from: parsed.from || msg.envelope?.from?.[0] || { name: "", address: "" },
        to: parsed.to || msg.envelope?.to || [],
        cc: parsed.cc || [],
        date: parsed.date || (msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : new Date().toISOString()),
        html: parsed.html || null,
        text: parsed.text || null,
        attachments: (parsed.attachments || []).map((att) => ({
          filename: att.filename,
          mimeType: att.mimeType,
          disposition: att.disposition,
          size: att.content ? att.content.byteLength : 0,
        })),
        flags: msg.flags ? Array.from(msg.flags) : [],
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "private, max-age=300",
        },
      }
    );
  } catch (error) {
    console.error("Error processing email in /api/email:", error);
    evictClient(credentials);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
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
