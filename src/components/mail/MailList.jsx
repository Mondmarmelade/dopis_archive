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
} from "lucide-react";
import { useAiQueue } from "@/lib/aiQueue";
import { getStageLabel } from "@/lib/threadEngine";

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

export function MailList({ items = [], selectedMailId, onSelectMail }) {
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

  return (
    <div className="flex flex-col gap-2 p-3 pt-0">
      {items.map((threadOrMail) => {
        // Handle both ThreadItem and single EmailItem
        const isThread = Boolean(threadOrMail.mails && Array.isArray(threadOrMail.mails));
        const threadMails = isThread ? threadOrMail.mails : [threadOrMail];
        const latestMail = isThread ? threadOrMail.latestMail : threadOrMail;
        const mailCount = isThread ? threadOrMail.count : 1;

        const mainId = latestMail.id || latestMail.seq;
        // Check if selected either directly or by thread ID / contained mail ID
        const isSelected =
          String(mainId) === String(selectedMailId) ||
          (isThread && threadMails.some((m) => String(m.id || m.seq) === String(selectedMailId)));

        const isUnread = isThread ? threadOrMail.hasUnread : !latestMail.read;
        const category = latestMail.ai?.category || latestMail.category;
        const tags = latestMail.ai?.tags || latestMail.tags || [];

        // Check queue statuses across thread
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

        const isOrder = isThread && threadOrMail.isOrderThread && threadOrMail.orderJourney;
        const order = threadOrMail.orderJourney;

        return (
          <button
            key={threadOrMail.id || mainId}
            type="button"
            onClick={() => onSelectMail(mainId, threadOrMail)}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3 text-left text-xs transition-all cursor-pointer hover:bg-muted/50",
              isSelected && "bg-muted/80 border-primary/40 shadow-2xs",
              isUnread && "font-medium"
            )}
          >
            {/* Avatar or Order Icon */}
            {isOrder ? (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0 mt-0.5">
                <Package className="h-4 w-4" />
              </div>
            ) : (
              <SenderAvatar email={latestMail.email} size="md" className="mt-0.5 shrink-0" />
            )}

            <div className="flex-1 min-w-0 flex flex-col gap-1">
              {/* Header row: Sender / Merchant + Thread Count Badge + Date */}
              <div className="flex w-full items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <span className="truncate text-xs font-semibold text-foreground">
                    {isOrder
                      ? order.merchant || latestMail.name || latestMail.email
                      : latestMail.name || latestMail.email}
                  </span>

                  {/* Thread Counter Badge */}
                  {mailCount > 1 && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-muted border px-1.5 py-0.2 text-[10px] font-mono text-muted-foreground shrink-0">
                      {isOrder ? (
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
                {isOrder && order.productSummary ? (
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
                {isOrder && (
                  <span className="inline-flex items-center gap-1 rounded border border-primary/25 bg-primary/10 px-1.5 py-0.2 text-[10px] font-semibold text-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    {getStageLabel(order.currentStage)}
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
