'background only';

import { useState, useEffect } from "@lynx-js/react";
import type { DopisApiClient, EmailSummary } from "@dopis/shared";

interface MailboxScreenProps {
  client: DopisApiClient;
  accountEmail: string;
  onSelectEmail: (id: string, folder: string) => void;
  onLogout: () => void;
}

const FOLDERS = [
  { id: "inbox", label: "Posteingang" },
  { id: "sent", label: "Gesendet" },
  { id: "archive", label: "Archiv" },
  { id: "trash", label: "Papierkorb" },
];

export function MailboxScreen({
  client,
  accountEmail,
  onSelectEmail,
  onLogout,
}: MailboxScreenProps) {
  const [selectedFolder, setSelectedFolder] = useState("inbox");
  const [emails, setEmails] = useState<EmailSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadEmails = async (folderToLoad: string) => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const data = await client.getEmails(folderToLoad);
      setEmails(data || []);
    } catch (err: any) {
      setErrorMessage(err?.message || "Fehler beim Laden der E-Mails.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEmails(selectedFolder);
  }, [selectedFolder]);

  const handleFolderChange = (folderId: string) => {
    if (selectedFolder !== folderId) {
      setSelectedFolder(folderId);
    }
  };

  const getInitials = (fromItem?: { name?: string; address?: string }) => {
    const raw = fromItem?.name || fromItem?.address || "?";
    return raw.slice(0, 2).toUpperCase();
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("de-DE", { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  return (
    <view style={styles.container}>
      {/* App Header */}
      <view style={styles.header}>
        <view style={styles.headerLeft}>
          <text style={styles.appTitle}>Dopis</text>
          <text style={styles.accountSubtitle}>{accountEmail}</text>
        </view>
        <view style={styles.headerRight}>
          <view
            style={styles.iconBtn}
            bindtap={() => loadEmails(selectedFolder)}
          >
            <text style={styles.iconText}>{isLoading ? "..." : "↻"}</text>
          </view>
          <view style={styles.logoutBtn} bindtap={onLogout}>
            <text style={styles.logoutText}>Abmelden</text>
          </view>
        </view>
      </view>

      {/* Folder Tabs */}
      <view style={styles.folderContainer}>
        <scroll-view
          scroll-orientation="horizontal"
          style={styles.folderScroll}
        >
          <view style={styles.folderRow}>
            {FOLDERS.map((f) => {
              const active = selectedFolder === f.id;
              return (
                <view
                  key={f.id}
                  style={active ? styles.folderTabActive : styles.folderTab}
                  bindtap={() => handleFolderChange(f.id)}
                >
                  <text style={active ? styles.folderTabTextActive : styles.folderTabText}>
                    {f.label}
                  </text>
                </view>
              );
            })}
          </view>
        </scroll-view>
      </view>

      {/* Error Banner */}
      {errorMessage ? (
        <view style={styles.errorBox}>
          <text style={styles.errorText}>{errorMessage}</text>
        </view>
      ) : null}

      {/* Email List Scroll View */}
      <scroll-view
        scroll-orientation="vertical"
        style={styles.listScroll}
      >
        {isLoading && emails.length === 0 ? (
          <view style={styles.emptyState}>
            <text style={styles.emptyText}>Lade E-Mails aus dem Postfach...</text>
          </view>
        ) : emails.length === 0 ? (
          <view style={styles.emptyState}>
            <text style={styles.emptyText}>Keine E-Mails in diesem Ordner</text>
          </view>
        ) : (
          emails.map((item) => {
            const isUnread = Boolean(item.isUnread);
            return (
              <view
                key={item.id}
                style={isUnread ? styles.emailItemUnread : styles.emailItem}
                bindtap={() => onSelectEmail(item.id, selectedFolder)}
              >
                {/* Avatar */}
                <view style={isUnread ? styles.avatarUnread : styles.avatar}>
                  <text style={styles.avatarText}>{getInitials(item.from)}</text>
                </view>

                {/* Main Content */}
                <view style={styles.emailBody}>
                  <view style={styles.metaRow}>
                    <text style={isUnread ? styles.senderBold : styles.senderNormal}>
                      {item.from?.name || item.from?.address || "Unbekannt"}
                    </text>
                    <text style={styles.dateText}>{formatDate(item.date)}</text>
                  </view>

                  <view style={styles.subjectRow}>
                    {isUnread ? <view style={styles.unreadBadge} /> : null}
                    <text
                      style={isUnread ? styles.subjectBold : styles.subjectNormal}
                    >
                      {item.subject || "(Kein Betreff)"}
                    </text>
                  </view>

                  {item.snippet ? (
                    <text style={styles.snippetText}>{item.snippet}</text>
                  ) : null}

                  {item.isFlagged ? (
                    <view style={styles.flagBadge}>
                      <text style={styles.flagText}>★ Markiert</text>
                    </view>
                  ) : null}
                </view>
              </view>
            );
          })
        )}
      </scroll-view>
    </view>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    backgroundColor: "#f8fafc",
  },
  header: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 18px",
    backgroundColor: "#ffffff",
    borderBottomWidth: "1px",
    borderBottomColor: "#e2e8f0",
  },
  headerLeft: {
    display: "flex",
    flexDirection: "column",
  },
  appTitle: {
    fontSize: "22px",
    fontWeight: "bold",
    color: "#0f172a",
  },
  accountSubtitle: {
    fontSize: "13px",
    color: "#64748b",
    marginTop: "2px",
  },
  headerRight: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: "8px",
  },
  iconBtn: {
    width: "40px",
    height: "40px",
    borderRadius: "10px",
    backgroundColor: "#f0f4fa",
    borderWidth: "1px",
    borderColor: "#d2def0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    color: "#3661a4",
    fontSize: "18px",
    fontWeight: "bold",
  },
  logoutBtn: {
    paddingLeft: "14px",
    paddingRight: "14px",
    height: "40px",
    borderRadius: "10px",
    backgroundColor: "#f1f5f9",
    borderWidth: "1px",
    borderColor: "#e2e8f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: {
    color: "#475569",
    fontSize: "13px",
    fontWeight: "600",
  },
  folderContainer: {
    backgroundColor: "#ffffff",
    borderBottomWidth: "1px",
    borderBottomColor: "#e2e8f0",
    padding: "10px 14px",
  },
  folderScroll: {
    width: "100%",
  },
  folderRow: {
    display: "flex",
    flexDirection: "row",
    gap: "8px",
  },
  folderTab: {
    paddingLeft: "16px",
    paddingRight: "16px",
    paddingTop: "8px",
    paddingBottom: "8px",
    borderRadius: "20px",
    backgroundColor: "#f1f5f9",
    borderWidth: "1px",
    borderColor: "#e2e8f0",
  },
  folderTabActive: {
    paddingLeft: "16px",
    paddingRight: "16px",
    paddingTop: "8px",
    paddingBottom: "8px",
    borderRadius: "20px",
    backgroundColor: "#3661a4",
  },
  folderTabText: {
    fontSize: "14px",
    color: "#475569",
    fontWeight: "500",
  },
  folderTabTextActive: {
    fontSize: "14px",
    color: "#ffffff",
    fontWeight: "bold",
  },
  errorBox: {
    backgroundColor: "#fef2f2",
    borderWidth: "1px",
    borderColor: "#fecaca",
    padding: "12px 16px",
    margin: "12px 14px",
    borderRadius: "10px",
  },
  errorText: {
    color: "#dc2626",
    fontSize: "14px",
    fontWeight: "500",
  },
  listScroll: {
    flex: 1,
    paddingLeft: "14px",
    paddingRight: "14px",
    paddingTop: "12px",
  },
  emptyState: {
    padding: "48px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "#64748b",
    fontSize: "15px",
  },
  emailItem: {
    display: "flex",
    flexDirection: "row",
    padding: "14px",
    marginBottom: "10px",
    backgroundColor: "#ffffff",
    borderRadius: "14px",
    borderWidth: "1px",
    borderColor: "#e2e8f0",
    alignItems: "flex-start",
  },
  emailItemUnread: {
    display: "flex",
    flexDirection: "row",
    padding: "14px",
    marginBottom: "10px",
    backgroundColor: "#f4f8fd",
    borderRadius: "14px",
    borderWidth: "1.5px",
    borderColor: "#a4c2ea",
    alignItems: "flex-start",
  },
  avatar: {
    width: "42px",
    height: "42px",
    borderRadius: "21px",
    backgroundColor: "#e2e8f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginRight: "12px",
  },
  avatarUnread: {
    width: "42px",
    height: "42px",
    borderRadius: "21px",
    backgroundColor: "#3661a4",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginRight: "12px",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: "bold",
  },
  emailBody: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  metaRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "4px",
  },
  senderNormal: {
    fontSize: "15px",
    color: "#334155",
    fontWeight: "500",
  },
  senderBold: {
    fontSize: "15px",
    color: "#0f172a",
    fontWeight: "bold",
  },
  dateText: {
    fontSize: "12px",
    color: "#64748b",
  },
  subjectRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: "4px",
  },
  unreadBadge: {
    width: "8px",
    height: "8px",
    borderRadius: "4px",
    backgroundColor: "#3661a4",
    marginRight: "6px",
  },
  subjectNormal: {
    fontSize: "14px",
    color: "#475569",
  },
  subjectBold: {
    fontSize: "15px",
    color: "#0f172a",
    fontWeight: "bold",
  },
  snippetText: {
    fontSize: "13px",
    color: "#64748b",
    lineHeight: "18px",
    marginTop: "3px",
  },
  flagBadge: {
    marginTop: "6px",
    paddingLeft: "8px",
    paddingRight: "8px",
    paddingTop: "3px",
    paddingBottom: "3px",
    backgroundColor: "#fef9c3",
    borderWidth: "1px",
    borderColor: "#fde047",
    borderRadius: "6px",
    alignSelf: "flex-start",
  },
  flagText: {
    color: "#854d0e",
    fontSize: "12px",
    fontWeight: "600",
  },
};
