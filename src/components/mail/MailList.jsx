import React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SenderAvatar } from "./SenderAvatar";
import {
  Sparkles,
  Clock,
  AlertCircle,
  Package,
  Layers,
  CheckCircle2,
  Truck,
  RotateCcw,
  ShoppingBag,
  Ticket,
  CreditCard,
  Star,
  Archive,
  Trash2,
  Mail,
  MailOpen,
} from "lucide-react";
import { useAiQueue } from "@/lib/aiQueue";
import { getStageLabel } from "@/lib/threadEngine";
import { prefetchEmail } from "@/lib/emailCache";

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const isThisYear = date.getFullYear() === now.getFullYear();
  if (isThisYear) {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  return date.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
}

const AVATAR_COLORS = [
  "#2563eb", // blue (e.g. Jobwork, momox)
  "#78350f", // warm brown / amber-900 (like DIE ZEIT)
  "#0f766e", // deep teal / pine green (like Vinted)
  "#1d4ed8", // royal blue
  "#7c3aed", // violet
  "#b91c1c", // red
  "#c2410c", // orange
  "#047857", // emerald
  "#4338ca", // indigo
  "#a21caf", // fuchsia
  "#0369a1", // sky
];

function getAvatarColor(nameOrEmail = "") {
  let hash = 0;
  for (let i = 0; i < nameOrEmail.length; i++) {
    hash = nameOrEmail.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function getSenderInitials(name = "", email = "") {
  const cleanName = (name || "").trim().replace(/[^\p{L}\p{N}\s]/gu, "");
  const words = cleanName.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  if (words.length === 1 && words[0].length > 0) {
    return words[0][0].toUpperCase();
  }
  if (email) {
    const user = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
    return user.slice(0, 2).toUpperCase() || "?";
  }
  return "?";
}

function getCategoryColor(category) {
  switch (category?.toLowerCase()) {
    case "spam":
    case "phishing":
      return "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20";
    case "werbung":
    case "angebote":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20";
    case "rechnung":
    case "finanzen":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20";
    case "dringend":
    case "wichtig":
      return "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20";
    case "newsletter":
      return "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20";
    case "benachrichtigung":
      return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20";
    case "persönlich":
      return "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20";
    case "update":
      return "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function MailList({
  items = [],
  selectedMailId,
  onSelectMail,
  viewMode = "mailspring",
  folder = "inbox",
  onToggleRead,
  onMoveToTrash,
  onArchive,
  onToggleStar,
}) {
  const { currentItem, queue, activityLog } = useAiQueue();

  if (!items || items.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <p className="text-sm font-medium">Keine E-Mails gefunden</p>
        <p className="text-xs text-muted-foreground/75 mt-1">
          Dein Postfach oder Suchfilter enthält derzeit keine Ergebnisse.
        </p>
      </div>
    );
  }

  // MAILSPRING COMPACT STYLE (Single-line list matching photo)
  if (viewMode === "mailspring") {
    return (
      <div className="flex flex-col divide-y divide-border/40 select-none">
        {items.map((threadOrMail) => {
          const isThread = Boolean(threadOrMail.mails && Array.isArray(threadOrMail.mails));
          const threadMails = isThread ? threadOrMail.mails : [threadOrMail];
          const latestMail = isThread ? threadOrMail.latestMail : threadOrMail;
          const mainId = latestMail?.id || latestMail?.seq || (threadMails[0]?.id || threadMails[0]?.seq);

          const isSelected = String(selectedMailId) === String(mainId) ||
            threadMails.some((m) => String(m.id || m.seq) === String(selectedMailId));

          const isUnread = isThread ? threadOrMail.hasUnread : !latestMail.read;
          const isStarred = isThread ? threadOrMail.isFlagged : latestMail.flagged;

          const isOrder = Boolean(isThread && threadOrMail.isOrderThread && threadOrMail.orderJourney);
          const order = threadOrMail.orderJourney;

          const senderName = isOrder
            ? order?.merchant || latestMail.name || latestMail.email
            : latestMail.name || latestMail.email;

          const initials = getSenderInitials(senderName, latestMail.email);
          const avatarBg = getAvatarColor(senderName || latestMail.email);

          const snippet =
            order?.productSummary ||
            latestMail.ai?.summary ||
            latestMail.summary ||
            latestMail.snippet ||
            (latestMail.text ? latestMail.text.slice(0, 100).replace(/\s+/g, " ").trim() : "");

          const mailCount = isThread ? threadOrMail.count : 1;

          return (
            <div
              key={threadOrMail.id || mainId}
              onClick={() => onSelectMail(mainId, threadOrMail)}
              onMouseEnter={() => prefetchEmail(mainId, folder)}
              className={cn(
                "group relative flex items-center gap-2.5 px-3 py-2 text-xs transition-colors cursor-pointer",
                isSelected
                  ? "bg-primary/10 dark:bg-primary/15"
                  : "hover:bg-muted/50",
                isUnread && !isSelected && "bg-background font-medium"
              )}
            >
              {/* 1. Left Indicator: Blue Unread Dot or Star Button */}
              <div className="w-5 flex items-center justify-center shrink-0">
                {isStarred ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleStar?.(mainId);
                    }}
                    className="text-amber-400 hover:text-amber-500 transition-colors p-0.5"
                    title="Sternmarkierung entfernen"
                  >
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  </button>
                ) : isUnread ? (
                  <>
                    <span
                      className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-500 group-hover:hidden shadow-2xs"
                      title="Ungelesen"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleStar?.(mainId);
                      }}
                      className="hidden group-hover:block text-muted-foreground/30 hover:text-amber-400 transition-colors p-0.5"
                      title="Mit Stern markieren"
                    >
                      <Star className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleStar?.(mainId);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground/30 hover:text-amber-400 transition-all p-0.5"
                    title="Mit Stern markieren"
                  >
                    <Star className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* 2. Avatar: Company Logo (if available) with fallback to Initials or Order Icon */}
              <SenderAvatar
                email={latestMail.email}
                name={senderName}
                initials={initials}
                avatarBg={avatarBg}
                icon={isOrder ? (order?.orderType === "ticket" ? Ticket : Package) : null}
                size="sm"
                shape="circle"
              />

              {/* 3. Sender Name */}
              <div className="w-36 sm:w-44 md:w-48 shrink-0 truncate">
                <span
                  className={cn(
                    "truncate block",
                    isUnread ? "font-bold text-foreground" : "font-normal text-foreground/85 dark:text-muted-foreground"
                  )}
                >
                  {senderName}
                </span>
              </div>

              {/* 4. Subject + Thread Count + Snippet (Single Row) */}
              <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden">
                <span
                  className={cn(
                    "truncate shrink-0 max-w-[65%]",
                    isUnread ? "font-bold text-foreground" : "font-normal text-foreground"
                  )}
                >
                  {isOrder && order?.productSummary
                    ? `${order.productSummary} • ${latestMail.subject}`
                    : latestMail.subject || "(Kein Betreff)"}
                </span>

                {/* Thread count badge */}
                {mailCount > 1 && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-muted border px-1.5 py-0.2 text-[10px] font-mono text-muted-foreground shrink-0">
                    {mailCount}
                  </span>
                )}

                {/* Order Stage Badge (compact) */}
                {isOrder && order && (
                  <span className="hidden md:inline-flex items-center gap-1 rounded border border-primary/25 bg-primary/10 px-1.5 py-0.2 text-[10px] font-medium text-primary shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    {order.statusTitle || getStageLabel(order.currentStage)}
                  </span>
                )}

                {/* Snippet / Preview */}
                {snippet && (
                  <span className="text-muted-foreground/75 font-normal truncate shrink min-w-0">
                    {snippet}
                  </span>
                )}
              </div>

              {/* 5. Right: Date or Hover Quick Action Box */}
              <div className="shrink-0 flex items-center justify-end min-w-[56px]">
                {/* Normal state: Date */}
                <span className="text-[11px] text-muted-foreground whitespace-nowrap group-hover:hidden tabular-nums">
                  {formatDate(threadOrMail.date || latestMail.date)}
                </span>

                {/* Hover state: Boxed Action Buttons (Archive, Trash, Read/Unread) */}
                <div className="hidden group-hover:flex items-center rounded border border-border/80 bg-background text-muted-foreground shadow-2xs divide-x divide-border/60">
                  <button
                    type="button"
                    title="Archivieren"
                    onClick={(e) => {
                      e.stopPropagation();
                      onArchive?.(mainId);
                    }}
                    className="p-1 hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                  >
                    <Archive className="h-3.5 w-3.5" />
                    <span className="sr-only">Archivieren</span>
                  </button>
                  <button
                    type="button"
                    title="Löschen"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveToTrash?.(mainId);
                    }}
                    className="p-1 hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="sr-only">Löschen</span>
                  </button>
                  <button
                    type="button"
                    title={isUnread ? "Als gelesen markieren" : "Als ungelesen markieren"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleRead?.(mainId, !isUnread);
                    }}
                    className="p-1 hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                  >
                    {isUnread ? <MailOpen className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                    <span className="sr-only">{isUnread ? "Gelesen" : "Ungelesen"}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // CARDS / EXTENDED STYLE (Default multi-line cards)
  return (
    <div className="flex flex-col gap-2 p-3 pt-0">
      {items.map((threadOrMail) => {
        const isThread = Boolean(threadOrMail.mails && Array.isArray(threadOrMail.mails));
        const threadMails = isThread ? threadOrMail.mails : [threadOrMail];
        const latestMail = isThread ? threadOrMail.latestMail : threadOrMail;
        const mailCount = isThread ? threadOrMail.count : 1;

        const mainId = latestMail.id || latestMail.seq;
        const isSelected =
          String(mainId) === String(selectedMailId) ||
          (isThread && threadMails.some((m) => String(m.id || m.seq) === String(selectedMailId)));

        const isUnread = isThread ? threadOrMail.hasUnread : !latestMail.read;
        const category = latestMail.ai?.category || latestMail.category;
        const tags = latestMail.ai?.tags || latestMail.tags || [];

        const isCurrentlyAnalyzing = threadMails.some(
          (m) => currentItem && String(currentItem.id) === String(m.id || m.seq)
        );
        const isQueued = threadMails.some((m) =>
          queue.some((q) => String(q.id) === String(m.id || m.seq))
        );
        const hasFailed = threadMails.some((m) => {
          const id = m.id || m.seq;
          const log = activityLog.find((a) => String(a.mailId) === String(id));
          return log && log.status === "error";
        });

        const isOrder = Boolean(isThread && threadOrMail.isOrderThread && threadOrMail.orderJourney);
        const order = threadOrMail.orderJourney;

        return (
          <button
            key={threadOrMail.id || mainId}
            type="button"
            onClick={() => onSelectMail(mainId, threadOrMail)}
            onMouseEnter={() => prefetchEmail(mainId, folder)}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3 text-left text-xs transition-all cursor-pointer hover:bg-muted/50",
              isSelected && "bg-muted/80 border-primary/40 shadow-2xs",
              isUnread && "font-medium"
            )}
          >
            {/* Avatar, Ticket, Payment or Order Icon */}
            {isOrder ? (
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg border shrink-0 mt-0.5 shadow-2xs",
                  order?.orderType === "ticket"
                    ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                    : order?.paymentProvider && !order?.carrier
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                    : "bg-primary/10 text-primary border-primary/20"
                )}
              >
                {order?.orderType === "ticket" ? (
                  <Ticket className="h-4 w-4" />
                ) : order?.paymentProvider && !order?.carrier ? (
                  <CreditCard className="h-4 w-4" />
                ) : (
                  <Package className="h-4 w-4" />
                )}
              </div>
            ) : (
              <SenderAvatar
                email={latestMail.email}
                name={latestMail.name || latestMail.email}
                size="md"
                shape="rounded"
                className="mt-0.5 shrink-0"
              />
            )}

            <div className="flex-1 min-w-0 flex flex-col gap-1">
              {/* Header row: Sender / Merchant + Thread Count Badge + Date */}
              <div className="flex w-full items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <span className="truncate text-xs font-semibold text-foreground">
                    {isOrder
                      ? order?.merchant || latestMail.name || latestMail.email
                      : latestMail.name || latestMail.email}
                  </span>

                  {/* Thread Counter Badge */}
                  {mailCount > 1 && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-muted border px-1.5 py-0.2 text-[10px] font-mono text-muted-foreground shrink-0">
                      {isOrder && order?.orderType === "ticket" ? (
                        <Ticket className="h-2.5 w-2.5 text-purple-600 dark:text-purple-400" />
                      ) : isOrder ? (
                        <Package className="h-2.5 w-2.5 text-primary" />
                      ) : (
                        <Layers className="h-2.5 w-2.5" />
                      )}
                      {mailCount}
                    </span>
                  )}

                  {isUnread && (
                    <span
                      className="flex h-2 w-2 rounded-full bg-blue-600 shrink-0"
                      title="Ungelesen"
                    />
                  )}
                </div>

                <span
                  className={cn(
                    "text-[11px] whitespace-nowrap shrink-0",
                    isSelected ? "text-foreground font-medium" : "text-muted-foreground"
                  )}
                >
                  {formatDate(threadOrMail.date || latestMail.date)}
                </span>
              </div>

              {/* Subject or Product Summary */}
              <div className="w-full text-xs text-foreground truncate">
                {isOrder && order?.productSummary ? (
                  <span className="font-medium text-foreground">
                    {order.productSummary}{" "}
                    <span className="text-muted-foreground font-normal">
                      • {latestMail.subject}
                    </span>
                  </span>
                ) : (
                  latestMail.subject || "(Kein Betreff)"
                )}
              </div>

              {/* Status Badges & Category Chips */}
              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                {/* Order Stage Badge */}
                {isOrder && order && (
                  <span className="inline-flex items-center gap-1 rounded border border-primary/25 bg-primary/10 px-1.5 py-0.2 text-[10px] font-semibold text-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    {order.statusTitle || getStageLabel(order.currentStage)}
                  </span>
                )}

                {/* Queue status */}
                {isCurrentlyAnalyzing ? (
                  <span className="inline-flex items-center gap-1 rounded bg-primary/10 border border-primary/20 px-1.5 py-0.2 text-[10px] font-medium text-primary animate-pulse">
                    <Sparkles className="h-2.5 w-2.5 animate-spin" />
                    In Analyse
                  </span>
                ) : isQueued ? (
                  <span className="inline-flex items-center gap-1 rounded bg-muted border px-1.5 py-0.2 text-[10px] text-muted-foreground">
                    <Clock className="h-2.5 w-2.5" />
                    Warteschlange
                  </span>
                ) : hasFailed ? (
                  <span className="inline-flex items-center gap-1 rounded bg-destructive/10 border border-destructive/20 px-1.5 py-0.2 text-[10px] text-destructive">
                    <AlertCircle className="h-2.5 w-2.5" />
                    KI-Fehler
                  </span>
                ) : !isOrder && category ? (
                  <span
                    className={cn(
                      "inline-flex items-center rounded px-1.5 py-0.2 text-[10px] font-medium border",
                      getCategoryColor(category)
                    )}
                  >
                    {category}
                  </span>
                ) : null}

                {/* Tags */}
                {tags.slice(0, 2).map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center rounded bg-muted/60 border px-1.5 py-0.2 text-[10px] text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
