import React from "react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function Nav({ links, isCollapsed }) {
  return (
    <div
      data-collapsed={isCollapsed}
      className="group flex flex-col gap-4 py-2 data-[collapsed=true]:py-2"
    >
      <nav className="grid gap-1 px-2 group-[[data-collapsed=true]]:justify-center group-[[data-collapsed=true]]:px-1.5">
        {links.map((link, index) => {
          const Icon = link.icon;
          const isSelected = link.variant === "default";

          return isCollapsed ? (
            <Tooltip key={index} delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={link.onClick}
                  className={cn(
                    "relative h-9 w-9 rounded-xl flex items-center justify-center transition-all cursor-pointer",
                    isSelected
                      ? "bg-primary/15 text-primary font-semibold shadow-xs"
                      : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {link.dot && (
                    <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                  )}
                  <span className="sr-only">{link.title}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="flex items-center gap-4">
                {link.title}
                {link.label && (
                  <span className="ml-auto text-muted-foreground text-xs">
                    {link.label}
                  </span>
                )}
              </TooltipContent>
            </Tooltip>
          ) : (
            <button
              key={index}
              type="button"
              onClick={link.onClick}
              className={cn(
                "group/btn relative flex items-center h-8.5 px-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer w-full text-left",
                isSelected
                  ? "bg-primary/10 text-primary font-semibold shadow-2xs"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "mr-2.5 h-4 w-4 shrink-0 transition-colors",
                  isSelected ? "text-primary" : "text-muted-foreground group-hover/btn:text-foreground"
                )}
              />
              <span className="truncate flex-1">{link.title}</span>
              {link.label && (
                <span
                  className={cn(
                    "ml-auto text-[11px] tabular-nums font-mono px-2 py-0.5 rounded-full transition-colors",
                    isSelected
                      ? "bg-primary/20 text-primary font-semibold"
                      : "bg-muted/80 text-muted-foreground group-hover/btn:text-foreground"
                  )}
                >
                  {link.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
