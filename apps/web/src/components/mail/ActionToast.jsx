import React, { useEffect } from "react";
import { Undo2, X, CheckCircle2, Archive, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ActionToast({ toast, onUndo, onDismiss }) {
  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      onDismiss?.();
    }, 5000);

    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const Icon =
    toast.type === "archive"
      ? Archive
      : toast.type === "trash"
      ? Trash2
      : CheckCircle2;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-foreground text-background shadow-2xl border border-border/40 select-none">
        <div className="flex items-center gap-2 text-xs font-medium">
          <Icon className="w-4 h-4 text-primary shrink-0" />
          <span className="max-w-[280px] sm:max-w-md truncate">{toast.message}</span>
        </div>

        {onUndo && toast.canUndo && (
          <>
            <div className="h-3.5 w-px bg-background/25" />
            <button
              type="button"
              onClick={onUndo}
              className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline cursor-pointer tracking-wide uppercase transition-colors"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Rückgängig
            </button>
          </>
        )}

        <button
          type="button"
          onClick={onDismiss}
          className="ml-1 text-background/60 hover:text-background cursor-pointer rounded-full p-0.5 transition-colors"
          title="Schließen"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
