import React, { useState, useEffect } from "react";
import { Sparkles, X, ChevronRight, Keyboard } from "lucide-react";

export function QuickTipsBar({ onOpenShortcuts }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isDismissed = localStorage.getItem("dopis_dismissed_quick_tips");
      if (!isDismissed) {
        setIsVisible(true);
      }
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("dopis_dismissed_quick_tips", "true");
    }
  };

  if (!isVisible) return null;

  return (
    <div className="mx-3 my-1.5 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/60 flex items-center justify-between gap-2 text-xs transition-all">
      <div className="flex items-center gap-2 min-w-0">
        <Sparkles className="w-3 h-3 text-primary shrink-0" />
        <p className="text-muted-foreground text-[11px] leading-tight truncate">
          <span className="font-medium text-foreground">Tipp:</span> Navigiere mit{" "}
          <kbd className="px-1 py-0.2 bg-background border rounded font-mono text-[9px] text-foreground">J</kbd>/
          <kbd className="px-1 py-0.2 bg-background border rounded font-mono text-[9px] text-foreground">K</kbd>,
          archiviere mit{" "}
          <kbd className="px-1 py-0.2 bg-background border rounded font-mono text-[9px] text-foreground">E</kbd>{" "}
          und drücke{" "}
          <kbd className="px-1 py-0.2 bg-background border rounded font-mono text-[9px] text-foreground">⌘K</kbd>.
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onOpenShortcuts}
          className="text-[11px] font-medium text-primary hover:underline cursor-pointer"
        >
          Kürzel
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="p-0.5 text-muted-foreground hover:text-foreground cursor-pointer rounded transition-colors ml-0.5"
          title="Ausblenden"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
