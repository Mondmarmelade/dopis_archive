import {
  getAiSettings,
  getCachedAnalysis,
  setCachedAnalysis,
  saveAiSettings,
  type AiAnalysisResult,
} from "./aiCache";

export type QueueStatus = "idle" | "running" | "paused" | "completed" | "error";
export type ItemStatus = "queued" | "analyzing" | "completed" | "failed" | "skipped";

export interface AiQueueItem {
  id: string | number;
  seq?: number;
  uid?: number;
  date?: string;
  subject: string;
  email: string;
  name?: string;
  headerSignals?: any;
  status: ItemStatus;
  addedAt: number;
  startedAt?: number;
  completedAt?: number;
  retries: number;
  maxRetries: number;
  error?: string;
  folder?: string;
  force?: boolean;
  trigger?: "manual" | "new_incoming";
}

export interface AiActivityEntry {
  id: string;
  mailId: string | number;
  subject: string;
  sender: string;
  category?: string;
  categoryConfidence?: number;
  tags?: string[];
  status: "success" | "error";
  durationMs: number;
  deciderLatencyMs?: number;
  extractorLatencyMs?: number;
  extractorSkipped?: boolean;
  promptTokens?: number;
  completionTokens?: number;
  costUsd?: number;
  model?: string;
  trigger?: "manual" | "new_incoming";
  timestamp: number;
  error?: string;
}

export interface AiQueueStats {
  totalAnalyzed: number;
  todayAnalyzed: number;
  successCount: number;
  errorCount: number;
  totalLatencyMs: number;
  totalDeciderLatencyMs: number;
  totalExtractorLatencyMs: number;
  extractorSkippedCount: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCostUsd: number;
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
  activeItems: AiQueueItem[];
  activityLog: AiActivityEntry[];
  stats: AiQueueStats;
  errorMessage?: string | null;
  /** Controls automatic single-email analysis strictly for NEWLY arriving emails */
  isAutoQueueEnabled: boolean;
  batchTotal: number;
  batchCompleted: number;
  lastBatchSummary: BatchSummary | null;
}

const STATS_KEY = "dopis:ai:stats";
const ACTIVITY_KEY = "dopis:ai:activity";
const MAX_ACTIVITY_LOG = 120;

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
    totalDeciderLatencyMs: 0,
    totalExtractorLatencyMs: 0,
    extractorSkippedCount: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalCostUsd: 0,
    lastResetDate: getTodayString(),
  };

  if (typeof window === "undefined") return defaultStats;

  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return defaultStats;
    const parsed: Partial<AiQueueStats> = JSON.parse(raw);
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

function loadAutoNewMailSetting(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const settings = getAiSettings();
    return settings.autoAnalyzeNewEmails !== false;
  } catch {
    return true;
  }
}

class AiQueueManager {
  private state: AiQueueState;
  private listeners: Set<() => void> = new Set();
  private activeCount = 0;
  private abortControllers: Map<string, AbortController> = new Map();
  private idleCallbackId: number | NodeJS.Timeout | null = null;

  constructor() {
    this.state = {
      status: "idle",
      queue: [],
      currentItem: null,
      activeItems: [],
      activityLog: loadInitialActivity(),
      stats: loadInitialStats(),
      errorMessage: null,
      isAutoQueueEnabled: loadAutoNewMailSetting(),
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
      localStorage.setItem(
        ACTIVITY_KEY,
        JSON.stringify(this.state.activityLog.slice(0, MAX_ACTIVITY_LOG))
      );
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
        const current = getAiSettings();
        saveAiSettings({ ...current, autoAnalyzeNewEmails: enabled });
      } catch {}
    }
    this.notify();
  }

  private getConcurrency(): number {
    const settings = getAiSettings();
    return settings.deciderProtocol === "openai_compat" ? 1 : 3;
  }

  public enqueueEmails(
    items: Array<{
      id?: string | number;
      seq?: number;
      uid?: number;
      subject?: string;
      email?: string;
      name?: string;
      read?: boolean;
      date?: string;
      headerSignals?: any;
      aiAnalysis?: any;
    }>,
    options: {
      force?: boolean;
      folder?: string;
      onlyUnread?: boolean;
      prepend?: boolean;
      trigger?: "manual" | "new_incoming";
    } = {}
  ): number {
    if (!items || items.length === 0) return 0;
    const {
      force = false,
      folder = "inbox",
      onlyUnread = false,
      prepend = false,
      trigger = "manual",
    } = options;

    let addedCount = 0;
    const newItems: AiQueueItem[] = [];

    for (const mail of items) {
      const id = mail.id || mail.seq;
      if (!id) continue;

      if (onlyUnread && mail.read) continue;
      if (!force && (mail.aiAnalysis || getCachedAnalysis(id))) continue;

      const inQueue = this.state.queue.some((q) => String(q.id) === String(id));
      const isActive = this.state.activeItems.some((a) => String(a.id) === String(id));
      if (inQueue || isActive) continue;

      newItems.push({
        id,
        seq: mail.seq,
        uid: mail.uid,
        date: mail.date,
        subject: mail.subject || "Kein Betreff",
        email: mail.email || "",
        name: mail.name,
        headerSignals: mail.headerSignals,
        status: "queued",
        addedAt: Date.now(),
        retries: 0,
        maxRetries: 2,
        folder,
        force,
        trigger,
      });
      addedCount++;
    }

    if (newItems.length > 0) {
      this.state.queue = prepend
        ? [...newItems, ...this.state.queue]
        : [...this.state.queue, ...newItems];

      if (this.activeCount === 0 && this.state.queue.length === newItems.length) {
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

  /**
   * Enqueues a single newly arrived incoming email (only when autoAnalyzeNewEmails is enabled).
   */
  public enqueueNewIncomingEmail(
    mail: {
      id?: string | number;
      seq?: number;
      uid?: number;
      subject?: string;
      email?: string;
      name?: string;
      date?: string;
      headerSignals?: any;
      aiAnalysis?: any;
    },
    folder = "inbox"
  ): number {
    if (!this.state.isAutoQueueEnabled) return 0;
    return this.enqueueEmails([mail], {
      folder,
      prepend: true,
      trigger: "new_incoming",
    });
  }

  public scheduleProcessing() {
    if (this.state.status === "paused") return;
    if (this.state.queue.length === 0) return;

    if (this.idleCallbackId) return;

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      this.idleCallbackId = (window as any).requestIdleCallback(
        () => {
          this.idleCallbackId = null;
          this.pumpQueue();
        },
        { timeout: 600 }
      );
    } else {
      this.idleCallbackId = setTimeout(() => {
        this.idleCallbackId = null;
        this.pumpQueue();
      }, 100);
    }
  }

  public start() {
    this.state.errorMessage = null;
    if (this.state.status === "paused") {
      this.state.status = "idle";
    }
    this.notify();
    this.pumpQueue();
  }

  public pause() {
    this.state.status = "paused";
    if (this.idleCallbackId) {
      if (typeof window !== "undefined" && "cancelIdleCallback" in window) {
        try {
          (window as any).cancelIdleCallback(this.idleCallbackId);
        } catch {}
      } else {
        clearTimeout(this.idleCallbackId as any);
      }
      this.idleCallbackId = null;
    }

    for (const ctrl of this.abortControllers.values()) {
      ctrl.abort();
    }
    this.abortControllers.clear();

    if (this.state.activeItems.length > 0) {
      const requeued = this.state.activeItems.map((item) => ({
        ...item,
        status: "queued" as ItemStatus,
        startedAt: undefined,
      }));
      this.state.queue = [...requeued, ...this.state.queue];
      this.state.activeItems = [];
      this.state.currentItem = null;
      this.activeCount = 0;
    }

    this.notify();
  }

  public resume() {
    this.state.errorMessage = null;
    this.state.status = "idle";
    this.notify();
    this.pumpQueue();
  }

  public clearQueue() {
    this.pause();
    this.state.queue = [];
    this.state.activeItems = [];
    this.state.currentItem = null;
    this.state.status = "idle";
    this.state.errorMessage = null;
    this.state.batchTotal = 0;
    this.state.batchCompleted = 0;
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
    const failedLogs = this.state.activityLog.filter((a) => a.status === "error");
    const unique = new Map<string, AiActivityEntry>();
    for (const entry of failedLogs) {
      const key = String(entry.mailId);
      if (!unique.has(key) && !getCachedAnalysis(entry.mailId)) {
        unique.set(key, entry);
      }
    }
    const toRetry = Array.from(unique.values()).map((a) => ({
      id: a.mailId,
      seq: Number(a.mailId) || undefined,
      subject: a.subject,
      email: a.sender,
    }));
    this.enqueueEmails(toRetry, { force: true, trigger: "manual" });
  }

  public retrySingleItem(id: string | number, subject?: string, sender?: string) {
    this.enqueueEmails(
      [{ id, seq: Number(id) || undefined, subject: subject || "E-Mail", email: sender || "" }],
      { force: true, prepend: true, trigger: "manual" }
    );
  }

  private updateStatsOnResult(
    success: boolean,
    durationMs: number,
    result?: AiAnalysisResult | null
  ) {
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

    const deciderMs = result?._debug?.stages?.decider?.durationMs;
    const extractorMs = result?._debug?.stages?.extractor?.durationMs;
    const extractorSkipped = result?.pipeline?.extractorSkipped ?? result?._debug?.stages?.extractor?.skipped;

    if (typeof deciderMs === "number") this.state.stats.totalDeciderLatencyMs += deciderMs;
    if (typeof extractorMs === "number") this.state.stats.totalExtractorLatencyMs += extractorMs;
    if (extractorSkipped) this.state.stats.extractorSkippedCount++;

    if (result?._debug?.promptTokens) {
      this.state.stats.totalPromptTokens += result._debug.promptTokens;
    }
    if (result?._debug?.completionTokens) {
      this.state.stats.totalCompletionTokens += result._debug.completionTokens;
    }
    if (typeof result?._debug?.totalCostUsd === "number") {
      this.state.stats.totalCostUsd = Number(
        (this.state.stats.totalCostUsd + result._debug.totalCostUsd).toFixed(6)
      );
    }

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
      categoryConfidence: result?.categoryConfidence,
      tags: result?.tags,
      status: result ? "success" : "error",
      durationMs: durationMs || 0,
      deciderLatencyMs: result?._debug?.stages?.decider?.durationMs,
      extractorLatencyMs: result?._debug?.stages?.extractor?.durationMs,
      extractorSkipped: result?.pipeline?.extractorSkipped,
      promptTokens: result?._debug?.promptTokens,
      completionTokens: result?._debug?.completionTokens,
      costUsd: result?._debug?.totalCostUsd,
      model: result?._debug?.model,
      trigger: "manual",
      timestamp: Date.now(),
      error,
    };

    this.state.activityLog = [entry, ...this.state.activityLog.slice(0, MAX_ACTIVITY_LOG - 1)];
    this.updateStatsOnResult(Boolean(result), durationMs, result);
    this.saveActivity();
    this.notify();
  }

  private pumpQueue() {
    if (this.state.status === "paused") return;
    const concurrency = this.getConcurrency();

    while (this.activeCount < concurrency && this.state.queue.length > 0) {
      const nextItem = this.state.queue.shift()!;
      this.processItem(nextItem);
    }

    if (this.activeCount === 0 && this.state.queue.length === 0 && this.state.status === "running") {
      this.finishBatch();
    }
  }

  private finishBatch() {
    const total = Math.max(this.state.batchTotal, this.state.batchCompleted, 1);
    const lastBatchLogs = this.state.activityLog.slice(0, total);
    const errCount = lastBatchLogs.filter((a) => a.status === "error").length;
    const succCount = Math.max(0, total - errCount);

    this.state.currentItem = null;
    this.state.activeItems = [];
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

    setTimeout(() => {
      if (this.state.status === "completed") {
        this.state.status = "idle";
        this.state.lastBatchSummary = null;
        this.notify();
      }
    }, 4500);
  }

  private async processItem(item: AiQueueItem) {
    this.activeCount++;
    this.state.status = "running";

    const runningItem: AiQueueItem = {
      ...item,
      status: "analyzing",
      startedAt: Date.now(),
    };

    this.state.activeItems = [...this.state.activeItems, runningItem];
    this.state.currentItem = this.state.activeItems[0] || runningItem;
    this.notify();

    const controller = new AbortController();
    const itemKey = String(item.id);
    this.abortControllers.set(itemKey, controller);

    const startTime = performance.now();
    let result: AiAnalysisResult | null = null;
    let errorMessage: string | undefined;

    try {
      const settings = getAiSettings();

      let emailText = "";
      let emailHtml = "";
      let emailAttachments: any[] = [];
      let emailDate = item.date || "";
      try {
        const detailRes = await fetch(
          `/api/email?seq=${item.seq || item.id}&folder=${item.folder || "inbox"}`,
          { signal: controller.signal }
        );
        if (detailRes.ok) {
          const detail = await detailRes.json();
          emailText = detail.text || "";
          emailHtml = detail.html || "";
          emailAttachments = Array.isArray(detail.attachments) ? detail.attachments : [];
          if (!emailDate && detail.date) emailDate = detail.date;
        }
      } catch {}

      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          seq: item.seq || item.id,
          id: item.id,
          folder: item.folder || "inbox",
          date: emailDate || new Date().toISOString(),
          subject: item.subject,
          from: item.name ? `${item.name} <${item.email}>` : item.email,
          text: emailText,
          html: emailHtml,
          headers: item.headerSignals || null,
          attachments: emailAttachments,
          settings,
        }),
      });

      if (!res.ok) {
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
      setCachedAnalysis(item.id, result!);
    } catch (err: any) {
      if (err.name === "AbortError") {
        this.abortControllers.delete(itemKey);
        this.activeCount = Math.max(0, this.activeCount - 1);
        return;
      }
      errorMessage = err.message || "Analyse fehlgeschlagen";

      if (
        errorMessage?.includes("Authentifizierungsfehler") ||
        errorMessage?.includes("Rate Limit") ||
        errorMessage?.includes("Quota")
      ) {
        this.state.status = "paused";
        this.state.errorMessage = errorMessage;
      } else if (item.retries < item.maxRetries) {
        this.state.queue.push({
          ...item,
          retries: item.retries + 1,
          status: "queued",
          error: `Versuch ${item.retries + 1} fehlgeschlagen: ${errorMessage}`,
        });
      }
    } finally {
      this.abortControllers.delete(itemKey);
      this.activeCount = Math.max(0, this.activeCount - 1);
      this.state.activeItems = this.state.activeItems.filter((a) => String(a.id) !== itemKey);
      this.state.currentItem = this.state.activeItems[0] || null;

      const durationMs = Math.round(performance.now() - startTime);

      const logEntry: AiActivityEntry = {
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        mailId: item.id,
        subject: item.subject,
        sender: item.name ? `${item.name} <${item.email}>` : item.email,
        category: result?.category,
        categoryConfidence: result?.categoryConfidence,
        tags: result?.tags,
        status: result ? "success" : "error",
        durationMs,
        deciderLatencyMs: result?._debug?.stages?.decider?.durationMs,
        extractorLatencyMs: result?._debug?.stages?.extractor?.durationMs,
        extractorSkipped: result?.pipeline?.extractorSkipped,
        promptTokens: result?._debug?.promptTokens,
        completionTokens: result?._debug?.completionTokens,
        costUsd: result?._debug?.totalCostUsd,
        model: result?._debug?.model,
        trigger: item.trigger || "manual",
        timestamp: Date.now(),
        error: errorMessage,
      };

      this.state.activityLog = [logEntry, ...this.state.activityLog.slice(0, MAX_ACTIVITY_LOG - 1)];
      this.updateStatsOnResult(Boolean(result), durationMs, result);
      this.saveActivity();

      this.state.batchCompleted++;
      this.notify();

      if (this.state.status !== "paused") {
        if (this.state.queue.length > 0) {
          setTimeout(() => this.pumpQueue(), 120);
        } else if (this.activeCount === 0) {
          this.finishBatch();
        }
      }
    }
  }
}

export const aiQueue = new AiQueueManager();

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
    enqueueNewIncomingEmail: (mail: any, folder?: string) =>
      aiQueue.enqueueNewIncomingEmail(mail, folder),
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
