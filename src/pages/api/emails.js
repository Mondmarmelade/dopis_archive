import { ImapFlow } from "imapflow";
import { decryptData } from "../../utils/cryptography";
import { resolveFolder } from "../../utils/imapFolders";

export async function GET({ cookies, params, request }) {
  const authCookie = cookies.get("auth");
  if (!authCookie) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const credentials = decryptData(authCookie.value); //get login data from cookie -> decrypts them
  if (!credentials) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);

  const folderAlias = url.searchParams.get("folder") || "inbox";
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = parseInt(url.searchParams.get("limit") || "20", 10);

  const client = new ImapFlow({
    host: credentials[2].host,
    port: credentials[3].port,
    secure: true,
    auth: {
      user: credentials[0].user,
      pass: credentials[1].pass,
    },
    logger: false, // activate in dev for better debugging
  });

  try {
    try {
      await client.connect();
      console.log("Connected to IMAP server");
    } catch (connectError) {
      console.error("Connection Error:", connectError);
      return new Response(
        JSON.stringify({
          error:
            "Failed to connect to IMAP server. Please check your credentials.",
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    const imapFolder = await resolveFolder(client, folderAlias);
    let lock = await client.getMailboxLock(imapFolder);

    try {
      let msgs = [];
      const totalMessages = client.mailbox.exists;

      if (totalMessages === 0) {
        return new Response(
          JSON.stringify({
            msgs: [],
            total: 0,
            hasMore: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      let start = totalMessages - page * limit + 1;
      let end = totalMessages - (page - 1) * limit;

      if (end <= 0) {
        return new Response(
          JSON.stringify({
            msgs: [],
            total: totalMessages,
            hasMore: false,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (start < 1) start = 1;

      for await (let msg of client.fetch(`${start}:${end}`, {
        uid: true,
        envelope: true,
      })) {
        msgs.push({
          uid: msg.uid,
          seq: msg.seq,
          envelope: msg.envelope,
          flags: msg.flags ? Array.from(msg.flags) : [],
        });
      }

      return new Response(
        JSON.stringify({
          msgs: msgs.reverse(), // reverses order of emails -> so newest mail is first in array
          total: totalMessages,
          hasMore: start > 1,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    } finally {
      lock.release();
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } finally {
    await client.logout();
  }
}
