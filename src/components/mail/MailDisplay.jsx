import React, { useEffect, useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Configure DOMPurify to automatically open all email links in a new window/tab safely
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A" && node.hasAttribute("href")) {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

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

function getSenderDomain(email) {
  if (!email || typeof email !== "string" || !email.includes("@")) return "";
  return email.split("@")[1].toLowerCase();
}

function getInitials(name, email) {
  if (name && name.trim().length > 0) {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email && email.length > 0) {
    return email.slice(0, 2).toUpperCase();
  }
  return "M";
}

export function MailDisplay({
  selectedMailId,
  summaryMail,
  isRead,
  onToggleRead,
  onMoveToTrash,
  currentFolder = "inbox",
}) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!selectedMailId) {
      setDetail(null);
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
        <h3 className="mt-4 text-sm font-semibold text-foreground">No message selected</h3>
        <p className="mt-1 text-xs text-muted-foreground max-w-xs">
          Select an email from your mailbox on the left to read its full content and view details.
        </p>
      </div>
    );
  }

  const senderEmail = detail?.from?.address || summaryMail?.email || "";
  const senderName = detail?.from?.name || summaryMail?.name || senderEmail;
  const domain = getSenderDomain(senderEmail);
  const initials = getInitials(senderName, senderEmail);
  const subject = detail?.subject || summaryMail?.subject || "(No Subject)";
  const dateStr = detail?.date || summaryMail?.date;
  const isTrashFolder = currentFolder === "trash";

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Top action toolbar */}
      <div className="flex h-[52px] items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-1">
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <Archive className="h-4 w-4" />
                <span className="sr-only">Archive</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Archive</TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <ArchiveX className="h-4 w-4" />
                <span className="sr-only">Move to junk</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Move to junk</TooltipContent>
          </Tooltip>

          {/* Move to Trash / Delete */}
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onMoveToTrash}
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">
                  {isTrashFolder ? "Delete permanently" : "Move to trash"}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isTrashFolder ? "Delete permanently" : "Move to trash"}
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
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                {isRead ? (
                  <MailIcon className="h-4 w-4" />
                ) : (
                  <MailCheck className="h-4 w-4 text-blue-600" />
                )}
                <span className="sr-only">
                  {isRead ? "Mark as unread" : "Mark as read"}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isRead ? "Mark as unread" : "Mark as read"}
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center gap-1">
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <Reply className="h-4 w-4" />
                <span className="sr-only">Reply</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reply</TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <ReplyAll className="h-4 w-4" />
                <span className="sr-only">Reply all</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reply all</TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <Forward className="h-4 w-4" />
                <span className="sr-only">Forward</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Forward</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <Separator />

      {/* Main Mail content */}
      {loading ? (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="mt-3 text-xs">Loading email content...</p>
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-destructive">
          <p className="text-sm font-medium">Failed to load message</p>
          <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-y-auto">
          {/* Header section */}
          <div className="flex items-start gap-4 p-5">
            {domain ? (
              <img
                src={`https://logo.clearbit.com/${domain}`}
                alt=""
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
                className="h-10 w-10 rounded-full object-cover shrink-0 bg-muted border"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {initials}
              </div>
            )}

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
                  to {detail.to.map((t) => t.name || t.address).join(", ")}
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

          <Separator />

          {/* Attachments if any */}
          {detail?.attachments && detail.attachments.length > 0 && (
            <div className="bg-muted/40 px-5 py-2.5 border-b flex flex-wrap gap-2 items-center text-xs">
              <span className="flex items-center gap-1 font-medium text-muted-foreground">
                <Paperclip className="h-3.5 w-3.5" />
                Attachments ({detail.attachments.length}):
              </span>
              {detail.attachments.map((att, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 rounded bg-background border px-2 py-0.5 text-xs text-foreground font-mono"
                >
                  {att.filename || `attachment-${idx + 1}`}
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
                  __html: DOMPurify.sanitize(detail.html, {
                    ADD_ATTR: ["target", "rel"],
                  }),
                }}
              />
            ) : detail?.text ? (
              <pre className="font-sans whitespace-pre-wrap break-words text-sm text-foreground">
                {detail.text}
              </pre>
            ) : (
              <p className="italic text-muted-foreground text-xs">This email has no text content.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
