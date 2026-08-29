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
      <nav className="grid gap-1 px-2 group-[[data-collapsed=true]]:justify-center group-[[data-collapsed=true]]:px-2">
        {links.map((link, index) => {
          const Icon = link.icon;
          return isCollapsed ? (
            <Tooltip key={index} delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={link.onClick}
                  className={cn(
                    buttonVariants({ variant: link.variant, size: "icon" }),
                    "relative h-9 w-9 cursor-pointer",
                    link.variant === "default" &&
                      "dark:bg-muted dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-white"
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
                buttonVariants({ variant: link.variant, size: "sm" }),
                link.variant === "default" &&
                  "dark:bg-muted dark:text-white dark:hover:bg-muted dark:hover:text-white",
                "justify-start w-full cursor-pointer"
              )}
            >
              <Icon className="mr-2 h-4 w-4 shrink-0" />
              <span className="truncate">{link.title}</span>
              {link.label && (
                <span
                  className={cn(
                    "ml-auto text-xs",
                    link.variant === "default"
                      ? "text-background dark:text-white"
                      : "text-muted-foreground"
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
