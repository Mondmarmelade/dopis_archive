import React, { useEffect, useState, useRef } from "react";
import {
  Mail,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Paperclip,
  Sparkles,
  ArrowRight,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SenderAvatar } from "./SenderAvatar";
import { cn } from "@/lib/utils";

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function InitialSyncScreen({
  folder = "inbox",
  onComplete,
  onCancel,
}) {
  const [syncState, setSyncState] = useState({
    isSyncing: true,
    current: 0,
    total: 0,
    message: "Verbinde mit E-Mail-Konto...",
    error: null,
    totalInDb: 0,
    recentEmails: [],
  });

  const [feedQueue, setFeedQueue] = useState([]);
  const [displayedCards, setDisplayedCards] = useState([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const seenSeqsRef = useRef(new Set());
  const completedTriggeredRef = useRef(false);

  // Poll status from /api/sync
  const pollStatus = async () => {
    try {
      const res = await fetch(`/api/sync?folder=${encodeURIComponent(folder)}`);
      if (res.status === 401) {
        setSyncState((prev) => ({
          ...prev,
          isSyncing: false,
          error: "Sitzung nicht autorisiert oder abgelaufen. Bitte erneut anmelden.",
        }));
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setSyncState(data);

        // Queue newly parsed emails to be fed one by one onto the vertical conveyor belt
        if (Array.isArray(data.recentEmails) && data.recentEmails.length > 0) {
          const fresh = data.recentEmails.filter(
            (item) => item && item.seq && !seenSeqsRef.current.has(item.seq)
          );
          if (fresh.length > 0) {
            fresh.forEach((item) => seenSeqsRef.current.add(item.seq));
            setFeedQueue((prev) => [...prev, ...fresh]);
          }
        }

        // When sync finishes and has completed at least one pass
        if (
          !data.isSyncing &&
          (data.totalInDb > 0 || data.lastSyncTime) &&
          !completedTriggeredRef.current
        ) {
          completedTriggeredRef.current = true;
          setIsCompleted(true);
          setTimeout(() => {
            if (onComplete) onComplete();
          }, 900);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        setSyncState((prev) => ({
          ...prev,
          isSyncing: false,
          error: errData.error || `Server-Fehler (${res.status})`,
        }));
      }
    } catch (err) {
      // Network failure
    }
  };

  const startSync = async () => {
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder, blocking: false }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSyncState((prev) => ({
          ...prev,
          isSyncing: false,
          error: data.error || `Verbindungsfehler (${res.status})`,
        }));
      }
      pollStatus();
    } catch (err) {
      console.error("Initial sync trigger error:", err);
      setSyncState((prev) => ({
        ...prev,
        isSyncing: false,
        error: String(err?.message || err),
      }));
    }
  };

  // Abort ongoing sync and jump directly into the inbox
  const handleAbortAndContinue = async () => {
    try {
      await fetch(`/api/sync?folder=${encodeURIComponent(folder)}`, {
        method: "DELETE",
      });
    } catch {}
    if (onComplete) {
      onComplete();
    } else if (onCancel) {
      onCancel();
    } else {
      window.location.reload();
    }
  };

  // Abort and go to login/logout
  const handleCancelAndLogout = async () => {
    try {
      await fetch(`/api/sync?folder=${encodeURIComponent(folder)}`, {
        method: "DELETE",
      });
    } catch {}
    window.location.href = "/logout";
  };

  useEffect(() => {
    startSync();
  }, []);

  // Poll every 600ms while syncing, 2s if idle
  useEffect(() => {
    const interval = setInterval(pollStatus, syncState.isSyncing ? 600 : 2000);
    return () => clearInterval(interval);
  }, [folder, syncState.isSyncing]);

  // Smoothly dispatch cards from queue onto vertical stream every 650ms
  useEffect(() => {
    if (feedQueue.length === 0) return;

    const timer = setTimeout(() => {
      setFeedQueue((prev) => {
        if (prev.length === 0) return prev;
        const [nextItem, ...remaining] = prev;
        // Keep up to 4 latest cards in the vertical stream
        setDisplayedCards((current) => [...current.slice(-3), nextItem]);
        return remaining;
      });
    }, 650);

    return () => clearTimeout(timer);
  }, [feedQueue]);

  const percentage = isCompleted
    ? 100
    : syncState.total > 0
    ? Math.min(100, Math.round((syncState.current / syncState.total) * 100))
    : syncState.isSyncing
    ? 8
    : 100;

  return (
    <div className="fixed inset-0 z-50 min-h-screen w-screen bg-background flex items-center justify-center p-6 md:p-10 select-none animate-in fade-in duration-300 overflow-hidden">
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-14 items-center">
        
        {/* Left Column: Hero, Status & Progress */}
        <div className="md:col-span-6 lg:col-span-5 flex flex-col items-center md:items-start text-center md:text-left space-y-6">
          
          {/* Animated Glow Icon */}
          <div className="relative flex items-center justify-center">
            <div
              className={cn(
                "absolute w-20 h-20 rounded-full animate-ping duration-1000 opacity-50",
                isCompleted ? "bg-emerald-500/20" : "bg-primary/15"
              )}
            />
            <div
              className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-500",
                isCompleted
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-emerald-500/10 scale-105"
                  : "bg-primary/15 text-primary shadow-primary/5"
              )}
            >
              {isCompleted ? (
                <CheckCircle2 className="w-8 h-8 text-emerald-500 animate-in zoom-in-75 duration-300" />
              ) : (
                <Mail className="w-8 h-8 animate-pulse text-primary" />
              )}
            </div>
          </div>

          {/* Headline & Subtitle */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {isCompleted ? "Synchronisation abgeschlossen" : "E-Mails werden synchronisiert"}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {isCompleted
                ? `${syncState.total || syncState.totalInDb} E-Mails erfolgreich in deiner lokalen Datenbank bereitgestellt.`
                : syncState.message || "Dein Postfach wird geladen und lokal indexiert..."}
            </p>
          </div>

          {/* Progress Bar & Counters */}
          <div className="w-full space-y-2.5 pt-2">
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300 ease-out shadow-xs",
                  isCompleted ? "bg-emerald-500" : "bg-primary"
                )}
                style={{ width: `${percentage}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground font-mono px-0.5">
              <span>
                {syncState.total > 0
                  ? `${syncState.current} von ${syncState.total} E-Mails`
                  : syncState.message || "Verbindungsaufbau..."}
              </span>
              <span className={cn("font-semibold text-sm", isCompleted && "text-emerald-500")}>
                {percentage}%
              </span>
            </div>
          </div>

          {/* Action Buttons: Cancel & Skip */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1 w-full justify-center md:justify-start">
            <Button
              size="sm"
              variant="outline"
              onClick={handleAbortAndContinue}
              className="text-xs h-8 gap-1.5 font-medium border-border/80 shadow-xs hover:bg-muted"
              title="Synchronisation abbrechen und direkt zum Postfach wechseln"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              Abbrechen & zum Postfach
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancelAndLogout}
              className="text-xs h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1.5"
              title="Abbrechen und zu den Anmeldeeinstellungen zurückkehren"
            >
              <X className="w-3.5 h-3.5" />
              Abbrechen & Abmelden
            </Button>
          </div>

          {/* Live Feature Badges */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1 text-xs text-muted-foreground">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/50 border border-border/60">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Database-First</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/50 border border-border/60">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Echtzeit-Import</span>
            </div>
          </div>

          {/* Error Banner if sync error */}
          {syncState.error && (
            <div className="w-full space-y-3 pt-2">
              <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-xs flex items-center gap-2 text-left">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{syncState.error}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={startSync} variant="outline" className="gap-2 text-xs">
                  <RefreshCw className="w-3.5 h-3.5" /> Erneut versuchen
                </Button>
                <Button size="sm" onClick={handleAbortAndContinue} variant="default" className="gap-2 text-xs">
                  <ArrowRight className="w-3.5 h-3.5" /> Trotzdem zum Postfach
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Tilted Vertical Upward Conveyor Belt Stream */}
        <div className="md:col-span-6 lg:col-span-7 flex justify-center md:justify-end items-center relative">
          
          {/* Tilted Stage Container with 3D Perspective and inward rotation */}
          <div
            className="w-full max-w-[360px] sm:max-w-[400px] h-[440px] sm:h-[480px] relative overflow-hidden transition-transform duration-500 origin-center"
            style={{
              maskImage:
                "linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%)",
              transform: "perspective(1000px) rotateY(-4deg) rotateZ(-3deg)",
            }}
          >
            {/* Vertical Stream Moving Upward */}
            <div className="absolute inset-0 flex flex-col justify-end gap-3.5 p-3 overflow-hidden">
              {displayedCards.length === 0 ? (
                // 3 Tilted Skeleton Cards while connecting
                [1, 2, 3].map((n) => (
                  <div
                    key={`skel-${n}`}
                    className="w-full p-3.5 rounded-2xl border border-dashed border-border/70 bg-card/60 flex flex-col gap-2.5 animate-pulse shadow-sm"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-muted shrink-0" />
                      <div className="h-3 w-28 bg-muted rounded" />
                      <div className="h-2.5 w-10 bg-muted rounded ml-auto" />
                    </div>
                    <div className="h-3.5 w-3/4 bg-muted rounded" />
                    <div className="flex items-center justify-between pt-0.5">
                      <div className="h-2.5 w-36 bg-muted rounded" />
                      <div className="h-4 w-16 bg-muted rounded-full" />
                    </div>
                  </div>
                ))
              ) : (
                // Live Stream Cards entering at the bottom and flowing upward
                displayedCards.map((card, idx) => {
                  const isLatest = idx === displayedCards.length - 1;
                  return (
                    <div
                      key={card.seq ? `seq-${card.seq}` : `card-${idx}`}
                      className={cn(
                        "w-full p-3.5 rounded-2xl border bg-card/95 text-left transition-all duration-500 flex flex-col gap-2 shadow-md backdrop-blur-md animate-in fade-in slide-in-from-bottom-8 duration-500",
                        isLatest
                          ? "border-primary/50 ring-2 ring-primary/20 shadow-xl shadow-primary/10 scale-[1.02] z-10"
                          : "border-border/75 opacity-85 z-0"
                      )}
                    >
                      {/* Top Row: SenderAvatar + Sender Name + Date */}
                      <div className="flex items-center gap-2.5">
                        <SenderAvatar
                          email={card.senderEmail}
                          name={card.senderName}
                          size="sm"
                          shape="circle"
                        />
                        <span className="font-semibold text-xs text-foreground truncate flex-1 min-w-0">
                          {card.senderName || card.senderEmail || "Unbekannt"}
                        </span>
                        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 font-mono">
                          {formatDate(card.date)}
                        </span>
                      </div>

                      {/* Middle Row: Subject */}
                      <div className="font-medium text-xs text-foreground truncate">
                        {card.subject || "(Kein Betreff)"}
                      </div>

                      {/* Bottom Row: Snippet Preview + Live Status Chip */}
                      <div className="flex items-center justify-between gap-2 text-[10px]">
                        <span className="text-muted-foreground truncate flex-1 min-w-0">
                          {card.snippet || "Keine Textvorschau..."}
                        </span>

                        {card.hasAttachments ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0 shadow-2xs">
                            <Paperclip className="w-2.5 h-2.5" />
                            Beleg
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0 shadow-2xs">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Importiert
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
