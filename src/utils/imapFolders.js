export async function resolveFolder(client, folderAlias) {
  if (!folderAlias) return "INBOX";

  const targetRole = folderAlias.toLowerCase();
  // Always return standard INBOX for inbox alias
  if (targetRole === "inbox") return "INBOX";

  try {
    // client.list() returns an array of MailboxObject
    const mailboxes = await client.list();
    let selectedPath = null;
    let fallbackPath = null;

    for (const mailbox of mailboxes) {
      if (!mailbox) continue;

      const specialUse = mailbox.specialUse || "";
      const path = mailbox.path || "";
      const name = mailbox.name || "";

      // Prioritize special-use flags (\Junk, \Trash, etc.)
      if (targetRole === "junk" && specialUse.includes("\\Junk")) {
        selectedPath = path;
        break;
      }
      if (targetRole === "trash" && specialUse.includes("\\Trash")) {
        selectedPath = path;
        break;
      }

      // Secondary check: string matching on folder paths if SPECIAL-USE not found
      if (
        targetRole === "junk" &&
        (/junk|spam/i.test(path) || /junk|spam/i.test(name))
      ) {
        fallbackPath = path;
      }
      if (
        targetRole === "trash" &&
        (/trash|deleted|bin/i.test(path) || /trash|deleted|bin/i.test(name))
      ) {
        fallbackPath = path;
      }
    }

    return selectedPath || fallbackPath || "INBOX";
  } catch (err) {
    console.error("Error resolving folder:", err);
    return "INBOX";
  }
}
