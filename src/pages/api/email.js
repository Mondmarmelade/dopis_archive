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

  const credentials = decryptData(authCookie.value);
  if (!credentials) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const emailUid = url.searchParams.get("uid"); // Extract the 'uid' query parameter
  const folderAlias = url.searchParams.get("folder") || "inbox";

  if (!emailUid || emailUid === "undefined" || emailUid === "null") {
    return new Response(
      JSON.stringify({
        error: "Bad Request; Check if the sequence exists. 1",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }

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
            "Failed to connect to IMAP server. Please check your credentials. 2",
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
      let lastMsg = await client.fetchOne(`${emailUid}`, {
        uid: true,
        source: true,
        envelope: true,
      }, { uid: true });

      console.log("Fetched message:", !!lastMsg, lastMsg?.uid);

      if (!lastMsg) {
        throw new Error("Bad Request; Check if the UID exists.");
      }

      return new Response(
        JSON.stringify({
          seq: lastMsg.seq,
          uid: lastMsg.uid,
          content: lastMsg.source ? lastMsg.source.toString() : "",
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
    console.error("Backend Error Fetching Mail:", error);
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

export async function DELETE({ cookies, request }) {
  const authCookie = cookies.get("auth");
  if (!authCookie) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const credentials = decryptData(authCookie.value);
  if (!credentials) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const emailUid = url.searchParams.get("uid");
  const folderAlias = url.searchParams.get("folder") || "inbox";

  if (!emailUid) {
    return new Response(JSON.stringify({ error: "Missing UID parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const client = new ImapFlow({
    host: credentials[2].host,
    port: credentials[3].port,
    secure: true,
    auth: {
      user: credentials[0].user,
      pass: credentials[1].pass,
    },
    logger: false,
  });

  try {
    await client.connect();
    const sourceFolder = await resolveFolder(client, folderAlias);
    const targetFolder = await resolveFolder(client, "trash");

    if (sourceFolder === targetFolder) {
      // If already in trash, permanent delete? or just skip
      return new Response(JSON.stringify({ message: "Already in trash" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    let lock = await client.getMailboxLock(sourceFolder);
    try {
      await client.messageMove(emailUid, targetFolder, { uid: true });
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } finally {
      lock.release();
    }
  } catch (error) {
    console.error("Delete Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    await client.logout();
  }
}

