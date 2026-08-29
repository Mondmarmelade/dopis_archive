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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AiInsightsCard } from "./AiInsightsCard";
import { SenderAvatar } from "./SenderAvatar";

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
    return rawHtml;
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

export function MailDisplay({
  selectedMailId,
  summaryMail,
  isRead,
  onToggleRead,
  onMoveToTrash,
  currentFolder = "inbox",
  aiAnalysis,
  aiLoading,
  aiError,
  onReanalyze,
  onToggleActionItem,
}) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const detailCache = useRef({});

  useEffect(() => {
    if (!selectedMailId) {
      setDetail(null);
      setError(null);
      return;
    }

    const cacheKey = `${selectedMailId}_${currentFolder}`;
    if (detailCache.current[cacheKey]) {
      setDetail(detailCache.current[cacheKey]);
      setLoading(false);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(`/api/email?seq=${selectedMailId}&folder=${currentFolder}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load email (${res.status})`);
        }
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          detailCache.current[cacheKey] = data;
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
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <MailIcon className="h-6 w-6 text-muted-foreground/60" />
        </div>
        <h3 className="mt-4 text-sm font-semibold text-foreground">Keine E-Mail ausgewählt</h3>
        <p className="mt-1 text-xs text-muted-foreground max-w-xs">
          Wähle links eine E-Mail aus, um ihren Inhalt und Details anzuzeigen.
        </p>
      </div>
    );
  }

  const senderEmail = detail?.from?.address || summaryMail?.email || "";
  const senderName = detail?.from?.name || summaryMail?.name || senderEmail;
  const subject = detail?.subject || summaryMail?.subject || "(Kein Betreff)";
  const dateStr = detail?.date || summaryMail?.date;
  const isTrashFolder = currentFolder === "trash";

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Top action toolbar */}
      <div className="flex h-[52px] items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-1">
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground cursor-pointer">
                <Archive className="h-4 w-4" />
                <span className="sr-only">Archivieren</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Archivieren</TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground cursor-pointer">
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
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">
                  {isTrashFolder ? "Endgültig löschen" : "In den Papierkorb"}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isTrashFolder ? "Endgültig löschen" : "In den Papierkorb"}
            </TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Toggle Read / Unread Status */}
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleRead}
                className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {isRead ? (
                  <MailIcon className="h-4 w-4" />
                ) : (
                  <MailCheck className="h-4 w-4 text-blue-600" />
                )}
                <span className="sr-only">
                  {isRead ? "Als ungelesen markieren" : "Als gelesen markieren"}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isRead ? "Als ungelesen markieren" : "Als gelesen markieren"}
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
              className="h-8 gap-1.5 text-xs text-foreground hover:text-primary hover:border-primary/40 cursor-pointer mr-1 shadow-2xs"
              title="Diese E-Mail mit KI analysieren"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="hidden sm:inline font-medium">Mit KI analysieren</span>
            </Button>
          )}

          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground cursor-pointer">
                <Reply className="h-4 w-4" />
                <span className="sr-only">Antworten</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Antworten</TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground cursor-pointer">
                <ReplyAll className="h-4 w-4" />
                <span className="sr-only">Allen antworten</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Allen antworten</TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground cursor-pointer">
                <Forward className="h-4 w-4" />
                <span className="sr-only">Weiterleiten</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Weiterleiten</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <Separator />

      {/* Main Mail content */}
      {loading ? (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="mt-3 text-xs">E-Mail-Inhalt wird geladen...</p>
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-destructive">
          <p className="text-sm font-medium">E-Mail konnte nicht geladen werden</p>
          <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-y-auto">
          {/* Header section */}
          <div className="flex items-start gap-4 p-5">
            <SenderAvatar
              name={senderName}
              email={senderEmail}
              size="lg"
            />

            <div className="grid gap-1 flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-sm text-foreground truncate">
                  {senderName}
                </div>
                {dateStr && (
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatFullDate(dateStr)}
                  </div>
                )}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {senderEmail}
              </div>
              {detail?.to && detail.to.length > 0 && (
                <div className="text-xs text-muted-foreground/80 truncate">
                  an {detail.to.map((t) => t.name || t.address).join(", ")}
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Subject heading */}
          <div className="px-5 py-3">
            <h2 className="text-base font-bold tracking-tight text-foreground break-words">
              {subject}
            </h2>
          </div>

          {/* AI Insights Card (Summary, Action Items, Tags) */}
          <AiInsightsCard
            analysis={aiAnalysis}
            loading={aiLoading}
            error={aiError}
            onReanalyze={onReanalyze}
            onToggleActionItem={onToggleActionItem}
          />

          <Separator />

          {/* Attachments if any */}
          {detail?.attachments && detail.attachments.length > 0 && (
            <div className="bg-muted/40 px-5 py-2.5 border-b flex flex-wrap gap-2 items-center text-xs">
              <span className="flex items-center gap-1 font-medium text-muted-foreground">
                <Paperclip className="h-3.5 w-3.5" />
                Anhänge ({detail.attachments.length}):
              </span>
              {detail.attachments.map((att, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 rounded bg-background border px-2 py-0.5 text-xs text-foreground font-mono"
                >
                  {att.filename || `Anhang-${idx + 1}`}
                </span>
              ))}
            </div>
          )}

          {/* Email Body */}
          <div className="flex-1 p-5 overflow-x-auto text-sm text-foreground leading-relaxed">
            {detail?.html ? (
              <div
                className="prose prose-sm max-w-none dark:prose-invert [&_a]:text-blue-600 [&_a]:underline [&_img]:max-w-full [&_table]:border-collapse"
                dangerouslySetInnerHTML={{
                  __html: sanitizeEmailHtml(detail.html),
                }}
              />
            ) : detail?.text ? (
              <pre className="font-sans whitespace-pre-wrap break-words text-sm text-foreground">
                {detail.text}
              </pre>
            ) : (
              <p className="italic text-muted-foreground text-xs">Diese E-Mail hat keinen Textinhalt.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
