export async function resolveMailboxPath(client, folderName) {
  if (!folderName || folderName === "inbox") {
    return "INBOX";
  }

  const list = await client.list();
  
  if (folderName === "trash") {
    const special = list.find((m) => m.specialUse === "\\Trash");
    if (special) return special.path;
    const nameMatch = list.find((m) => /trash|papierkorb|gel[öo]schte/i.test(m.path));
    if (nameMatch) return nameMatch.path;
    return "Trash";
  }

  if (folderName === "junk") {
    const special = list.find((m) => m.specialUse === "\\Junk");
    if (special) return special.path;
    const nameMatch = list.find((m) => /junk|spam/i.test(m.path));
    if (nameMatch) return nameMatch.path;
    return "Junk";
  }

  if (folderName === "archive") {
    const special = list.find((m) => m.specialUse === "\\Archive");
    if (special) return special.path;
    const nameMatch = list.find((m) => /archiv/i.test(m.path));
    if (nameMatch) return nameMatch.path;
    return "Archive";
  }

  return "INBOX";
}
