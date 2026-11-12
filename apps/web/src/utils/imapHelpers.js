// Cache of mailbox path resolution per folderName
const mailboxCache = new Map();

export async function resolveMailboxPath(client, folderName, accountKey = "") {
  if (!folderName || folderName === "inbox") {
    return "INBOX";
  }

  const cacheKey = `${accountKey}:${folderName}`;
  if (accountKey && mailboxCache.has(cacheKey)) {
    return mailboxCache.get(cacheKey);
  }

  const list = await client.list();
  let resolved = "INBOX";

  if (folderName === "trash") {
    const special = list.find((m) => m.specialUse === "\\Trash");
    if (special) resolved = special.path;
    else {
      const nameMatch = list.find((m) => /trash|papierkorb|gel[öo]schte/i.test(m.path));
      resolved = nameMatch ? nameMatch.path : "Trash";
    }
  } else if (folderName === "junk") {
    const special = list.find((m) => m.specialUse === "\\Junk");
    if (special) resolved = special.path;
    else {
      const nameMatch = list.find((m) => /junk|spam/i.test(m.path));
      resolved = nameMatch ? nameMatch.path : "Junk";
    }
  } else if (folderName === "archive") {
    const special = list.find((m) => m.specialUse === "\\Archive");
    if (special) resolved = special.path;
    else {
      const nameMatch = list.find((m) => /archiv/i.test(m.path));
      resolved = nameMatch ? nameMatch.path : "Archive";
    }
  }

  if (accountKey) {
    mailboxCache.set(cacheKey, resolved);
  }

  return resolved;
}
