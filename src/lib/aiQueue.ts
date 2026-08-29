import { getAiSettings, getCachedAnalysis, setCachedAnalysis, type AiAnalysisResult } from "./aiCache";

export type QueueStatus = "idle" | "running" | "paused" | "completed" | "error";
export type ItemStatus = "queued" | "analyzing" | "completed" | "failed" | "skipped";

export interface AiQueueItem {
  id: string | number;
  seq?: number;
  subject: string;
  email: string;
  name?: string;
  status: ItemStatus;
  addedAt: number;
  startedAt?: number;
  completedAt?: number;
  retries: number;
  maxRetries: number;
  error?: string;
  folder?: string;
  force?: boolean;
}

export interface AiActivityEntry {
  id: string;
  mailId: string | number;
  subject: string;
  sender: string;
  category?: string;
  tags?: string[];
  status: "success" | "error";
  durationMs: number;
  promptTokens?: number;
  completionTokens?: number;
  model?: string;
  timestamp: number;
  error?: string;
}

export interface AiQueueStats {
  totalAnalyzed: number;
  todayAnalyzed: number;
  successCount: number;
  errorCount: number;
  totalLatencyMs: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  lastResetDate: string;
}

export interface BatchSummary {
  total: number;
  success: number;
  error: number;
  finishedAt: number;
}

export interface AiQueueState {
  status: QueueStatus;
  queue: AiQueueItem[];
  currentItem: AiQueueItem | null;
  activityLog: AiActivityEntry[];
  stats: AiQueueStats;
  errorMessage?: string | null;
  isAutoQueueEnabled: boolean;
  batchTotal: number;
  batchCompleted: number;
  lastBatchSummary: BatchSummary | null;
}

const STATS_KEY = "dopis:ai:stats";
const ACTIVITY_KEY = "dopis:ai:activity";
const AUTO_QUEUE_KEY = "dopis:ai:auto_queue";
const MAX_ACTIVITY_LOG = 100;

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadInitialStats(): AiQueueStats {
  const defaultStats: AiQueueStats = {
    totalAnalyzed: 0,
    todayAnalyzed: 0,
    successCount: 0,
    errorCount: 0,
    totalLatencyMs: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    lastResetDate: getTodayString(),
  };

  if (typeof window === "undefined") return defaultStats;

  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return defaultStats;
    const parsed: AiQueueStats = JSON.parse(raw);
    const today = getTodayString();
    if (parsed.lastResetDate !== today) {
      parsed.todayAnalyzed = 0;
      parsed.lastResetDate = today;
    }
    return { ...defaultStats, ...parsed };
  } catch {
    return defaultStats;
  }
}

function loadInitialActivity(): AiActivityEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function loadAutoQueueSetting(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(AUTO_QUEUE_KEY);
    return raw !== null ? JSON.parse(raw) : false;
  } catch {
    return false;
  }
}

class AiQueueManager {
  private state: AiQueueState;
  private listeners: Set<() => void> = new Set();
  private isProcessing = false;
  private abortController: AbortController | null = null;
  private idleCallbackId: number | NodeJS.Timeout | null = null;

  constructor() {
    this.state = {
      status: "idle",
      queue: [],
      currentItem: null,
      activityLog: loadInitialActivity(),
      stats: loadInitialStats(),
      errorMessage: null,
      isAutoQueueEnabled: loadAutoQueueSetting(),
      batchTotal: 0,
      batchCompleted: 0,
      lastBatchSummary: null,
    };
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (e) {
        console.error("Error in AI queue listener:", e);
      }
    }
  }

  private saveStats() {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(this.state.stats));
    } catch (e) {
      console.warn("Failed to persist AI stats:", e);
    }
  }

  private saveActivity() {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(ACTIVITY_KEY, JSON.stringify(this.state.activityLog.slice(0, MAX_ACTIVITY_LOG)));
    } catch (e) {
      console.warn("Failed to persist AI activity log:", e);
    }
  }

  public getState(): AiQueueState {
    return { ...this.state };
  }

  public setAutoQueueEnabled(enabled: boolean) {
    this.state.isAutoQueueEnabled = enabled;
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(AUTO_QUEUE_KEY, JSON.stringify(enabled));
      } catch {}
    }
    this.notify();
  }

  public enqueueEmails(
    items: Array<{ id?: string | number; seq?: number; subject?: string; email?: string; name?: string; read?: boolean; date?: string }>,
    options: { force?: boolean; folder?: string; onlyUnread?: boolean; prepend?: boolean } = {}
  ): number {
    if (!items || items.length === 0) return 0;
    const { force = false, folder, onlyUnread = false, prepend = false } = options;

    let addedCount = 0;
    const newItems: AiQueueItem[] = [];

    for (const mail of items) {
      const id = mail.id || mail.seq;
      if (!id) continue;

      // If onlyUnread is specified (for selective auto-queue), skip read emails
      if (onlyUnread && mail.read) continue;

      // Check if already in cache (unless force is set)
      if (!force && getCachedAnalysis(id)) continue;

      // Check if already in queue or currently analyzing
      const inQueue = this.state.queue.some((q) => String(q.id) === String(id));
      const isCurrent = this.state.currentItem && String(this.state.currentItem.id) === String(id);
      if (inQueue || isCurrent) continue;

      newItems.push({
        id,
        seq: mail.seq,
        subject: mail.subject || "Kein Betreff",
        email: mail.email || "",
        name: mail.name,
        status: "queued",
        addedAt: Date.now(),
        retries: 0,
        maxRetries: 2,
        folder,
        force,
      });
      addedCount++;
    }

    if (newItems.length > 0) {
      this.state.queue = prepend ? [...newItems, ...this.state.queue] : [...this.state.queue, ...newItems];
      if (!this.state.currentItem && this.state.queue.length === newItems.length) {
        this.state.batchTotal = newItems.length;
        this.state.batchCompleted = 0;
      } else {
        this.state.batchTotal += newItems.length;
      }
      this.state.lastBatchSummary = null;
      if (this.state.status === "completed" || this.state.status === "idle") {
        this.state.status = "idle";
      }
      this.notify();
      this.scheduleProcessing();
    }

    return addedCount;
  }

  public scheduleProcessing() {
    if (this.isProcessing || this.state.status === "paused") return;
    if (this.state.queue.length === 0 && !this.state.currentItem) {
      if (this.state.status === "running") {
        this.state.status = "completed";
        this.notify();
      }
      return;
    }

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      if (this.idleCallbackId) cancelIdleCallback(this.idleCallbackId as number);
      this.idleCallbackId = window.requestIdleCallback(() => this.processNext(), { timeout: 1500 });
    } else {
      if (this.idleCallbackId) clearTimeout(this.idleCallbackId as NodeJS.Timeout);
      this.idleCallbackId = setTimeout(() => this.processNext(), 200);
    }
  }

  public async start() {
    if (this.state.status === "paused") {
      this.state.status = "idle";
    }
    this.scheduleProcessing();
  }

  public pause() {
    this.state.status = "paused";
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isProcessing = false;
    this.notify();
  }

  public resume() {
    if (this.state.status === "paused" || this.state.status === "error") {
      this.state.status = "idle";
      this.state.errorMessage = null;
      this.notify();
      this.scheduleProcessing();
    }
  }

  public clearQueue() {
    this.state.queue = [];
    this.state.batchTotal = 0;
    this.state.batchCompleted = 0;
    this.state.lastBatchSummary = null;
    if (!this.state.currentItem) {
      this.state.status = "idle";
    }
    this.notify();
  }

  public removeQueueItem(id: string | number) {
    this.state.queue = this.state.queue.filter((item) => String(item.id) !== String(id));
    this.notify();
  }

  public clearHistory() {
    this.state.activityLog = [];
    this.saveActivity();
    this.notify();
  }

  public retryFailed() {
    const failedEntries = this.state.activityLog.filter((e) => e.status === "error");
    if (failedEntries.length === 0) return;

    for (const entry of failedEntries) {
      this.enqueueEmails(
        [
          {
            id: entry.mailId,
            subject: entry.subject,
            email: entry.sender,
          },
        ],
        { force: true }
      );
    }
  }

  public retrySingleItem(mailId: string | number, subject?: string, sender?: string) {
    this.enqueueEmails(
      [
        {
          id: mailId,
          subject: subject || "E-Mail",
          email: sender || "",
        },
      ],
      { force: true }
    );
  }

  private updateStatsOnResult(success: boolean, durationMs: number, promptTokens?: number, completionTokens?: number) {
    const today = getTodayString();
    if (this.state.stats.lastResetDate !== today) {
      this.state.stats.todayAnalyzed = 0;
      this.state.stats.lastResetDate = today;
    }

    this.state.stats.totalAnalyzed++;
    this.state.stats.todayAnalyzed++;
    if (success) {
      this.state.stats.successCount++;
    } else {
      this.state.stats.errorCount++;
    }
    this.state.stats.totalLatencyMs += durationMs;
    if (promptTokens) this.state.stats.totalPromptTokens += promptTokens;
    if (completionTokens) this.state.stats.totalCompletionTokens += completionTokens;

    this.saveStats();
  }

  public logExternalAnalysis(
    mailId: string | number,
    subject: string,
    sender: string,
    result: AiAnalysisResult | null,
    durationMs: number,
    error?: string
  ) {
    const entry: AiActivityEntry = {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      mailId,
      subject: subject || "Unbekannter Betreff",
      sender: sender || "",
      category: result?.category,
      tags: result?.tags,
      status: result ? "success" : "error",
      durationMs: durationMs || 0,
      promptTokens: result?._debug?.promptTokens,
      completionTokens: result?._debug?.completionTokens,
      model: result?._debug?.model,
      timestamp: Date.now(),
      error,
    };

    this.state.activityLog = [entry, ...this.state.activityLog.slice(0, MAX_ACTIVITY_LOG - 1)];
    this.updateStatsOnResult(
      Boolean(result),
      durationMs,
      result?._debug?.promptTokens,
      result?._debug?.completionTokens
    );
    this.saveActivity();
    this.notify();
  }

  private async processNext() {
    if (this.isProcessing || this.state.status === "paused") return;
    if (this.state.queue.length === 0) {
      this.state.currentItem = null;
      if (this.state.status === "running") {
        this.state.status = "completed";
      }
      this.notify();
      return;
    }

    this.isProcessing = true;
    this.state.status = "running";

    const nextItem = this.state.queue[0];
    this.state.queue = this.state.queue.slice(1);
    this.state.currentItem = {
      ...nextItem,
      status: "analyzing",
      startedAt: Date.now(),
    };
    this.notify();

    const startTime = performance.now();
    let result: AiAnalysisResult | null = null;
    let errorMessage: string | undefined;

    try {
      this.abortController = new AbortController();
      const settings = getAiSettings();

      // Fetch full email content to provide complete context (avoids hallucinated To-Dos from missing body text)
      let emailText = "";
      let emailHtml = "";
      try {
        const detailRes = await fetch(
          `/api/email?seq=${nextItem.seq || nextItem.id}&folder=${nextItem.folder || "inbox"}`,
          { signal: this.abortController.signal }
        );
        if (detailRes.ok) {
          const detail = await detailRes.json();
          emailText = detail.text || "";
          emailHtml = detail.html || "";
        }
      } catch (e) {
        // Fallback to subject-only if detail fetch fails
      }

      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: this.abortController.signal,
        body: JSON.stringify({
          subject: nextItem.subject,
          from: nextItem.name ? `${nextItem.name} <${nextItem.email}>` : nextItem.email,
          text: emailText,
          html: emailHtml,
          settings,
        }),
      });

      if (!res.ok) {
        // Check for Quota or Authentication errors
        if (res.status === 401) {
          throw new Error("Authentifizierungsfehler: Bitte überprüfe deinen API-Schlüssel in den Einstellungen.");
        }
        if (res.status === 429) {
          throw new Error("API Rate Limit / Quota erschöpft: Zu viele Anfragen.");
        }
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP-Fehler ${res.status}`);
      }

      result = await res.json();
      setCachedAnalysis(nextItem.id, result!);
    } catch (err: any) {
      if (err.name === "AbortError") {
        // Cancelled / Paused
        this.isProcessing = false;
        return;
      }
      errorMessage = err.message || "Analyse fehlgeschlagen";

      // If Quota or Auth error, pause the queue automatically
      if (errorMessage?.includes("Authentifizierungsfehler") || errorMessage?.includes("Rate Limit") || errorMessage?.includes("Quota")) {
        this.state.status = "paused";
        this.state.errorMessage = errorMessage;
      } else if (nextItem.retries < nextItem.maxRetries) {
        // Retry with backoff
        const retriedItem: AiQueueItem = {
          ...nextItem,
          retries: nextItem.retries + 1,
          status: "queued",
          error: `Versuch ${nextItem.retries + 1} fehlgeschlagen: ${errorMessage}`,
        };
        this.state.queue.push(retriedItem);
      }
    } finally {
      const durationMs = Math.round(performance.now() - startTime);

      // Log entry
      const logEntry: AiActivityEntry = {
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        mailId: nextItem.id,
        subject: nextItem.subject,
        sender: nextItem.name ? `${nextItem.name} <${nextItem.email}>` : nextItem.email,
        category: result?.category,
        tags: result?.tags,
        status: result ? "success" : "error",
        durationMs,
        promptTokens: result?._debug?.promptTokens,
        completionTokens: result?._debug?.completionTokens,
        model: result?._debug?.model,
        timestamp: Date.now(),
        error: errorMessage,
      };

      this.state.activityLog = [logEntry, ...this.state.activityLog.slice(0, MAX_ACTIVITY_LOG - 1)];
      this.updateStatsOnResult(
        Boolean(result),
        durationMs,
        result?._debug?.promptTokens,
        result?._debug?.completionTokens
      );
      this.saveActivity();

      this.state.batchCompleted++;
      this.abortController = null;
      this.isProcessing = false;

      // Seamless Transition:
      if (this.state.status !== "paused" && this.state.queue.length > 0) {
        // Keep currentItem during the brief interval to prevent layout collapse / flicker
        this.notify();
        setTimeout(() => this.processNext(), 150);
      } else {
        const total = Math.max(this.state.batchTotal, this.state.batchCompleted, 1);
        const lastBatchLogs = this.state.activityLog.slice(0, total);
        const errCount = lastBatchLogs.filter((a) => a.status === "error").length;
        const succCount = total - errCount;

        this.state.currentItem = null;
        if (this.state.status !== "paused") {
          this.state.status = "completed";
          this.state.lastBatchSummary = {
            total,
            success: succCount,
            error: errCount,
            finishedAt: Date.now(),
          };
          this.state.batchTotal = 0;
          this.state.batchCompleted = 0;
        }
        this.notify();

        // Auto-dismiss completed state after 4.5 seconds
        setTimeout(() => {
          if (this.state.status === "completed") {
            this.state.status = "idle";
            this.state.lastBatchSummary = null;
            this.notify();
          }
        }, 4500);
      }
    }
  }
}

// Singleton Instance
export const aiQueue = new AiQueueManager();

// Helper React hook for clean UI reactivity
import { useState, useEffect } from "react";

export function useAiQueue() {
  const [state, setState] = useState<AiQueueState>(() => aiQueue.getState());

  useEffect(() => {
    setState(aiQueue.getState());
    const unsubscribe = aiQueue.subscribe(() => {
      setState(aiQueue.getState());
    });
    return unsubscribe;
  }, []);

  return {
    ...state,
    enqueue: (items: any[], options?: any) => aiQueue.enqueueEmails(items, options),
    start: () => aiQueue.start(),
    pause: () => aiQueue.pause(),
    resume: () => aiQueue.resume(),
    clearQueue: () => aiQueue.clearQueue(),
    removeQueueItem: (id: string | number) => aiQueue.removeQueueItem(id),
    clearHistory: () => aiQueue.clearHistory(),
    retryFailed: () => aiQueue.retryFailed(),
    retryItem: (id: string | number, subject?: string, sender?: string) =>
      aiQueue.retrySingleItem(id, subject, sender),
    setAutoQueueEnabled: (enabled: boolean) => aiQueue.setAutoQueueEnabled(enabled),
  };
}
