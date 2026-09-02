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

  const { seq, seen, flagged, folder = "inbox" } = body;
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
    const targetMailbox = await resolveMailboxPath(client, folder);
    const lock = await client.getMailboxLock(targetMailbox);
    try {
      if (seen !== undefined) {
        if (seen) {
          await client.messageFlagsAdd(`${seq}`, ["\\Seen"]);
        } else {
          await client.messageFlagsRemove(`${seq}`, ["\\Seen"]);
        }
      }
      if (flagged !== undefined) {
        if (flagged) {
          await client.messageFlagsAdd(`${seq}`, ["\\Flagged"]);
        } else {
          await client.messageFlagsRemove(`${seq}`, ["\\Flagged"]);
        }
      }
      return new Response(
        JSON.stringify({ success: true, seq, seen, flagged }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } finally {
      lock.release();
    }
  } catch (error) {
    console.error("Failed to update message flags on IMAP:", error);
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
