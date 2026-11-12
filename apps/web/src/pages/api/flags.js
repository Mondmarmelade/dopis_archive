import { ImapFlow } from "imapflow";
import { resolveMailboxPath } from "../../utils/imapHelpers.js";
import { getCredentials, handleOptions, jsonResponse } from "../../utils/authHelper.js";

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

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const seq = body.seq || body.id;
  let seen = body.seen;
  let flagged = body.flagged;
  const folder = body.folder || "inbox";

  if (body.flag !== undefined && body.state !== undefined) {
    const f = String(body.flag).toLowerCase();
    if (f === "flagged" || f === "\\flagged") {
      flagged = Boolean(body.state);
    } else if (f === "seen" || f === "\\seen" || f === "read") {
      seen = Boolean(body.state);
    }
  }

  if (!seq) {
    return jsonResponse(
      { error: "Missing required 'seq' or 'id' parameter" },
      400
    );
  }

  // 1. Local-First: Update PocketBase record immediately
  const userEmail = credentials[0].user;
  try {
    const { isPocketBaseAvailable, getPocketBaseClient } = await import("../../lib/pocketbase.ts");
    const pbAvailable = await isPocketBaseAvailable();
    if (pbAvailable) {
      const pb = getPocketBaseClient();
      const numSeq = Number(seq);
      const match = await pb.collection("email_records").getFirstListItem(
        `user_email = "${userEmail}" && folder = "${folder.toLowerCase()}" && seq = ${numSeq}`
      ).catch(() => null);

      if (match) {
        const updates = {};
        if (seen !== undefined) updates.read = Boolean(seen);
        if (flagged !== undefined) updates.flagged = Boolean(flagged);
        await pb.collection("email_records").update(match.id, updates);
      }
    }
  } catch (pbErr) {
    console.warn("PocketBase local flag update error:", pbErr?.message);
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
      return jsonResponse({ success: true, seq, seen, flagged });
    } finally {
      lock.release();
    }
  } catch (error) {
    console.error("Failed to update message flags on IMAP:", error);
    return jsonResponse({ error: error.message }, 500);
  } finally {
    try {
      await client.logout();
    } catch (e) {
      // ignore
    }
  }
}
