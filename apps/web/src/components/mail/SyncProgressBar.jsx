import React, { useEffect, useState } from "react";
import { RefreshCw, Database, CheckCircle2, AlertCircle, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SyncProgressBar({
  folder = "inbox",
  isInitialSyncNeeded = false,
  onSyncComplete,
  className = "",
}) {
  const [syncState, setSyncState] = useState({
    isSyncing: false,
    current: 0,
    total: 0,
    message: "",
    error: null,
    totalInDb: 0,
    lastSyncTime: null,
  });

  const [hasStarted, setHasStarted] = useState(false);

  // Poll sync status
  const pollStatus = async () => {
    try {
      const res = await fetch(`/api/sync?folder=${encodeURIComponent(folder)}`);
      if (res.ok) {
        const data = await res.json();
        setSyncState(data);

        // If it was syncing and just completed
        if (hasStarted && !data.isSyncing && data.totalInDb > 0) {
          if (onSyncComplete) onSyncComplete();
        }
      }
    } catch {}
  };

  useEffect(() => {
    pollStatus();
    const interval = setInterval(pollStatus, syncState.isSyncing ? 1000 : 8000);
    return () => clearInterval(interval);
  }, [folder, syncState.isSyncing, hasStarted]);

  // Start initial sync
  const startSync = async () => {
    setHasStarted(true);
    try {
      await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder, blocking: false }),
      });
      pollStatus();
    } catch (e) {
      console.error("Failed to start sync:", e);
    }
  };

  // If initial sync is required and no sync is running, auto-trigger after brief delay
  useEffect(() => {
    if (isInitialSyncNeeded && !syncState.isSyncing && !hasStarted && syncState.totalInDb === 0) {
      startSync();
    }
  }, [isInitialSyncNeeded, syncState.totalInDb]);

  // Format last sync time string
  const formatLastSync = (timestamp) => {
    if (!timestamp) return "Vor kurzem";
    const sec = Math.floor((Date.now() - timestamp) / 1000);
    if (sec < 60) return "Gerade eben";
    const min = Math.floor(sec / 60);
    return `Vor ${min} Min.`;
  };

  const percentage =
    syncState.total > 0
      ? Math.min(100, Math.round((syncState.current / syncState.total) * 100))
      : syncState.isSyncing
      ? 15
      : 100;

  // Discreet Inline Indicator for Background Delta Sync
  return (
    <div className={`inline-flex items-center gap-1.5 text-[11px] text-muted-foreground ${className}`}>
      {syncState.isSyncing ? (
        <span className="flex items-center gap-1 text-primary animate-pulse">
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span className="truncate max-w-[150px]">{syncState.message || "Sync..."}</span>
        </span>
      ) : (
        <button
          onClick={startSync}
          title="Klicken zum sofortigen Abgleich mit IMAP"
          className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
        >
          <Database className="w-3 h-3 text-emerald-500" />
          <span>Lokal synchronisiert ({formatLastSync(syncState.lastSyncTime)})</span>
        </button>
      )}
    </div>
  );
}
