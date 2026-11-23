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
  AlertTriangle,
  Code2,
  Copy,
  Check,
  Cpu,
  ShieldCheck,
  KeyRound,
  FileText,
  Receipt,
  Package,
  Calendar,
  MapPin,
  Hash,
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

const EXTRACTED_FIELD_LABELS = {
  merchant: { label: "Händler / Absender", icon: Package },
  paid_to: { label: "Empfänger", icon: Receipt },
  payment_provider: { label: "Zahlungsdienst", icon: Receipt },
  invoice_number: { label: "Rechnungsnr.", icon: Hash },
  order_id: { label: "Bestellnr.", icon: Hash },
  tracking_number: { label: "Sendungsnr.", icon: Package },
  carrier: { label: "Paketdienst", icon: Package },
  total_amount: { label: "Betrag", icon: Receipt },
  payment_amount: { label: "Zahlbetrag", icon: Receipt },
  due_date: { label: "Fällig am", icon: Calendar },
  estimated_delivery: { label: "Lieferung ca.", icon: Calendar },
  event_date: { label: "Termin", icon: Calendar },
  venue: { label: "Ort / Strecke", icon: MapPin },
  delivery_location: { label: "Zustellort", icon: MapPin },
  transaction_id: { label: "Transaktions-ID", icon: Hash },
  action_deadline: { label: "Frist", icon: Clock },
};

export function AiInsightsCard({
  analysis,
  loading,
  error,
  onReanalyze,
  onRequestTextSummary,
  onToggleActionItem,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [inspectorTab, setInspectorTab] = useState("decisions");
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [devMode, setDevMode] = useState(false);
  const [summaryEnabled, setSummaryEnabled] = useState(false);

  useEffect(() => {
    const settings = getAiSettings();
    setDevMode(Boolean(settings.developerMode));
    setSummaryEnabled(Boolean(settings.summaryEnabled));
  }, []);

  const handleCopyDebug = (content) => {
    if (!content) return;
    navigator.clipboard.writeText(
      typeof content === "object" ? JSON.stringify(content, null, 2) : String(content)
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCode = (code) => {
    if (!code) return;
    navigator.clipboard.writeText(String(code));
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (loading) {
    return (
      <div className="mx-6 sm:mx-8 my-2.5 rounded-xl border border-primary/20 bg-primary/5 p-2.5 shadow-2xs text-xs animate-in fade-in duration-150">
        <div className="flex items-center gap-2 text-primary font-medium">
          <Sparkles className="h-3.5 w-3.5 animate-spin" />
          <span className="text-[11px]">
            Schritt 1: Einordnung (Clef) &amp; Schritt 2: Datenauslesung (Clairic) laufen...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-6 sm:mx-8 my-2.5 rounded-xl border border-destructive/25 bg-destructive/5 p-2.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-destructive font-medium">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[11px]">KI-Analyse: {error}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onReanalyze}
            className="h-6 text-[10px] text-destructive hover:bg-destructive/10 cursor-pointer shrink-0"
          >
            <RefreshCw className="mr-1 h-2.5 w-2.5" />
            Wiederholen
          </Button>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  const {
    summary = [],
    category,
    categoryConfidence,
    tags = [],
    actionItems = [],
    verificationCode,
    extractedFields = {},
    attachmentsAnalyzed,
    pipeline,
    _debug,
  } = analysis;

  const hasActionItems = actionItems.length > 0;
  const confidencePct =
    typeof categoryConfidence === "number" ? Math.round(categoryConfidence * 100) : null;

  // Build visible Clairic field cards (only non-null values, merging currency into amount)
  const currencyVal = extractedFields.currency?.value || extractedFields.payment_currency?.value || "";
  const visibleFields = Object.entries(extractedFields || {})
    .filter(([key, meta]) => {
      if (!meta || meta.value === null || meta.value === undefined || meta.value === "") return false;
      if (key === "currency" || key === "payment_currency" || key === "verification_code" || key === "product_summary") {
        return false;
      }
      if (key === "paid_to" && extractedFields.merchant?.value) return false;
      if (key === "payment_amount" && extractedFields.total_amount?.value) return false;
      return Boolean(EXTRACTED_FIELD_LABELS[key]);
    })
    .map(([key, meta]) => {
      const def = EXTRACTED_FIELD_LABELS[key];
      let displayVal = String(meta.value);
      if ((key === "total_amount" || key === "payment_amount") && typeof meta.value === "number") {
        displayVal = `${meta.value.toFixed(2).replace(".", ",")} ${currencyVal || "EUR"}`;
      }
      return {
        key,
        label: def.label,
        Icon: def.icon,
        value: displayVal,
        confidence: typeof meta.confidence === "number" ? Math.round(meta.confidence * 100) : null,
        uncertain: Boolean(meta.uncertain),
        excerpt: meta.excerpt || null,
        source: meta.source || "text",
      };
    });

  return (
    <div className="mx-6 sm:mx-8 my-2 rounded-xl border border-border/80 bg-gradient-to-b from-card to-muted/20 p-3 shadow-2xs text-xs space-y-2.5 transition-all">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1.5 font-medium text-foreground mr-1">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold">KI-Einordnung</span>
          </div>

          {category && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium shadow-2xs",
                getCategoryColor(category)
              )}
              title={
                confidencePct !== null
                  ? `Kategorie-Sicherheit (Clef): ${confidencePct} %`
                  : undefined
              }
            >
              <span>{category}</span>
              {confidencePct !== null && (
                <span className="opacity-75 font-mono">· {confidencePct}%</span>
              )}
            </span>
          )}

          {attachmentsAnalyzed &&
            (attachmentsAnalyzed.pdfCount > 0 || attachmentsAnalyzed.imageCount > 0) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-medium">
                <FileText className="h-2.5 w-2.5" />
                {attachmentsAnalyzed.pdfCount > 0
                  ? `${attachmentsAnalyzed.pdfCount} PDF ausgelesen`
                  : `${attachmentsAnalyzed.imageCount} Bild ausgelesen`}
              </span>
            )}

          {tags.map((tag, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 rounded-full bg-muted/80 border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              <Tag className="h-2 w-2" />
              {tag}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {summaryEnabled && onRequestTextSummary && !pipeline?.summaryUsed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRequestTextSummary}
              title="Ausführlichere Text-Zusammenfassung über das optionale Sprachmodell anfordern"
              className="h-6.5 text-[10px] px-2 gap-1 text-muted-foreground hover:text-primary cursor-pointer"
            >
              <FileText className="h-3 w-3" />
              <span>Text-Zusammenfassung</span>
            </Button>
          )}

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
          {/* 1-Click 2FA / Verification Code Banner */}
          {verificationCode?.value && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <KeyRound className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-medium text-blue-700 dark:text-blue-300">
                    Erkannter Bestätigungs- / 2FA-Code
                  </p>
                  <p className="font-mono text-sm font-bold tracking-wider text-foreground">
                    {verificationCode.value}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleCopyCode(verificationCode.value)}
                className="h-7 text-[11px] gap-1 shrink-0 cursor-pointer"
              >
                {copiedCode ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-500" />
                    Kopiert
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Code kopieren
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Structured Overview / Summary */}
          {summary.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-muted-foreground mb-1">
                {pipeline?.summaryUsed ? "Text-Zusammenfassung" : "Kurzübersicht"}
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

          {/* Clairic Typed Extraction Cards */}
          {visibleFields.length > 0 && (
            <div className="pt-2 border-t border-border">
              <p className="text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center justify-between">
                <span>Ausgelesene Daten (Schritt 2)</span>
                {pipeline?.extractorModel && (
                  <span className="font-mono text-[10px] opacity-75">{pipeline.extractorModel}</span>
                )}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                {visibleFields.map((field) => {
                  const Icon = field.Icon;
                  return (
                    <div
                      key={field.key}
                      title={
                        field.excerpt
                          ? `Fundstelle: "${field.excerpt}"`
                          : field.confidence !== null
                          ? `Sicherheit: ${field.confidence}%`
                          : undefined
                      }
                      className={cn(
                        "rounded-lg border px-2.5 py-1.5 bg-background/70 flex flex-col gap-0.5",
                        field.uncertain
                          ? "border-amber-500/40 bg-amber-500/5"
                          : "border-border/70"
                      )}
                    >
                      <div className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1 truncate">
                          <Icon className="h-2.5 w-2.5 shrink-0" />
                          {field.label}
                        </span>
                        {field.uncertain ? (
                          <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-medium shrink-0">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            prüfen
                          </span>
                        ) : field.confidence !== null ? (
                          <span className="font-mono opacity-70 shrink-0">{field.confidence}%</span>
                        ) : null}
                      </div>
                      <span className="text-xs font-semibold text-foreground truncate">
                        {field.value}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Items */}
          {hasActionItems && (
            <div className="pt-2 border-t border-border">
              <p className="text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                Aufgaben &amp; Handlungsbedarf
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
                  <span>System-One Entwickler-Telemetrie</span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    handleCopyDebug(
                      inspectorTab === "decisions"
                        ? _debug?.decisions || analysis
                        : inspectorTab === "extractions"
                        ? _debug?.extractions || extractedFields
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
                    Gesamt: {_debug.durationMs} ms
                  </span>
                )}
                {_debug?.stages?.decider?.durationMs !== undefined && (
                  <span className="inline-flex items-center gap-1 rounded bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 text-purple-300">
                    <Cpu className="h-2.5 w-2.5" />
                    Schritt 1: {_debug.stages.decider.durationMs} ms ({_debug.stages.decider.model})
                  </span>
                )}
                {_debug?.stages?.extractor && (
                  <span className="inline-flex items-center gap-1 rounded bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 text-blue-300">
                    <Cpu className="h-2.5 w-2.5" />
                    Schritt 2:{" "}
                    {_debug.stages.extractor.skipped
                      ? "übersprungen (gespart)"
                      : `${_debug.stages.extractor.durationMs} ms (${_debug.stages.extractor.model})`}
                  </span>
                )}
                {_debug?.promptTokens !== undefined && (
                  <span className="inline-flex items-center gap-1 rounded bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 text-zinc-300">
                    Tokens: {_debug.promptTokens} in / {_debug.completionTokens || 0} out
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
                  onClick={() => setInspectorTab("decisions")}
                  className={cn(
                    "px-2 py-0.5 rounded cursor-pointer transition-colors",
                    inspectorTab === "decisions"
                      ? "bg-zinc-800 text-white font-medium"
                      : "text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  Schritt 1 (Clef)
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorTab("extractions")}
                  className={cn(
                    "px-2 py-0.5 rounded cursor-pointer transition-colors",
                    inspectorTab === "extractions"
                      ? "bg-zinc-800 text-white font-medium"
                      : "text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  Schritt 2 (Clairic)
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
                  Gesamtergebnis
                </button>
              </div>

              {/* Code viewer */}
              <div className="max-h-52 overflow-y-auto rounded bg-zinc-900/90 p-2 text-[10px] leading-relaxed">
                {inspectorTab === "decisions" ? (
                  <pre className="whitespace-pre-wrap break-all text-purple-300">
                    {JSON.stringify(_debug?.decisions || analysis.categoryProbabilities || {}, null, 2)}
                  </pre>
                ) : inspectorTab === "extractions" ? (
                  <pre className="whitespace-pre-wrap break-all text-emerald-300">
                    {JSON.stringify(_debug?.extractions || extractedFields || {}, null, 2)}
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
