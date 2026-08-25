import React, { useState } from "react";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  Clock,
  RefreshCw,
  Tag,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function getCategoryColor(category) {
  switch (category?.toLowerCase()) {
    case "spam":
    case "phishing":
      return "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20";
    case "werbung":
    case "angebote":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20";
    case "rechnung":
    case "finanzen":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20";
    case "dringend":
    case "wichtig":
      return "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20";
    case "newsletter":
      return "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20";
    case "benachrichtigung":
      return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20";
    case "persönlich":
      return "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20";
    case "update":
      return "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20";
    default:
      return "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/20";
  }
}

export function AiInsightsCard({
  analysis,
  loading,
  error,
  onReanalyze,
  onToggleActionItem,
}) {
  const [collapsed, setCollapsed] = useState(false);

  if (loading) {
    return (
      <div className="mx-5 my-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm animate-pulse">
        <div className="flex items-center gap-2 text-primary font-medium">
          <Sparkles className="h-4 w-4 animate-spin" />
          <span>KI analysiert E-Mail (Zusammenfassung, Kategorie & To-Dos)...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-5 my-4 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-destructive font-medium">
            <AlertCircle className="h-4 w-4" />
            <span>KI-Analyse fehlgeschlagen: {error}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onReanalyze}
            className="h-7 text-xs text-destructive hover:bg-destructive/10"
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            Erneut versuchen
          </Button>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  const { summary = [], category, tags = [], actionItems = [] } = analysis;
  const hasActionItems = actionItems.length > 0;

  return (
    <div className="mx-5 my-4 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/5 p-4 shadow-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            AI Insights
          </span>

          {category && (
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
                getCategoryColor(category)
              )}
            >
              {category}
            </span>
          )}

          {tags.map((tag, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 rounded-full bg-muted border px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              <Tag className="h-2.5 w-2.5" />
              {tag}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onReanalyze}
            title="KI-Analyse neu durchführen"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="h-3 w-3" />
            <span className="sr-only">Neu analysieren</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Details ausklappen" : "Details einklappen"}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
          >
            {collapsed ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
            <span className="sr-only">Toggle collapse</span>
          </Button>
        </div>
      </div>

      {/* Body content */}
      {!collapsed && (
        <div className="mt-3.5 space-y-3 pt-2 border-t border-primary/10">
          {/* Summary */}
          {summary.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Kernpunkte (TL;DR)
              </p>
              <ul className="list-disc list-inside space-y-1 text-xs text-foreground leading-relaxed">
                {summary.map((item, idx) => (
                  <li key={idx} className="marker:text-primary">
                    <span className="text-foreground/90">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Items */}
          {hasActionItems && (
            <div className="pt-2 border-t border-primary/10">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                Handlungsaufforderungen / To-Dos
              </p>
              <div className="space-y-1.5">
                {actionItems.map((action, idx) => (
                  <div
                    key={idx}
                    onClick={() => onToggleActionItem && onToggleActionItem(idx)}
                    className={cn(
                      "flex items-start gap-2 rounded-lg border p-2 text-xs transition-colors cursor-pointer hover:bg-accent/50",
                      action.completed
                        ? "bg-muted/40 text-muted-foreground line-through border-transparent"
                        : "bg-background border-border text-foreground"
                    )}
                  >
                    <button
                      type="button"
                      className="mt-0.5 shrink-0 text-primary hover:opacity-80"
                    >
                      {action.completed ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>
                    <span className="flex-1 font-medium">{action.task}</span>
                    {action.due && (
                      <span className="inline-flex items-center gap-1 shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono">
                        <Clock className="h-2.5 w-2.5" />
                        {action.due}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
