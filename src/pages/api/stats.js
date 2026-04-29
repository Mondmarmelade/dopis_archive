import { ImapFlow } from "imapflow";
import { decryptData } from "../../utils/cryptography";
import { resolveFolder } from "../../utils/imapFolders";

export async function GET({ cookies }) {
  const authCookie = cookies.get("auth");

  if (!authCookie || !authCookie.value) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const credentials = decryptData(authCookie.value);

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

    const counts = {
      inbox: 0,
      junk: 0,
      trash: 0,
    };

    const foldersToFetch = ["inbox", "junk", "trash"];

    for (const folderAlias of foldersToFetch) {
      const imapFolder = await resolveFolder(client, folderAlias);
      const lock = await client.getMailboxLock(imapFolder);

      try {
        counts[folderAlias] = client.mailbox.exists;
      } finally {
        lock.release();
      }
    }

    return new Response(JSON.stringify(counts), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Dashboard Stats API Error:", error);
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
