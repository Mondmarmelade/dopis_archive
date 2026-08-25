import React from "react";
import { LogOut, User, Mail as MailIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function AccountSwitcher({ isCollapsed, accountEmail }) {
  return (
    <div
      className={cn(
        "flex h-[52px] items-center justify-between px-3 w-full",
        isCollapsed && "h-[52px] justify-center px-2"
      )}
    >
      {isCollapsed ? (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MailIcon className="h-5 w-5" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p className="font-semibold">Dopis</p>
            <p className="text-xs text-muted-foreground">{accountEmail || "Connected"}</p>
          </TooltipContent>
        </Tooltip>
      ) : (
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            D
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-semibold tracking-tight leading-none truncate">
              Dopis
            </span>
            <span className="text-xs text-muted-foreground truncate mt-0.5" title={accountEmail}>
              {accountEmail || "IMAP Mailbox"}
            </span>
          </div>
        </div>
      )}

      {!isCollapsed && (
        <a
          href="/logout"
          title="Logout"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span className="sr-only">Logout</span>
        </a>
      )}
    </div>
  );
}
