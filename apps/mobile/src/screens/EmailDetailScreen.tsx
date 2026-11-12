'background only';

import { useState, useEffect } from "@lynx-js/react";
import type { DopisApiClient, EmailDetail } from "@dopis/shared";

interface EmailDetailScreenProps {
  client: DopisApiClient;
  emailId: string;
  folder: string;
  onBack: () => void;
  onEmailUpdated?: () => void;
}

export function EmailDetailScreen({
  client,
  emailId,
  folder,
  onBack,
  onEmailUpdated,
}: EmailDetailScreenProps) {
  const [detail, setDetail] = useState<EmailDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  // AI summary state
  const [aiSummary, setAiSummary] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [aiError, setAiError] = useState("");

  // Action feedback
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    let isMounted = true;
    const fetchDetail = async () => {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const data = await client.getEmail(emailId, folder);
        if (isMounted) {
          setDetail(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(err?.message || "Failed to load email details.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    fetchDetail();
    return () => {
      isMounted = false;
    };
  }, [emailId, folder]);

  const handleArchive = async () => {
    if (!detail) return;
    try {
      await client.archiveEmail(detail.id, folder);
      setActionMessage("In das Archiv verschoben.");
      onEmailUpdated?.();
      setTimeout(onBack, 600);
    } catch (err: any) {
      setActionMessage("Archivieren fehlgeschlagen: " + err.message);
    }
  };

  const handleTrash = async () => {
    if (!detail) return;
    try {
      await client.trashEmail(detail.id, folder);
      setActionMessage("In den Papierkorb verschoben.");
      onEmailUpdated?.();
      setTimeout(onBack, 600);
    } catch (err: any) {
      setActionMessage("Löschen fehlgeschlagen: " + err.message);
    }
  };

  const handleToggleFlag = async () => {
    if (!detail) return;
    const newState = !detail.isFlagged;
    try {
      await client.toggleFlag(detail.id, "flagged", newState, folder);
      setDetail({ ...detail, isFlagged: newState });
      setActionMessage(newState ? "E-Mail markiert." : "Markierung entfernt.");
      onEmailUpdated?.();
    } catch (err: any) {
      setActionMessage("Markierung fehlgeschlagen: " + err.message);
    }
  };

  const handleGenerateAiSummary = async () => {
    if (!detail) return;
    setIsSummarizing(true);
    setAiError("");
    try {
      const emailContent = detail.text || detail.snippet || detail.subject;
      const sender = detail.from?.name || detail.from?.address || "Absender";
      const prompt = `Fasse diese E-Mail von ${sender} zum Thema "${detail.subject}" prägnant zusammen:\n\n${emailContent.slice(0, 1200)}`;
      const res = await client.testAi(prompt);
      if (res && res.reply) {
        setAiSummary(res.reply);
      } else {
        setAiSummary("E-Mail erfolgreich analysiert. Keine offenen Aufgaben erkannt.");
      }
    } catch (err: any) {
      setAiError(err?.message || "Verbindung zum KI-Dienst fehlgeschlagen.");
    } finally {
      setIsSummarizing(false);
    }
  };

  const getInitials = (nameOrAddress?: string) => {
    return (nameOrAddress || "?").slice(0, 2).toUpperCase();
  };

  return (
    <view style={styles.container}>
      {/* Top Bar */}
      <view style={styles.topBar}>
        <view style={styles.backBtn} bindtap={onBack}>
          <text style={styles.backText}>← Zurück</text>
        </view>
        <view style={styles.actionRow}>
          <view style={styles.actionBtn} bindtap={handleToggleFlag}>
            <text style={detail?.isFlagged ? styles.starActive : styles.actionText}>
              {detail?.isFlagged ? "★ Markiert" : "☆ Markieren"}
            </text>
          </view>
          <view style={styles.actionBtn} bindtap={handleArchive}>
            <text style={styles.actionText}>📥 Archiv</text>
          </view>
          <view style={styles.trashBtn} bindtap={handleTrash}>
            <text style={styles.trashText}>🗑 Löschen</text>
          </view>
        </view>
      </view>

      {/* Toast message */}
      {actionMessage ? (
        <view style={styles.toast}>
          <text style={styles.toastText}>{actionMessage}</text>
        </view>
      ) : null}

      <scroll-view scroll-orientation="vertical" style={styles.scroll}>
        {isLoading ? (
          <view style={styles.centerBox}>
            <text style={styles.infoText}>Lade E-Mail-Inhalt...</text>
          </view>
        ) : errorMessage ? (
          <view style={styles.centerBox}>
            <text style={styles.errorText}>{errorMessage}</text>
          </view>
        ) : detail ? (
          <view style={styles.contentWrap}>
            {/* Subject */}
            <text style={styles.subject}>{detail.subject || "(Kein Betreff)"}</text>

            {/* Sender Meta Card */}
            <view style={styles.senderCard}>
              <view style={styles.avatar}>
                <text style={styles.avatarText}>
                  {getInitials(detail.from?.name || detail.from?.address)}
                </text>
              </view>
              <view style={styles.senderInfo}>
                <text style={styles.senderName}>
                  {detail.from?.name || detail.from?.address || "Unbekannt"}
                </text>
                <text style={styles.senderAddress}>{detail.from?.address || ""}</text>
                <text style={styles.dateText}>{detail.date || ""}</text>
              </view>
            </view>

            {/* AI Summary Card */}
            <view style={styles.aiCard}>
              <view style={styles.aiHeader}>
                <view style={styles.aiTitleRow}>
                  <text style={styles.aiTitle}>✦ KI-Zusammenfassung</text>
                </view>
                <view
                  style={isSummarizing ? styles.aiBtnDisabled : styles.aiBtn}
                  bindtap={isSummarizing ? undefined : handleGenerateAiSummary}
                >
                  <text style={styles.aiBtnText}>
                    {isSummarizing ? "Analysiere..." : aiSummary ? "Neu analysieren" : "Zusammenfassen"}
                  </text>
                </view>
              </view>
              {aiError ? (
                <text style={styles.aiErrorText}>{aiError}</text>
              ) : null}
              {aiSummary ? (
                <view style={styles.aiResultBox}>
                  <text style={styles.aiResultText}>{aiSummary}</text>
                </view>
              ) : (
                <text style={styles.aiHintText}>
                  Erstelle eine Zusammenfassung und Handlungsempfehlungen mit Dopis KI.
                </text>
              )}
            </view>

            {/* Email Body Card */}
            <view style={styles.bodyCard}>
              <text style={styles.bodyContent}>
                {detail.text || (detail.html ? "[HTML Inhalt]" : "(Kein Nachrichtentext)")}
              </text>
            </view>
          </view>
        ) : null}
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
  topBar: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    backgroundColor: "#ffffff",
    borderBottomWidth: "1px",
    borderBottomColor: "#e2e8f0",
  },
  backBtn: {
    paddingLeft: "14px",
    paddingRight: "14px",
    paddingTop: "8px",
    paddingBottom: "8px",
    borderRadius: "8px",
    backgroundColor: "#f0f4fa",
    borderWidth: "1px",
    borderColor: "#d2def0",
  },
  backText: {
    color: "#3661a4",
    fontSize: "14px",
    fontWeight: "bold",
  },
  actionRow: {
    display: "flex",
    flexDirection: "row",
    gap: "8px",
  },
  actionBtn: {
    paddingLeft: "12px",
    paddingRight: "12px",
    paddingTop: "8px",
    paddingBottom: "8px",
    borderRadius: "8px",
    backgroundColor: "#f1f5f9",
    borderWidth: "1px",
    borderColor: "#e2e8f0",
  },
  actionText: {
    color: "#334155",
    fontSize: "13px",
    fontWeight: "500",
  },
  starActive: {
    color: "#ca8a04",
    fontSize: "13px",
    fontWeight: "bold",
  },
  trashBtn: {
    paddingLeft: "12px",
    paddingRight: "12px",
    paddingTop: "8px",
    paddingBottom: "8px",
    borderRadius: "8px",
    backgroundColor: "#fef2f2",
    borderWidth: "1px",
    borderColor: "#fecaca",
  },
  trashText: {
    color: "#dc2626",
    fontSize: "13px",
    fontWeight: "600",
  },
  toast: {
    backgroundColor: "#3661a4",
    padding: "10px 16px",
    alignItems: "center",
  },
  toastText: {
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: "bold",
  },
  scroll: {
    flex: 1,
  },
  centerBox: {
    padding: "48px 20px",
    alignItems: "center",
    justifyContent: "center",
  },
  infoText: {
    color: "#64748b",
    fontSize: "15px",
  },
  errorText: {
    color: "#dc2626",
    fontSize: "15px",
    fontWeight: "500",
  },
  contentWrap: {
    padding: "16px",
    display: "flex",
    flexDirection: "column",
  },
  subject: {
    fontSize: "20px",
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: "16px",
    lineHeight: "28px",
  },
  senderCard: {
    display: "flex",
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: "14px",
    padding: "14px",
    marginBottom: "14px",
    borderWidth: "1px",
    borderColor: "#e2e8f0",
    alignItems: "center",
  },
  avatar: {
    width: "44px",
    height: "44px",
    borderRadius: "22px",
    backgroundColor: "#3661a4",
    alignItems: "center",
    justifyContent: "center",
    marginRight: "12px",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: "bold",
  },
  senderInfo: {
    display: "flex",
    flexDirection: "column",
  },
  senderName: {
    fontSize: "16px",
    fontWeight: "bold",
    color: "#0f172a",
  },
  senderAddress: {
    fontSize: "13px",
    color: "#64748b",
    marginTop: "2px",
  },
  dateText: {
    fontSize: "12px",
    color: "#94a3b8",
    marginTop: "2px",
  },
  aiCard: {
    backgroundColor: "#f4f8fd",
    borderRadius: "14px",
    padding: "16px",
    marginBottom: "14px",
    borderWidth: "1px",
    borderColor: "#c0d4ed",
  },
  aiHeader: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
  },
  aiTitleRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
  },
  aiTitle: {
    fontSize: "15px",
    fontWeight: "bold",
    color: "#284a7e",
  },
  aiBtn: {
    paddingLeft: "14px",
    paddingRight: "14px",
    paddingTop: "7px",
    paddingBottom: "7px",
    borderRadius: "8px",
    backgroundColor: "#3661a4",
  },
  aiBtnDisabled: {
    paddingLeft: "14px",
    paddingRight: "14px",
    paddingTop: "7px",
    paddingBottom: "7px",
    borderRadius: "8px",
    backgroundColor: "#93c5fd",
  },
  aiBtnText: {
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: "bold",
  },
  aiHintText: {
    fontSize: "13px",
    color: "#3661a4",
    lineHeight: "18px",
  },
  aiErrorText: {
    fontSize: "13px",
    color: "#dc2626",
    marginBottom: "8px",
  },
  aiResultBox: {
    backgroundColor: "#ffffff",
    borderRadius: "10px",
    padding: "12px 14px",
    borderWidth: "1px",
    borderColor: "#dbeafe",
  },
  aiResultText: {
    fontSize: "14px",
    color: "#1e3a8a",
    lineHeight: "22px",
  },
  bodyCard: {
    backgroundColor: "#ffffff",
    borderRadius: "14px",
    padding: "18px 16px",
    borderWidth: "1px",
    borderColor: "#e2e8f0",
    marginBottom: "20px",
  },
  bodyContent: {
    fontSize: "15px",
    color: "#1e293b",
    lineHeight: "24px",
  },
};
