import React, { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  Cpu,
  ShieldCheck,
  ShieldAlert,
  Search,
  Check,
  AlertTriangle,
  ListChecks,
  History,
  Layers,
  ArrowLeft,
  Mail as MailIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAiQueue } from "@/lib/aiQueue";
import { getAiSettings, getCachedAnalysis } from "@/lib/aiCache";
import { SenderAvatar } from "./SenderAvatar";

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

export function AiActivityView({ currentFolder = "inbox", folderMails = [], onBack }) {
  const {
    status,
    queue,
    currentItem,
    activityLog,
    stats,
    errorMessage,
    batchTotal = 0,
    batchCompleted = 0,
    lastBatchSummary = null,
    enqueue,
    start,
    pause,
    resume,
    clearQueue,
    removeQueueItem,
    clearHistory,
    retryFailed,
    retryItem,
  } = useAiQueue();

  const [activeTab, setActiveTab] = useState("picker"); // "picker" | "queue" | "activity"
  const [selectedMailIds, setSelectedMailIds] = useState(new Set());
  const [pickerFilter, setPickerFilter] = useState("unanalyzed"); // "all" | "unanalyzed" | "unread" | "analyzed"
  const [pickerSearch, setPickerSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all"); // "all" | "success" | "error"
  const [searchFilter, setSearchFilter] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [aiSettings, setAiSettings] = useState(() => getAiSettings());

  useEffect(() => {
    setAiSettings(getAiSettings());
  }, []);

  // Timer for active item duration
  useEffect(() => {
    let interval = null;
    if (currentItem && currentItem.startedAt) {
      interval = setInterval(() => {
        setElapsedSeconds(Math.max(0, Math.floor((Date.now() - currentItem.startedAt) / 1000)));
      }, 500);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentItem]);

  // Derived state
  const isRunning = status === "running" || Boolean(currentItem);
  const isPaused = status === "paused";
  const isBatchActive = isRunning || queue.length > 0 || isPaused || Boolean(currentItem);
  const effectiveBatchTotal = Math.max(batchTotal, batchCompleted + queue.length + (currentItem ? 1 : 0), 1);
  const currentBatchNumber = Math.min(batchCompleted + (currentItem ? 1 : 0), effectiveBatchTotal);
  const batchPercent = isBatchActive
    ? Math.min(100, Math.round((batchCompleted / effectiveBatchTotal) * 100))
    : (lastBatchSummary ? 100 : 0);

  const totalProcessed = stats.successCount + stats.errorCount;
  const successRate =
    totalProcessed > 0 ? Math.round((stats.successCount / totalProcessed) * 100) : 100;
  const avgLatency =
    stats.totalAnalyzed > 0 ? Math.round(stats.totalLatencyMs / stats.totalAnalyzed) : 0;

  // Folder Mail Preparation for Picker (strictly in visual order from top to bottom)
  const pickerMails = useMemo(() => {
    return folderMails.map((mail, index) => {
      const id = mail.id || mail.seq;
      const cached = getCachedAnalysis(id);
      const isCurrent = currentItem && String(currentItem.id) === String(id);
      const isQueued = queue.some((q) => String(q.id) === String(id));
      const lastLog = activityLog.find((a) => String(a.mailId) === String(id));
      const isError = lastLog && lastLog.status === "error" && !cached;

      let aiStatus = "unanalyzed";
      if (isCurrent) aiStatus = "analyzing";
      else if (isQueued) aiStatus = "queued";
      else if (cached) aiStatus = "analyzed";
      else if (isError) aiStatus = "error";

      return {
        ...mail,
        indexNumber: index + 1,
        id,
        cached,
        aiStatus,
        category: cached?.category || mail.category,
        tags: cached?.tags || mail.tags || [],
      };
    });
  }, [folderMails, currentItem, queue, activityLog]);

  // Filtered Picker Mails
  const filteredPickerMails = useMemo(() => {
    return pickerMails.filter((mail) => {
      if (pickerFilter === "unanalyzed" && mail.aiStatus === "analyzed") return false;
      if (pickerFilter === "unread" && mail.read) return false;
      if (pickerFilter === "analyzed" && mail.aiStatus !== "analyzed") return false;

      if (pickerSearch.trim()) {
        const q = pickerSearch.toLowerCase();
        const matchSubject = mail.subject?.toLowerCase().includes(q);
        const matchName = mail.name?.toLowerCase().includes(q);
        const matchEmail = mail.email?.toLowerCase().includes(q);
        const matchCategory = mail.category?.toLowerCase().includes(q);
        return matchSubject || matchName || matchEmail || matchCategory;
      }
      return true;
    });
  }, [pickerMails, pickerFilter, pickerSearch]);

  const unanalyzedCount = useMemo(
    () => pickerMails.filter((m) => m.aiStatus !== "analyzed").length,
    [pickerMails]
  );

  // Checkbox handlers
  const handleToggleSelect = (id) => {
    setSelectedMailIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    if (selectedMailIds.size === filteredPickerMails.length) {
      setSelectedMailIds(new Set());
    } else {
      setSelectedMailIds(new Set(filteredPickerMails.map((m) => m.id)));
    }
  };

  const handleQuickSelect = (count) => {
    const unanalyzed = pickerMails.filter(
      (m) => m.aiStatus !== "analyzed" && m.aiStatus !== "queued" && m.aiStatus !== "analyzing"
    );
    const slice = unanalyzed.slice(0, count);
    const next = new Set(slice.map((m) => m.id));
    setSelectedMailIds(next);
  };

  const handleClearSelection = () => {
    setSelectedMailIds(new Set());
  };

  // Enqueue selected emails strictly in top-to-bottom order (force: true allows re-analyzing)
  const handleAnalyzeSelected = () => {
    if (selectedMailIds.size === 0) return;

    // Filter folderMails keeping strict top-to-bottom visual order
    const toEnqueue = folderMails.filter((m) => selectedMailIds.has(m.id || m.seq));
    if (toEnqueue.length > 0) {
      enqueue(toEnqueue, { force: true, folder: currentFolder });
      setSelectedMailIds(new Set());
    }
  };

  // Analyze single email on demand
  const handleAnalyzeSingle = (mail) => {
    enqueue([mail], { force: true, folder: currentFolder, prepend: true });
  };

  // Filtered Activity Log
  const filteredActivity = activityLog.filter((entry) => {
    if (filterStatus === "success" && entry.status !== "success") return false;
    if (filterStatus === "error" && entry.status !== "error") return false;
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      const matchSubject = entry.subject?.toLowerCase().includes(q);
      const matchSender = entry.sender?.toLowerCase().includes(q);
      const matchCategory = entry.category?.toLowerCase().includes(q);
      return matchSubject || matchSender || matchCategory;
    }
    return true;
  });

  const failedCount = activityLog.filter((e) => e.status === "error").length;

  return (
    <div className="flex h-full flex-col bg-background text-foreground overflow-hidden">
      {/* 1. Header (Crisp & Minimal) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b px-6 py-3.5 shrink-0 bg-card">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer -ml-1"
              title="Zurück"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex items-center gap-2.5">
            <h1 className="text-base font-semibold tracking-tight">KI-Aktivität</h1>
            {isRunning ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Aktiv
              </span>
            ) : isPaused ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                <Pause className="h-2.5 w-2.5" />
                Pausiert
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                Bereit
              </span>
            )}
          </div>
        </div>

        {/* Global Action Controls */}
        <div className="flex items-center gap-2">
          {isRunning ? (
            <Button
              variant="outline"
              size="sm"
              onClick={pause}
              className="h-8 text-xs gap-1.5 cursor-pointer font-medium"
            >
              <Pause className="h-3.5 w-3.5" />
              Pausieren
            </Button>
          ) : isPaused ? (
            <Button
              variant="default"
              size="sm"
              onClick={resume}
              className="h-8 text-xs gap-1.5 cursor-pointer font-medium"
            >
              <Play className="h-3.5 w-3.5" />
              Fortsetzen
            </Button>
          ) : null}

          {failedCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={retryFailed}
              className="h-8 text-xs gap-1.5 text-destructive hover:bg-destructive/10 border-destructive/30 cursor-pointer font-medium"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Fehler ({failedCount})
            </Button>
          )}

          {queue.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearQueue}
              className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-destructive cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Leeren
            </Button>
          )}
        </div>
      </div>

      {/* Main Scrollable Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Error Alert Banner if Fatal */}
        {errorMessage && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3.5 text-xs text-destructive flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={resume}
              className="h-7 text-xs bg-background text-destructive hover:bg-destructive/10 border-destructive/30 shrink-0 cursor-pointer"
            >
              Erneut versuchen
            </Button>
          </div>
        )}

        {/* 2. Unified KPI Metric Bar (Revolut / shadcn Clean Style) */}
        <div className="grid grid-cols-2 md:grid-cols-4 rounded-lg border bg-card divide-y md:divide-y-0 md:divide-x shadow-2xs">
          {/* Metric 1: Analyzed */}
          <div className="p-3.5 sm:p-4">
            <span className="text-[11px] font-medium text-muted-foreground">Heute analysiert</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-bold tracking-tight text-foreground">
                {stats.todayAnalyzed}
              </span>
              <span className="text-xs text-muted-foreground">/ {stats.totalAnalyzed} gesamt</span>
            </div>
          </div>

          {/* Metric 2: Success Rate */}
          <div className="p-3.5 sm:p-4">
            <span className="text-[11px] font-medium text-muted-foreground">Erfolgsquote</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-bold tracking-tight text-foreground">
                {successRate}%
              </span>
              <span className="text-xs text-muted-foreground">
                ({stats.successCount} OK{stats.errorCount > 0 ? `, ${stats.errorCount} Fehler` : ""})
              </span>
            </div>
          </div>

          {/* Metric 3: Avg Latency */}
          <div className="p-3.5 sm:p-4">
            <span className="text-[11px] font-medium text-muted-foreground">Durchschnittszeit</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-bold tracking-tight text-foreground">
                {avgLatency}
              </span>
              <span className="text-xs text-muted-foreground">ms pro E-Mail</span>
            </div>
          </div>

          {/* Metric 4: Model */}
          <div className="p-3.5 sm:p-4">
            <span className="text-[11px] font-medium text-muted-foreground">Aktives Modell</span>
            <div className="flex items-baseline gap-1.5 mt-1 truncate">
              <span className="text-sm font-bold text-foreground truncate">
                {aiSettings.model || "Standard"}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">
                {aiSettings.anonymizePii !== false ? "• PII geschützt" : ""}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Live Progress Card (Clean shadcn Card, Stable Container) */}
        {isBatchActive && (
          <div className="rounded-lg border bg-card p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span className="font-semibold text-foreground">
                  E-Mail {currentBatchNumber} von {effectiveBatchTotal} wird analysiert...
                </span>
              </div>
              <span className="font-mono text-muted-foreground">
                {batchPercent}% ({queue.length + (currentItem ? 1 : 0)} verbleibend)
              </span>
            </div>

            {/* Current Item preview */}
            <div className="rounded-md border bg-muted/30 p-2.5 flex items-center justify-between gap-3 min-h-[44px]">
              <div className="min-w-0 flex items-center gap-2 flex-1">
                <Sparkles className="h-3.5 w-3.5 text-primary animate-spin shrink-0" />
                <span className="text-xs font-medium text-foreground truncate">
                  {currentItem?.subject || "Bereite nächste E-Mail vor..."}
                </span>
                <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">
                  • {currentItem?.name || currentItem?.email}
                </span>
              </div>
              {currentItem && (
                <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                  {elapsedSeconds}s
                </span>
              )}
            </div>

            {/* Progress Bar */}
            <Progress
              value={batchPercent}
              className="h-1.5 bg-muted"
              indicatorClassName="bg-primary transition-all duration-300"
            />
          </div>
        )}

        {/* Soft Success Banner */}
        {!isBatchActive && lastBatchSummary && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3.5 text-xs flex items-center justify-between gap-3 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>
                ✓ Alle {lastBatchSummary.total} E-Mails erfolgreich analysiert ({lastBatchSummary.success} OK{lastBatchSummary.error > 0 ? `, ${lastBatchSummary.error} Fehler` : ""}).
              </span>
            </div>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
              Abgeschlossen
            </span>
          </div>
        )}

        {/* 4. Tab Navigation (shadcn Tabs Style) */}
        <div className="space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="inline-flex items-center rounded-lg bg-muted p-1 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("picker")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer",
                  activeTab === "picker"
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <ListChecks className="h-3.5 w-3.5" />
                E-Mails auswählen
                {unanalyzedCount > 0 && (
                  <span className="ml-0.5 rounded-full bg-primary/10 px-1.5 py-0.2 text-[10px] font-semibold text-primary">
                    {unanalyzedCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("queue")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer",
                  activeTab === "queue"
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Layers className="h-3.5 w-3.5" />
                Warteschlange
                {queue.length + (currentItem ? 1 : 0) > 0 && (
                  <span className="ml-0.5 rounded-full bg-muted-foreground/15 px-1.5 py-0.2 text-[10px] font-semibold">
                    {queue.length + (currentItem ? 1 : 0)}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("activity")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer",
                  activeTab === "activity"
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <History className="h-3.5 w-3.5" />
                Aktivitätsprotokoll
                {activityLog.length > 0 && (
                  <span className="ml-0.5 rounded-full bg-muted-foreground/15 px-1.5 py-0.2 text-[10px] font-semibold">
                    {activityLog.length}
                  </span>
                )}
              </button>
            </div>

            {/* Tab-specific top right actions */}
            {activeTab === "activity" && activityLog.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearHistory}
                className="h-7 text-xs text-muted-foreground hover:text-destructive cursor-pointer"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Historie leeren
              </Button>
            )}
          </div>

          {/* TAB 1: EMAIL PICKER */}
          {activeTab === "picker" && (
            <div className="space-y-3">
              {/* Integrated Control Toolbar */}
              <div className="rounded-lg border bg-card p-3 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Left: Filter Pills & Search */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-md border bg-muted/40 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setPickerFilter("unanalyzed")}
                      className={cn(
                        "px-2.5 py-1 rounded text-xs transition-all cursor-pointer",
                        pickerFilter === "unanalyzed"
                          ? "bg-background text-foreground shadow-2xs font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Nicht analysiert ({unanalyzedCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPickerFilter("unread")}
                      className={cn(
                        "px-2.5 py-1 rounded text-xs transition-all cursor-pointer",
                        pickerFilter === "unread"
                          ? "bg-background text-foreground shadow-2xs font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Ungelesen
                    </button>
                    <button
                      type="button"
                      onClick={() => setPickerFilter("all")}
                      className={cn(
                        "px-2.5 py-1 rounded text-xs transition-all cursor-pointer",
                        pickerFilter === "all"
                          ? "bg-background text-foreground shadow-2xs font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Alle ({folderMails.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPickerFilter("analyzed")}
                      className={cn(
                        "px-2.5 py-1 rounded text-xs transition-all cursor-pointer",
                        pickerFilter === "analyzed"
                          ? "bg-background text-foreground shadow-2xs font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Bereits analysiert
                    </button>
                  </div>

                  <div className="relative w-44 sm:w-52">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Suchen..."
                      value={pickerSearch}
                      onChange={(e) => setPickerSearch(e.target.value)}
                      className="h-7.5 text-xs pl-8"
                    />
                  </div>
                </div>

                {/* Right: Quick Select Chips & Primary Action */}
                <div className="flex flex-wrap items-center gap-1.5 justify-between lg:justify-end">
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-[11px] text-muted-foreground mr-1 hidden sm:inline">Auswahl:</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickSelect(5)}
                      className="h-7 text-xs px-2 cursor-pointer font-normal"
                    >
                      Erste 5
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickSelect(10)}
                      className="h-7 text-xs px-2 cursor-pointer font-normal"
                    >
                      10
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickSelect(25)}
                      className="h-7 text-xs px-2 cursor-pointer font-normal"
                    >
                      25
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickSelect(unanalyzedCount)}
                      className="h-7 text-xs px-2 cursor-pointer font-normal"
                    >
                      Alle
                    </Button>
                    {selectedMailIds.size > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearSelection}
                        className="h-7 text-xs text-muted-foreground hover:text-foreground cursor-pointer px-1.5"
                      >
                        Aufheben
                      </Button>
                    )}
                  </div>

                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleAnalyzeSelected}
                    disabled={selectedMailIds.size === 0}
                    className="h-7.5 gap-1.5 text-xs font-semibold shadow-2xs cursor-pointer ml-1"
                  >
                    <Sparkles className="h-3 w-3" />
                    {selectedMailIds.size > 0
                      ? `${selectedMailIds.size} E-Mail${selectedMailIds.size > 1 ? "s" : ""} analysieren`
                      : "Auswählen zum Analysieren"}
                  </Button>
                </div>
              </div>

              {/* Minimal Table */}
              <div className="rounded-lg border bg-card overflow-hidden shadow-2xs">
                {filteredPickerMails.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                    <p className="text-sm font-medium">Keine E-Mails gefunden</p>
                    <p className="text-xs text-muted-foreground/75 mt-1">
                      {pickerFilter === "unanalyzed"
                        ? "Alle E-Mails in diesem Ordner wurden bereits analysiert."
                        : "Keine Treffer für diesen Filter oder Suchbegriff."}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-muted/40 border-b text-muted-foreground font-medium">
                        <tr>
                          <th className="px-3.5 py-2.5 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={
                                filteredPickerMails.length > 0 &&
                                selectedMailIds.size === filteredPickerMails.length
                              }
                              onChange={handleSelectAllFiltered}
                              className="h-3.5 w-3.5 rounded border-muted-foreground/40 text-primary focus:ring-primary cursor-pointer"
                            />
                          </th>
                          <th className="px-2 py-2.5 w-10 text-center font-mono text-[11px] text-muted-foreground/60">
                            #
                          </th>
                          <th className="px-3 py-2.5 w-52">Absender</th>
                          <th className="px-3 py-2.5">Betreff</th>
                          <th className="px-3 py-2.5 w-28">Datum</th>
                          <th className="px-3 py-2.5 w-36">KI-Status</th>
                          <th className="px-3 py-2.5 w-24 text-right">Aktion</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredPickerMails.map((mail) => {
                          const isSelected = selectedMailIds.has(mail.id);
                          return (
                            <tr
                              key={mail.id}
                              onClick={() => handleToggleSelect(mail.id)}
                              className={cn(
                                "hover:bg-muted/40 transition-colors cursor-pointer",
                                isSelected && "bg-primary/5"
                              )}
                            >
                              <td
                                className="px-3.5 py-2.5 text-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelect(mail.id)}
                                  className="h-3.5 w-3.5 rounded border-muted-foreground/40 text-primary focus:ring-primary cursor-pointer"
                                />
                              </td>
                              <td className="px-2 py-2.5 text-center font-mono text-[11px] text-muted-foreground/50">
                                {mail.indexNumber}
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  <SenderAvatar email={mail.email} size="sm" />
                                  <div className="min-w-0">
                                    <div className="font-semibold text-foreground truncate max-w-36">
                                      {mail.name || mail.email}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground truncate max-w-36">
                                      {mail.email}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {!mail.read && (
                                    <span className="h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0" title="Ungelesen" />
                                  )}
                                  <span className="font-medium text-foreground truncate max-w-md">
                                    {mail.subject || "(Kein Betreff)"}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-[11px] text-muted-foreground whitespace-nowrap">
                                {formatDate(mail.date)}
                              </td>
                              <td className="px-3 py-2.5">
                                {mail.aiStatus === "analyzing" ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary animate-pulse">
                                    <Sparkles className="h-2.5 w-2.5 animate-spin" />
                                    In Analyse
                                  </span>
                                ) : mail.aiStatus === "queued" ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <Clock className="h-2.5 w-2.5" />
                                    Warteschlange
                                  </span>
                                ) : mail.aiStatus === "analyzed" && mail.category ? (
                                  <span
                                    className={cn(
                                      "inline-flex items-center rounded border px-1.5 py-0.2 text-[10px] font-medium",
                                      getCategoryColor(mail.category)
                                    )}
                                  >
                                    {mail.category}
                                  </span>
                                ) : mail.aiStatus === "error" ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-destructive">
                                    <AlertTriangle className="h-2.5 w-2.5" />
                                    Fehler
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-muted-foreground/50">
                                    -
                                  </span>
                                )}
                              </td>
                              <td
                                className="px-3 py-2.5 text-right"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleAnalyzeSingle(mail)}
                                  className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground cursor-pointer"
                                  title={mail.aiStatus === "analyzed" ? "Diese E-Mail erneut analysieren" : "Diese E-Mail jetzt analysieren"}
                                >
                                  {mail.aiStatus === "analyzed" ? "Erneut" : "Analysieren"}
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ACTIVE QUEUE */}
          {activeTab === "queue" && (
            <div className="rounded-lg border bg-card overflow-hidden shadow-2xs">
              {queue.length === 0 && !currentItem ? (
                <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                  <p className="text-sm font-medium">Warteschlange ist leer</p>
                  <p className="text-xs text-muted-foreground/75 mt-1 max-w-sm">
                    Wechsle in den Tab &quot;E-Mails auswählen&quot;, um gezielt E-Mails zur Analyse einzureihen.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {currentItem && (
                    <div className="p-3 bg-primary/5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="inline-flex items-center rounded border border-primary/25 bg-primary/10 px-1.5 py-0.2 text-[10px] font-semibold text-primary">
                          AKTIV
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">
                            {currentItem.subject || "Kein Betreff"}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {currentItem.name || currentItem.email}
                          </p>
                        </div>
                      </div>
                      <Sparkles className="h-3.5 w-3.5 text-primary animate-spin shrink-0" />
                    </div>
                  )}

                  {queue.map((item, index) => (
                    <div key={item.id} className="p-3 flex items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xs font-mono text-muted-foreground/60 w-5 text-center shrink-0">
                          #{index + (currentItem ? 2 : 1)}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">
                            {item.subject || "Kein Betreff"}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {item.name || item.email}
                          </p>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeQueueItem(item.id)}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive cursor-pointer"
                        title="Entfernen"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ACTIVITY LOG */}
          {activeTab === "activity" && (
            <div className="space-y-3">
              {/* Filter & Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="inline-flex rounded-md border bg-muted/40 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setFilterStatus("all")}
                    className={cn(
                      "px-2.5 py-1 rounded text-xs transition-all cursor-pointer",
                      filterStatus === "all"
                        ? "bg-background text-foreground shadow-2xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Alle ({activityLog.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterStatus("success")}
                    className={cn(
                      "px-2.5 py-1 rounded text-xs transition-all cursor-pointer",
                      filterStatus === "success"
                        ? "bg-background text-emerald-600 dark:text-emerald-400 shadow-2xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Erfolgreich ({stats.successCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterStatus("error")}
                    className={cn(
                      "px-2.5 py-1 rounded text-xs transition-all cursor-pointer",
                      filterStatus === "error"
                        ? "bg-background text-destructive shadow-2xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Fehler ({stats.errorCount})
                  </button>
                </div>

                <div className="relative w-full sm:w-56">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Protokoll durchsuchen..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="h-7.5 text-xs pl-8"
                  />
                </div>
              </div>

              {/* Activity Log Table */}
              <div className="rounded-lg border bg-card overflow-hidden shadow-2xs">
                {filteredActivity.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                    <p className="text-sm font-medium">Keine Protokolleinträge vorhanden</p>
                    <p className="text-xs text-muted-foreground/75 mt-1">
                      Sobald E-Mails analysiert werden, erscheint hier das detaillierte Protokoll.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-muted/40 border-b text-muted-foreground font-medium">
                        <tr>
                          <th className="px-3.5 py-2.5 w-20">Status</th>
                          <th className="px-3.5 py-2.5">E-Mail & Betreff</th>
                          <th className="px-3.5 py-2.5 w-28">Kategorie</th>
                          <th className="px-3.5 py-2.5 w-20">Dauer</th>
                          <th className="px-3.5 py-2.5 w-24">Zeit</th>
                          <th className="px-3.5 py-2.5 w-16 text-right">Aktion</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredActivity.map((entry) => (
                          <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-3.5 py-2.5">
                              {entry.status === "success" ? (
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                                  <Check className="h-2.5 w-2.5" />
                                  OK
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] text-destructive font-medium">
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  Fehler
                                </span>
                              )}
                            </td>
                            <td className="px-3.5 py-2.5">
                              <div className="font-medium text-foreground truncate max-w-md">
                                {entry.subject || "Kein Betreff"}
                              </div>
                              <div className="text-[10px] text-muted-foreground truncate max-w-md">
                                {entry.sender}
                              </div>
                            </td>
                            <td className="px-3.5 py-2.5">
                              {entry.category ? (
                                <span
                                  className={cn(
                                    "inline-flex items-center rounded border px-1.5 py-0.2 text-[10px] font-medium",
                                    getCategoryColor(entry.category)
                                  )}
                                >
                                  {entry.category}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-[10px]">-</span>
                              )}
                            </td>
                            <td className="px-3.5 py-2.5 font-mono text-[11px] text-muted-foreground">
                              {entry.durationMs} ms
                            </td>
                            <td className="px-3.5 py-2.5 text-[11px] text-muted-foreground whitespace-nowrap">
                              {new Date(entry.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </td>
                            <td className="px-3.5 py-2.5 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => retryItem(entry.mailId, entry.subject, entry.sender)}
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                                title="Erneut analysieren"
                              >
                                <RotateCcw className="h-3 w-3" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
