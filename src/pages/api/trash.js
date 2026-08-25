import { ImapFlow } from "imapflow";
import { decryptData } from "../../utils/cryptography";
import { resolveMailboxPath } from "../../utils/imapHelpers";

export async function POST({ cookies, request }) {
  const authCookie = cookies.get("auth");
  if (!authCookie?.value) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const credentials = decryptData(authCookie.value);
  if (!credentials || credentials.length < 4) {
    return new Response(JSON.stringify({ error: "Invalid credentials" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { seq, folder = "inbox", permanent = false } = body;
  if (!seq) {
    return new Response(
      JSON.stringify({ error: "Missing required 'seq' parameter" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

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
    await client.connect();

    const currentMailbox = await resolveMailboxPath(client, folder);
    const trashMailbox = await resolveMailboxPath(client, "trash");

    const lock = await client.getMailboxLock(currentMailbox);
    try {
      // If already in trash or requested permanent deletion, delete directly
      if (permanent || currentMailbox.toLowerCase() === trashMailbox.toLowerCase()) {
        await client.messageDelete(`${seq}`);
        return new Response(
          JSON.stringify({ success: true, deleted: true, seq }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // Move message to trash folder
      try {
        await client.messageMove(`${seq}`, trashMailbox);
      } catch (moveErr) {
        // Fallback: if messageMove is unsupported on older IMAP server, mark deleted
        console.warn("messageMove failed, falling back to messageDelete:", moveErr.message);
        await client.messageDelete(`${seq}`);
      }

      return new Response(
        JSON.stringify({ success: true, movedTo: trashMailbox, seq }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } finally {
      lock.release();
    }
  } catch (error) {
    console.error("Failed to move/delete email on IMAP:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    try {
      await client.logout();
    } catch (e) {
      // ignore
    }
  }
}
