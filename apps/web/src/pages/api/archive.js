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
  const folder = body.folder || "inbox";

  if (!seq) {
    return jsonResponse(
      { error: "Missing required 'seq' or 'id' parameter" },
      400
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
    const archiveMailbox = await resolveMailboxPath(client, "archive");

    const lock = await client.getMailboxLock(currentMailbox);
    try {
      await client.messageMove(`${seq}`, archiveMailbox);
      return jsonResponse({
        success: true,
        moved: true,
        seq,
        destination: archiveMailbox,
      });
    } finally {
      lock.release();
    }
  } catch (error) {
    console.error("Failed to archive email:", error);
    return jsonResponse({ error: error.message }, 500);
  } finally {
    try {
      await client.logout();
    } catch (e) {
      // ignore
    }
  }
}
