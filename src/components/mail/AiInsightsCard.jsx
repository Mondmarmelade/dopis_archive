import React, { useState, useEffect } from "react";
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
  Code2,
  Copy,
  Check,
  Cpu,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAiSettings } from "@/lib/aiCache";

function getCategoryColor(category) {
  switch (category?.toLowerCase()) {
    case "spam":
    case "phishing":
      return "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20";
    case "werbung":
    case "angebote":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20";
    case "rechnung":
    case "finanzen":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20";
    case "dringend":
    case "wichtig":
      return "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20";
    case "newsletter":
      return "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20";
    case "benachrichtigung":
      return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20";
    case "persönlich":
      return "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20";
    case "update":
      return "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20";
    default:
      return "bg-muted text-muted-foreground border-border";
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
  const [showInspector, setShowInspector] = useState(false);
  const [inspectorTab, setInspectorTab] = useState("raw");
  const [copied, setCopied] = useState(false);
  const [devMode, setDevMode] = useState(false);

  useEffect(() => {
    const settings = getAiSettings();
    setDevMode(Boolean(settings.developerMode));
  }, []);

  const handleCopyDebug = (content) => {
    if (!content) return;
    navigator.clipboard.writeText(
      typeof content === "object" ? JSON.stringify(content, null, 2) : String(content)
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="mx-4 my-3 rounded-lg border bg-card p-3 shadow-2xs text-xs">
        <div className="flex items-center gap-2 text-primary font-medium">
          <Sparkles className="h-3.5 w-3.5 animate-spin" />
          <span>KI analysiert E-Mail (Zusammenfassung, Kategorie & To-Dos)...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-4 my-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-destructive font-medium">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>KI-Analyse fehlgeschlagen: {error}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onReanalyze}
            className="h-7 text-xs text-destructive hover:bg-destructive/10 border-destructive/30 cursor-pointer shrink-0"
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

  const { summary = [], category, tags = [], actionItems = [], _debug } = analysis;
  const hasActionItems = actionItems.length > 0;

  return (
    <div className="mx-4 my-3 rounded-lg border bg-card p-3.5 shadow-2xs text-xs space-y-2.5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-foreground mr-1">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>KI-Analyse</span>
          </div>

          {category && (
            <span
              className={cn(
                "inline-flex items-center rounded border px-1.5 py-0.2 text-[10px] font-medium",
                getCategoryColor(category)
              )}
            >
              {category}
            </span>
          )}

          {tags.map((tag, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 rounded bg-muted border px-1.5 py-0.2 text-[10px] text-muted-foreground"
            >
              <Tag className="h-2 w-2" />
              {tag}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Developer Inspector Toggle */}
          {devMode && (
            <Button
              variant={showInspector ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setShowInspector(!showInspector)}
              title="Entwickler-Inspektor umschalten"
              className="h-6.5 text-[11px] px-2 gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <Code2 className="h-3 w-3 text-primary" />
              <span>Inspektor</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={onReanalyze}
            title="KI-Analyse neu durchführen"
            className="h-6.5 w-6.5 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <RefreshCw className="h-3 w-3" />
            <span className="sr-only">Neu analysieren</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Details ausklappen" : "Details einklappen"}
            className="h-6.5 w-6.5 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            {collapsed ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
            <span className="sr-only">Umschalten</span>
          </Button>
        </div>
      </div>

      {/* Body content */}
      {!collapsed && (
        <div className="space-y-3 pt-2 border-t border-border">
          {/* Summary */}
          {summary.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-muted-foreground mb-1">
                Zusammenfassung
              </p>
              <ul className="space-y-1 text-xs text-foreground/90 leading-relaxed list-disc list-inside marker:text-primary">
                {summary.map((item, idx) => (
                  <li key={idx}>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Items */}
          {hasActionItems && (
            <div className="pt-2 border-t border-border">
              <p className="text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                Aufgaben & Handlungsbedarf
              </p>
              <div className="space-y-1">
                {actionItems.map((action, idx) => (
                  <div
                    key={idx}
                    onClick={() => onToggleActionItem && onToggleActionItem(idx)}
                    className={cn(
                      "flex items-start gap-2 rounded-md border p-2 text-xs transition-colors cursor-pointer",
                      action.completed
                        ? "bg-muted/30 text-muted-foreground line-through border-transparent"
                        : "bg-muted/15 border-border hover:bg-muted/40 text-foreground"
                    )}
                  >
                    <button
                      type="button"
                      className="mt-0.5 shrink-0 text-primary hover:opacity-80 cursor-pointer"
                    >
                      {action.completed ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>
                    <span className="flex-1 font-medium">{action.task}</span>
                    {action.due && (
                      <span className="inline-flex items-center gap-1 shrink-0 rounded bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground font-mono">
                        <Clock className="h-2.5 w-2.5" />
                        {action.due}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Developer Inspector Section */}
          {devMode && showInspector && (
            <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950 text-zinc-200 p-3 text-xs font-mono space-y-2.5 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
                  <Code2 className="h-3.5 w-3.5" />
                  <span>Entwickler-Telemetrie</span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    handleCopyDebug(
                      inspectorTab === "raw"
                        ? _debug?.rawOutput || analysis
                        : inspectorTab === "prompt"
                        ? _debug?.anonymizedInput
                        : analysis
                    )
                  }
                  className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-700 cursor-pointer transition-colors"
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  <span>{copied ? "Kopiert!" : "Kopieren"}</span>
                </button>
              </div>

              {/* Telemetry Chips */}
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                {_debug?.durationMs !== undefined && (
                  <span className="inline-flex items-center gap-1 rounded bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 text-zinc-300">
                    <Clock className="h-2.5 w-2.5 text-amber-400" />
                    {_debug.durationMs} ms
                  </span>
                )}

                {_debug?.model && (
                  <span className="inline-flex items-center gap-1 rounded bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 text-zinc-300">
                    <Cpu className="h-2.5 w-2.5 text-blue-400" />
                    {_debug.model}
                  </span>
                )}

                {_debug?.promptTokens !== undefined && (
                  <span className="inline-flex items-center gap-1 rounded bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 text-zinc-300">
                    Tokens: {_debug.promptTokens} in / {_debug.completionTokens} out
                  </span>
                )}

                <span className="inline-flex items-center gap-1 rounded bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 text-emerald-400">
                  <ShieldCheck className="h-2.5 w-2.5" />
                  PII-Schutz aktiv
                </span>
              </div>

              {/* Sub-Tabs */}
              <div className="flex gap-1 border-b border-zinc-800 pb-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => setInspectorTab("raw")}
                  className={cn(
                    "px-2 py-0.5 rounded cursor-pointer transition-colors",
                    inspectorTab === "raw"
                      ? "bg-zinc-800 text-white font-medium"
                      : "text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  Rohdaten (JSON)
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorTab("prompt")}
                  className={cn(
                    "px-2 py-0.5 rounded cursor-pointer transition-colors",
                    inspectorTab === "prompt"
                      ? "bg-zinc-800 text-white font-medium"
                      : "text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  Gesendeter Prompt (Anonymisiert)
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorTab("full")}
                  className={cn(
                    "px-2 py-0.5 rounded cursor-pointer transition-colors",
                    inspectorTab === "full"
                      ? "bg-zinc-800 text-white font-medium"
                      : "text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  Gesamte Analyse
                </button>
              </div>

              {/* Code viewer */}
              <div className="max-h-52 overflow-y-auto rounded bg-zinc-900/90 p-2 text-[10px] leading-relaxed">
                {inspectorTab === "raw" ? (
                  <pre className="whitespace-pre-wrap break-all text-emerald-300">
                    {_debug?.rawOutput || JSON.stringify(analysis, null, 2)}
                  </pre>
                ) : inspectorTab === "prompt" ? (
                  <pre className="whitespace-pre-wrap break-all text-amber-200">
                    {_debug?.anonymizedInput || "(Kein Prompt-Log verfügbar für diesen Cache-Eintrag)"}
                  </pre>
                ) : (
                  <pre className="whitespace-pre-wrap break-all text-blue-300">
                    {JSON.stringify(analysis, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
