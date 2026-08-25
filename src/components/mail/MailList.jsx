import React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

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

export function MailList({ items, selectedMailId, onSelectMail }) {
  if (!items || items.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <p className="text-sm font-medium">No messages found</p>
        <p className="text-xs text-muted-foreground/75 mt-1">Your mailbox or search filter returned no results.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4 pt-0">
      {items.map((item) => {
        const isSelected = String(item.id) === String(selectedMailId);
        const domain = getSenderDomain(item.email);
        const initials = getInitials(item.name, item.email);

        return (
          <button
            key={item.id || item.seq}
            type="button"
            onClick={() => onSelectMail(item.id || item.seq)}
            className={cn(
              "flex flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm transition-all cursor-pointer hover:bg-accent/60",
              isSelected && "bg-muted border-primary/30 shadow-xs",
              !item.read && "font-medium"
            )}
          >
            <div className="flex w-full items-center justify-between gap-2">
              <div className="flex items-center gap-2 overflow-hidden">
                {domain ? (
                  <img
                    src={`https://logo.clearbit.com/${domain}`}
                    alt=""
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                    className="h-5 w-5 rounded-full object-cover shrink-0 bg-muted"
                  />
                ) : (
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                    {initials}
                  </div>
                )}
                <span className="truncate text-xs font-semibold text-foreground">
                  {item.name || item.email}
                </span>
                {!item.read && (
                  <span className="flex h-2 w-2 rounded-full bg-blue-600 shrink-0" title="Unread" />
                )}
              </div>
              <span
                className={cn(
                  "text-[11px] whitespace-nowrap",
                  isSelected ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {formatDate(item.date)}
              </span>
            </div>

            <div className="w-full text-xs font-medium text-foreground truncate">
              {item.subject || "(No Subject)"}
            </div>

            {item.envelope?.to && item.envelope.to.length > 0 && (
              <div className="line-clamp-1 text-[11px] text-muted-foreground">
                To: {item.envelope.to.map((t) => t.name || t.address).join(", ")}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
