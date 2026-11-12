import React, { useEffect, useState, useRef } from "react";
import DOMPurify from "dompurify";
import {
  Archive,
  ArchiveX,
  Clock,
  Forward,
  MoreVertical,
  Paperclip,
  Reply,
  ReplyAll,
  Trash2,
  Mail as MailIcon,
  MailCheck,
  Loader2,
  RefreshCw,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Package,
  HelpCircle,
  Keyboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AiInsightsCard } from "./AiInsightsCard";
import { OrderTimelineCard } from "./OrderTimelineCard";
import { SenderAvatar } from "./SenderAvatar";
import { cn } from "@/lib/utils";
import { getCachedEmail, fetchEmailDetail } from "@/lib/emailCache";

let isHookAdded = false;

function sanitizeEmailHtml(rawHtml) {
  if (!rawHtml) return "";
  if (typeof window === "undefined") return "";

  try {
    if (!isHookAdded && typeof DOMPurify?.addHook === "function") {
      DOMPurify.addHook("afterSanitizeAttributes", (node) => {
        if (node.tagName === "A" && node.hasAttribute("href")) {
          node.setAttribute("target", "_blank");
          node.setAttribute("rel", "noopener noreferrer");
        }
      });
      isHookAdded = true;
    }

    return DOMPurify.sanitize(rawHtml, {
      ADD_ATTR: ["target", "rel"],
    });
  } catch (e) {
    console.error("DOMPurify HTML sanitization failed:", e);
    return "<p class='text-destructive text-xs italic'>[HTML-Inhalt konnte aus Sicherheitsgründen nicht geladen werden.]</p>";
  }
}

function formatFullDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";

  return date.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShortDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function MailDisplay({
  selectedMailId,
  summaryMail,
  thread,
  onSelectMailInThread,
  isRead,
  onToggleRead,
  onMoveToTrash,
  onArchive,
  currentFolder = "inbox",
  aiAnalysis,
  aiLoading,
  aiError,
  onReanalyze,
  onToggleActionItem,
  onOpenShortcutsModal,
}) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showThreadStream, setShowThreadStream] = useState(true);

  useEffect(() => {
    if (!selectedMailId) {
      setDetail(null);
      setError(null);
      setLoading(false);
      return;
    }

    const cached = getCachedEmail(selectedMailId, currentFolder);
    if (cached) {
      setDetail(cached);
      setLoading(false);
      setError(null);
      return;
    }

    // Set detail to null to prevent displaying previous email's body, but keep optimistic UI
    setDetail(null);
    setLoading(true);
    setError(null);

    let isMounted = true;
    fetchEmailDetail(selectedMailId, currentFolder)
      .then((data) => {
        if (isMounted) {
          setDetail(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedMailId, currentFolder]);

  if (!selectedMailId) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground animate-in fade-in duration-200">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/40 border border-border/70 mb-4 text-muted-foreground shadow-xs">
          <MailIcon className="h-6 w-6 text-muted-foreground/75" />
        </div>
        <h3 className="text-base font-semibold text-foreground tracking-tight">Keine E-Mail ausgewählt</h3>
        <p className="mt-1 text-xs text-muted-foreground max-w-sm leading-relaxed">
          Wähle eine Nachricht links aus oder navigiere direkt mit der Tastatur:
        </p>

        {/* Quick Shortcut Hint Pills */}
        <div className="grid grid-cols-2 gap-2.5 mt-6 max-w-sm w-full text-left">
          <div className="p-2.5 rounded-xl border border-border/70 bg-card shadow-2xs flex items-center justify-between text-xs transition-all hover:border-border">
            <span className="text-muted-foreground text-[11px]">Navigieren</span>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded-md bg-muted/80 border border-border/80 font-mono text-[10px] text-foreground">J</kbd>
              <kbd className="px-1.5 py-0.5 rounded-md bg-muted/80 border border-border/80 font-mono text-[10px] text-foreground">K</kbd>
            </div>
          </div>
          <div className="p-2.5 rounded-xl border border-border/70 bg-card shadow-2xs flex items-center justify-between text-xs transition-all hover:border-border">
            <span className="text-muted-foreground text-[11px]">Archivieren</span>
            <kbd className="px-1.5 py-0.5 rounded-md bg-muted/80 border border-border/80 font-mono text-[10px] text-foreground">E</kbd>
          </div>
          <div className="p-2.5 rounded-xl border border-border/70 bg-card shadow-2xs flex items-center justify-between text-xs transition-all hover:border-border">
            <span className="text-muted-foreground text-[11px]">Papierkorb</span>
            <kbd className="px-1.5 py-0.5 rounded-md bg-muted/80 border border-border/80 font-mono text-[10px] text-foreground">Entf</kbd>
          </div>
          <div className="p-2.5 rounded-xl border border-border/70 bg-card shadow-2xs flex items-center justify-between text-xs transition-all hover:border-border">
            <span className="text-muted-foreground text-[11px]">Befehlsmenü</span>
            <kbd className="px-1.5 py-0.5 rounded-md bg-muted/80 border border-border/80 font-mono text-[10px] text-foreground">⌘K</kbd>
          </div>
        </div>

        {onOpenShortcutsModal && (
          <button
            type="button"
            onClick={onOpenShortcutsModal}
            className="mt-6 inline-flex items-center gap-1.5 text-xs text-primary hover:underline cursor-pointer font-medium"
          >
            Alle Tastaturkürzel anzeigen (?)
          </button>
        )}
      </div>
    );
  }

  const senderEmail = detail?.from?.address || summaryMail?.email || "";
  const senderName = detail?.from?.name || summaryMail?.name || senderEmail;
  const subject = detail?.subject || summaryMail?.subject || "(Kein Betreff)";
  const dateStr = detail?.date || summaryMail?.date;
  const isTrashFolder = currentFolder === "trash";

  const threadMails = thread?.mails || (summaryMail ? [summaryMail] : []);
  const isMultiMailThread = threadMails.length > 1;
  const otherThreadMails = threadMails.filter((m) => String(m.id || m.seq) !== String(selectedMailId));

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Top action toolbar */}
      <div className="flex h-[52px] items-center justify-between px-4 sm:px-6 shrink-0 border-b bg-background/80 backdrop-blur-xs">
        <div className="flex items-center gap-1">
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onArchive && selectedMailId && onArchive(selectedMailId)}
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 cursor-pointer"
              >
                <Archive className="h-4 w-4" />
                <span className="sr-only">Archivieren</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Archivieren (E)</TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 cursor-pointer">
                <ArchiveX className="h-4 w-4" />
                <span className="sr-only">In Spam verschieben</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>In Spam verschieben</TooltipContent>
          </Tooltip>

          {/* Move to Trash / Delete */}
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onMoveToTrash}
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">
                  {isTrashFolder ? "Endgültig löschen" : "In den Papierkorb"}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isTrashFolder ? "Endgültig löschen (Entf)" : "In den Papierkorb (Entf)"}
            </TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="mx-1 h-5" />

          {/* Toggle Read / Unread Status */}
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleRead}
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 cursor-pointer"
              >
                {isRead ? (
                  <MailIcon className="h-4 w-4" />
                ) : (
                  <MailCheck className="h-4 w-4 text-primary" />
                )}
                <span className="sr-only">
                  {isRead ? "Als ungelesen markieren" : "Als gelesen markieren"}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isRead ? "Als ungelesen markieren (U)" : "Als gelesen markieren (U)"}
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center gap-1.5">
          {/* On-demand AI Analysis button for this email */}
          {!aiAnalysis && !aiLoading && (
            <Button
              variant="outline"
              size="sm"
              onClick={onReanalyze}
              className="h-7.5 rounded-lg gap-1.5 text-xs text-foreground hover:text-primary hover:border-primary/40 cursor-pointer mr-1 shadow-2xs"
              title="Diese E-Mail mit KI analysieren"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="hidden sm:inline font-medium">Mit KI analysieren</span>
            </Button>
          )}

          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 cursor-pointer">
                <Reply className="h-4 w-4" />
                <span className="sr-only">Antworten</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Antworten</TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 cursor-pointer">
                <ReplyAll className="h-4 w-4" />
                <span className="sr-only">Allen antworten</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Allen antworten</TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 cursor-pointer">
                <Forward className="h-4 w-4" />
                <span className="sr-only">Weiterleiten</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Weiterleiten</TooltipContent>
          </Tooltip>

          {onOpenShortcutsModal && (
            <>
              <Separator orientation="vertical" className="mx-0.5 h-5" />
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onOpenShortcutsModal}
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 cursor-pointer"
                  >
                    <HelpCircle className="h-4 w-4" />
                    <span className="sr-only">Tastaturkürzel</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Tastaturkürzel (?)</TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
      </div>

      {/* Main Mail content - Always renders shell immediately (optimistic UI) */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* 1. Smart Order / Package Journey Stepper Card (if Order Thread) */}
        {thread?.isOrderThread && thread.orderJourney && (
          <OrderTimelineCard
            orderJourney={thread.orderJourney}
            onSelectMail={(targetId) => onSelectMailInThread && onSelectMailInThread(targetId)}
            activeMailId={selectedMailId}
          />
        )}

        {/* 2. Thread Conversation Stream Switcher (if thread has multiple mails) */}
        {isMultiMailThread && (
          <div className="mx-6 sm:mx-8 my-2 rounded-2xl border border-border/70 bg-muted/20 p-3 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Layers className="h-3.5 w-3.5 text-primary" />
                <span className="font-semibold text-xs">Verlauf dieser Konversation ({threadMails.length} Nachrichten)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowThreadStream(!showThreadStream)}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <span>{showThreadStream ? "Einklappen" : "Ausklappen"}</span>
                {showThreadStream ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            </div>

            {showThreadStream && (
              <div className="flex flex-col gap-1.5 pt-1">
                {threadMails.map((m) => {
                  const mailId = m.id || m.seq;
                  const isCurrent = String(mailId) === String(selectedMailId);
                  return (
                    <div
                      key={mailId}
                      onClick={() => onSelectMailInThread && onSelectMailInThread(mailId)}
                      className={cn(
                        "flex items-center justify-between gap-3 p-2.5 rounded-xl border text-xs transition-all cursor-pointer",
                        isCurrent
                          ? "bg-background border-primary/40 shadow-2xs font-semibold"
                          : "bg-background/60 border-border/70 hover:bg-background text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <SenderAvatar email={m.email || m.from?.address} size="sm" />
                        <div className="min-w-0">
                          <span className="text-foreground truncate block">
                            {m.name || m.from?.name || m.email || "Unbekannt"}
                          </span>
                          <span className="text-[11px] text-muted-foreground truncate block">
                            {m.subject || "(Kein Betreff)"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isCurrent && (
                          <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-medium">
                            Aktuell
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {formatShortDate(m.date)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 3. Unified Article Header: Subject + Sender (Notion Mail & Plain architecture) */}
        <div className="px-6 sm:px-8 pt-6 pb-4 flex flex-col gap-3">
          {/* Subject heading as Primary Title */}
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground leading-snug break-words">
            {subject}
          </h1>

          {/* Sender & Metadata Row */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <SenderAvatar
                name={senderName}
                email={senderEmail}
                size="md"
                shape="circle"
              />

              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-xs sm:text-sm text-foreground truncate">
                    {senderName}
                  </span>
                  <span className="text-xs text-muted-foreground truncate" title={senderEmail}>
                    &lt;{senderEmail}&gt;
                  </span>
                </div>
                {detail?.to && detail.to.length > 0 && (
                  <span className="text-[11px] text-muted-foreground/75 truncate">
                    an {detail.to.map((t) => t.name || t.address).join(", ")}
                  </span>
                )}
              </div>
            </div>

            {dateStr && (
              <div className="text-xs text-muted-foreground whitespace-nowrap tabular-nums font-mono">
                {formatFullDate(dateStr)}
              </div>
            )}
          </div>
        </div>

        {/* 4. AI Insights Card (Collapsible, non-intrusive) */}
        <AiInsightsCard
          analysis={aiAnalysis}
          loading={aiLoading}
          error={aiError}
          onReanalyze={onReanalyze}
          onToggleActionItem={onToggleActionItem}
        />

        {/* Attachments if any */}
        {detail?.attachments && detail.attachments.length > 0 && (
          <div className="mx-6 sm:mx-8 my-2 p-2.5 rounded-xl bg-muted/30 border border-border/60 flex flex-wrap gap-2 items-center text-xs">
            <span className="flex items-center gap-1 font-medium text-muted-foreground text-[11px]">
              <Paperclip className="h-3.5 w-3.5" />
              Anhänge ({detail.attachments.length}):
            </span>
            {detail.attachments.map((att, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 rounded-lg bg-background border border-border/80 px-2 py-0.5 text-xs text-foreground font-mono shadow-2xs"
              >
                {att.filename || `Anhang-${idx + 1}`}
              </span>
            ))}
          </div>
        )}

        {/* Email Body Area */}
        <div className="flex-1 px-6 sm:px-8 py-5 overflow-x-auto text-sm text-foreground leading-relaxed">
          {detail?.html ? (
            <div
              className="prose prose-sm max-w-none dark:prose-invert [&_a]:text-primary [&_a]:underline [&_img]:max-w-full [&_table]:border-collapse"
              dangerouslySetInnerHTML={{
                __html: sanitizeEmailHtml(detail.html),
              }}
            />
          ) : detail?.text ? (
            <pre className="font-sans whitespace-pre-wrap break-words text-sm text-foreground">
              {detail.text}
            </pre>
          ) : loading ? (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span>Nachrichteninhalt wird geladen...</span>
              </div>
              {summaryMail?.snippet && (
                <div className="text-xs text-foreground/80 leading-relaxed font-sans border-l-2 border-primary/40 pl-3 py-1.5 bg-muted/20 rounded-r">
                  {summaryMail.snippet}
                </div>
              )}
              <div className="space-y-2 pt-2">
                <div className="h-3 bg-muted/60 rounded w-5/6 animate-pulse" />
                <div className="h-3 bg-muted/40 rounded w-full animate-pulse" />
                <div className="h-3 bg-muted/50 rounded w-4/6 animate-pulse" />
              </div>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
              <p className="font-semibold">E-Mail konnte nicht geladen werden</p>
              <p className="mt-1 text-muted-foreground">{error}</p>
            </div>
          ) : (
            <p className="italic text-muted-foreground text-xs">Diese E-Mail hat keinen Textinhalt.</p>
          )}
        </div>
      </div>
    </div>
  );
}
