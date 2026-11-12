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
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/85 text-primary-foreground font-bold text-sm shadow-xs cursor-pointer">
              D
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p className="font-semibold">Dopis</p>
            <p className="text-xs text-muted-foreground">{accountEmail || "Verbunden"}</p>
          </TooltipContent>
        </Tooltip>
      ) : (
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/85 text-primary-foreground font-bold text-sm shadow-xs">
            D
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background" />
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-semibold tracking-tight leading-none text-foreground truncate">
              Dopis
            </span>
            <span className="text-[11px] text-muted-foreground truncate mt-0.5" title={accountEmail}>
              {accountEmail || "IMAP Postfach"}
            </span>
          </div>
        </div>
      )}

      {!isCollapsed && (
        <a
          href="/logout"
          title="Abmelden"
          className="inline-flex h-7.5 w-7.5 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="sr-only">Abmelden</span>
        </a>
      )}
    </div>
  );
}
