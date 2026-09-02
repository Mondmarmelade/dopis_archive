import { ImapFlow } from "imapflow";
import { decryptData } from "../../utils/cryptography";
import { resolveMailboxPath } from "../../utils/imapHelpers";

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
      JSON.stringify({ error: "Invalid credentials in session." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const url = new URL(request.url);
  const requestedFolder = url.searchParams.get("folder") || "inbox";

  const client = new ImapFlow({
    host: credentials[2].host,
    port: Number(credentials[3].port) || 993,
    secure: true,
    auth: {
      user: credentials[0].user,
      pass: credentials[1].pass,
    },
    logger: false,
  });

  try {
    try {
      await client.connect();
    } catch (connectError) {
      console.error("IMAP Connection Error:", connectError);
      return new Response(
        JSON.stringify({
          error: "Failed to connect to IMAP server. Please check your credentials.",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const targetMailbox = await resolveMailboxPath(client, requestedFolder);
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
          subject: msg.envelope?.subject || "(No Subject)",
          date: msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : new Date().toISOString(),
          read: isRead,
          flagged: isFlagged,
          envelope: msg.envelope,
          flags: msg.flags ? Array.from(msg.flags) : [],
        });
      }

      // Reverse so newest is first
      msgs.reverse();

      return new Response(
        JSON.stringify({
          account: credentials[0].user,
          folder: requestedFolder,
          mailbox: targetMailbox,
          msgs,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    } finally {
      lock.release();
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    try {
      await client.logout();
    } catch (e) {
      // ignore logout failure on closed socket
    }
  }
}
