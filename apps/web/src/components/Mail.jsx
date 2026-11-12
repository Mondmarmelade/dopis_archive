import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Inbox,
  Send,
  Archive,
  Trash2,
  AlertOctagon,
  Search,
  RefreshCw,
  Newspaper,
  Settings,
  Sparkles,
  AlignJustify,
  LayoutList,
  Receipt,
  Command,
  X,
  Keyboard,
  HelpCircle,
} from "lucide-react";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { AccountSwitcher } from "./mail/AccountSwitcher";
import { Nav } from "./mail/Nav";
import { MailList } from "./mail/MailList";
import { MailDisplay } from "./mail/MailDisplay";
import { SettingsForm } from "./SettingsForm";
import { AiActivityView } from "./mail/AiActivityView";
import { OrdersAndReceiptsView } from "./mail/OrdersAndReceiptsView";
import { SyncProgressBar } from "./mail/SyncProgressBar";
import { InitialSyncScreen } from "./mail/InitialSyncScreen";
import { CommandPalette } from "./mail/CommandPalette";
import { KeyboardShortcutsModal } from "./mail/KeyboardShortcutsModal";
import { ActionToast } from "./mail/ActionToast";
import { QuickTipsBar } from "./mail/QuickTipsBar";
import {
  getCachedAnalysis,
  setCachedAnalysis,
  toggleCachedActionItem,
  getAiSettings,
} from "@/lib/aiCache";
import { prefetchEmail } from "@/lib/emailCache";
import { aiQueue, useAiQueue } from "@/lib/aiQueue";
import { groupMailsIntoThreads } from "@/lib/threadEngine";

export function Mail({
  defaultLayout = [18, 36, 46],
  defaultCollapsed = false,
  navCollapsedSize = 4,
  defaultView = "mails",
  initialSyncNeeded = null,
  initialAccountEmail = "",
}) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [currentView, setCurrentView] = useState(defaultView); // "mails" | "settings" | "ai-activity"
  const [mails, setMails] = useState([]);
  const [accountEmail, setAccountEmail] = useState(initialAccountEmail);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedFolder, setSelectedFolder] = useState("inbox");
  const [selectedMailId, setSelectedMailId] = useState(null);
  const [isInitialSyncNeeded, setIsInitialSyncNeeded] = useState(() => {
    if (typeof initialSyncNeeded === "boolean") {
      return initialSyncNeeded;
    }
    return true; // Default to true while checking to prevent any flash of the normal email client
  });
  const [initialCheckComplete, setInitialCheckComplete] = useState(
    typeof initialSyncNeeded === "boolean"
  );
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("dopis_mail_view_mode") || "mailspring";
    }
    return "mailspring";
  });

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [actionToast, setActionToast] = useState(null);
  const searchInputRef = useRef(null);
  const lastDeletedOrArchivedMailRef = useRef(null);

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("dopis_mail_view_mode", mode);
    }
  };

  // Hook for AI Queue updates
  const { queue, currentItem } = useAiQueue();

  // In-Memory Stale-While-Revalidate Folder Cache
  const folderCacheRef = useRef({});

  // AI State
  const [aiMap, setAiMap] = useState({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  // Analyze a specific email with the AI API
  const analyzeEmail = useCallback(async (mailItem, fullText = "", fullHtml = "", force = false) => {
    if (!mailItem) return null;
    const id = mailItem.id || mailItem.seq;

    if (!force) {
      const cached = getCachedAnalysis(id);
      if (cached) {
        setAiMap((prev) => ({ ...prev, [id]: cached }));
        return cached;
      }
    }

    const startTime = performance.now();
    try {
      const settings = getAiSettings();
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seq: id,
          folder: currentFolder,
          date: mailItem.date || new Date().toISOString(),
          subject: mailItem.subject || "",
          from: mailItem.name ? `${mailItem.name} <${mailItem.email}>` : mailItem.email || "",
          text: fullText,
          html: fullHtml,
          settings,
        }),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error || `AI API Fehler (${res.status})`);
      }

      const result = await res.json();
      const durationMs = Math.round(performance.now() - startTime);
      setCachedAnalysis(id, result);
      setAiMap((prev) => ({ ...prev, [id]: result }));
      aiQueue.logExternalAnalysis(
        id,
        mailItem.subject || "",
        mailItem.name ? `${mailItem.name} <${mailItem.email}>` : mailItem.email || "",
        result,
        durationMs
      );
      return result;
    } catch (err) {
      const durationMs = Math.round(performance.now() - startTime);
      aiQueue.logExternalAnalysis(
        id,
        mailItem.subject || "",
        mailItem.name ? `${mailItem.name} <${mailItem.email}>` : mailItem.email || "",
        null,
        durationMs,
        err.message
      );
      console.warn(`AI analysis failed for email ${id}:`, err.message);
      throw err;
    }
  }, []);

  // Fetch emails with Stale-While-Revalidate caching pattern
  const fetchEmails = useCallback(async (isManualRefresh = false, folderToLoad = selectedFolder) => {
    const isCached = Boolean(folderCacheRef.current[folderToLoad]);

    if (isManualRefresh) {
      setRefreshing(true);
    } else if (!isCached) {
      setLoading(true);
    }
    setError(null);

    // If virtual newsletter folder and inbox is already cached, instant 0ms display
    if (folderToLoad === "newsletters" && folderCacheRef.current["inbox"]) {
      setMails(folderCacheRef.current["inbox"]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const res = await fetch(`/api/emails?folder=${folderToLoad}`);
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = "/logout";
          return;
        }
        throw new Error(`Server returned status ${res.status}`);
      }
      const data = await res.json();
      if (data.needsInitialSync) {
        setIsInitialSyncNeeded(true);
      } else {
        setIsInitialSyncNeeded(false);
      }
      setInitialCheckComplete(true);
      const fetchedMails = data.msgs || [];

      // Update in-memory cache
      folderCacheRef.current[folderToLoad] = fetchedMails;
      setMails(fetchedMails);
      setAccountEmail(data.account || "");

      // Populate AI map from localStorage cache
      const initialAiMap = {};
      fetchedMails.forEach((m) => {
        const id = m.id || m.seq;
        const cached = getCachedAnalysis(id);
        if (cached) {
          initialAiMap[id] = cached;
        }
      });
      setAiMap((prev) => ({ ...prev, ...initialAiMap }));

      // Auto-select first email in newly loaded folder if none selected
      if (fetchedMails.length > 0) {
        setSelectedMailId((prev) => {
          const exists = fetchedMails.some((m) => String(m.id || m.seq) === String(prev));
          return exists ? prev : (fetchedMails[0].id || fetchedMails[0].seq);
        });

        // Prefetch top 3 emails in background for zero-latency instant opening
        fetchedMails.slice(0, 3).forEach((m) => {
          prefetchEmail(m.id || m.seq, folderToLoad);
        });
      } else {
        setSelectedMailId(null);
      }

      // Schedule background scan in idle time if auto-queue is enabled
      if (aiQueue.getState().isAutoQueueEnabled) {
        aiQueue.enqueueEmails(fetchedMails, { onlyUnread: true, folder: folderToLoad });
      }
    } catch (err) {
      if (!isCached) {
        setError(err.message || "E-Mails konnten nicht geladen werden");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedFolder]);

  // Instant folder switching with SWR Cache
  const handleSelectFolder = useCallback((newFolder) => {
    setCurrentView("mails");
    if (newFolder !== selectedFolder) {
      setSelectedFolder(newFolder);
      setSearchQuery("");
      setActiveTab("all");

      // Check if folder is already cached in memory for INSTANT 0ms switch
      if (newFolder === "newsletters" && folderCacheRef.current["inbox"]) {
        setMails(folderCacheRef.current["inbox"]);
      } else if (folderCacheRef.current[newFolder]) {
        setMails(folderCacheRef.current[newFolder]);
      }
    }
  }, [selectedFolder]);

  useEffect(() => {
    fetchEmails(false, selectedFolder);
  }, [selectedFolder, fetchEmails]);

  // 60-second periodic delta sync with IMAP in background
  useEffect(() => {
    const timer = setInterval(() => {
      fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder: selectedFolder, blocking: false }),
      }).catch(() => {});
    }, 60000);
    return () => clearInterval(timer);
  }, [selectedFolder]);

  // Update AI insights for selected email (loads from cache if available without auto-analyzing)
  useEffect(() => {
    if (!selectedMailId) return;

    const cached = getCachedAnalysis(selectedMailId);
    if (cached) {
      setAiMap((prev) => ({ ...prev, [selectedMailId]: cached }));
    }
    setAiLoading(false);
    setAiError(null);
  }, [selectedMailId]);

  const markMailAsRead = useCallback(async (seq, isRead) => {
    if (!seq) return;

    // Optimistic UI update
    setMails((prev) =>
      prev.map((m) =>
        String(m.id || m.seq) === String(seq) ? { ...m, read: isRead } : m
      )
    );

    // Sync with IMAP
    try {
      await fetch("/api/flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seq, seen: isRead }),
      });
    } catch (err) {
      console.error("Failed to sync read status with IMAP:", err);
    }
  }, []);

  const handleSelectMail = useCallback((id, threadItem) => {
    let targetId = id;
    if (typeof id === "string" && id.startsWith("thread_")) {
      targetId = threadItem?.latestMail?.id || threadItem?.latestMail?.seq || threadItem?.mails?.[0]?.id;
    }
    if (!targetId && threadItem) {
      targetId = threadItem?.latestMail?.id || threadItem?.latestMail?.seq || threadItem?.mails?.[0]?.id;
    }
    setSelectedMailId(targetId);
    const target = mails.find((m) => String(m.id || m.seq) === String(targetId));
    if (target && !target.read) {
      markMailAsRead(targetId, true);
    }
  }, [mails, markMailAsRead]);

  const handleReanalyze = useCallback(async () => {
    if (!selectedMailId) return;
    const target = mails.find((m) => String(m.id || m.seq) === String(selectedMailId));
    if (!target) return;

    setAiLoading(true);
    setAiError(null);

    try {
      const detailRes = await fetch(`/api/email?seq=${selectedMailId}&folder=${selectedFolder}`);
      const detail = detailRes.ok ? await detailRes.json() : null;
      await analyzeEmail(target, detail?.text || "", detail?.html || "", true);
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  }, [selectedMailId, selectedFolder, mails, analyzeEmail]);

  const handleToggleActionItem = useCallback((taskIndex) => {
    if (!selectedMailId) return;
    const updated = toggleCachedActionItem(selectedMailId, taskIndex);
    if (updated) {
      setAiMap((prev) => ({ ...prev, [selectedMailId]: updated }));
    }
  }, [selectedMailId]);

  const handleUndo = useCallback(async () => {
    const item = lastDeletedOrArchivedMailRef.current;
    if (!item || !item.mail) return;

    const restoredMail = item.mail;
    const targetFolder = item.folder;

    if (selectedFolder === targetFolder) {
      setMails((prev) => {
        const next = [restoredMail, ...prev];
        if (folderCacheRef.current[targetFolder]) {
          folderCacheRef.current[targetFolder] = next;
        }
        return next;
      });
      setSelectedMailId(restoredMail.id || restoredMail.seq);
    }

    lastDeletedOrArchivedMailRef.current = null;
    setActionToast({
      id: Date.now(),
      type: "undo",
      message: `Aktion rückgängig gemacht: "${restoredMail.subject || 'E-Mail'}" wiederhergestellt`,
      canUndo: false,
    });

    fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: targetFolder, blocking: false }),
    }).catch(() => {});
  }, [selectedFolder]);

  const moveToTrash = useCallback(async (seq) => {
    if (!seq) return;

    const targetMail = mails.find((m) => String(m.id || m.seq) === String(seq));
    const targetSubject = targetMail?.subject || "E-Mail";

    const remaining = mails.filter((m) => String(m.id || m.seq) !== String(seq));
    setMails(remaining);
    if (folderCacheRef.current[selectedFolder]) {
      folderCacheRef.current[selectedFolder] = remaining;
    }

    if (String(selectedMailId) === String(seq)) {
      setSelectedMailId(remaining.length > 0 ? (remaining[0].id || remaining[0].seq) : null);
    }

    if (targetMail) {
      lastDeletedOrArchivedMailRef.current = { mail: targetMail, folder: selectedFolder, type: "trash" };
      setActionToast({
        id: Date.now(),
        type: "trash",
        message: `"${targetSubject.slice(0, 32)}${targetSubject.length > 32 ? '...' : ''}" in den Papierkorb gelegt`,
        canUndo: true,
      });
    }

    try {
      const res = await fetch("/api/trash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seq,
          folder: selectedFolder,
          permanent: selectedFolder === "trash",
        }),
      });

      if (!res.ok) {
        console.error("Failed to delete email on IMAP:", await res.text());
      }
    } catch (err) {
      console.error("Failed to move email to trash:", err);
    }
  }, [mails, selectedFolder, selectedMailId]);

  const archiveMail = useCallback(async (seq) => {
    if (!seq) return;

    const targetMail = mails.find((m) => String(m.id || m.seq) === String(seq));
    const targetSubject = targetMail?.subject || "E-Mail";

    const remaining = mails.filter((m) => String(m.id || m.seq) !== String(seq));
    setMails(remaining);
    if (folderCacheRef.current[selectedFolder]) {
      folderCacheRef.current[selectedFolder] = remaining;
    }

    if (String(selectedMailId) === String(seq)) {
      setSelectedMailId(remaining.length > 0 ? (remaining[0].id || remaining[0].seq) : null);
    }

    if (targetMail) {
      lastDeletedOrArchivedMailRef.current = { mail: targetMail, folder: selectedFolder, type: "archive" };
      setActionToast({
        id: Date.now(),
        type: "archive",
        message: `"${targetSubject.slice(0, 32)}${targetSubject.length > 32 ? '...' : ''}" archiviert`,
        canUndo: true,
      });
    }

    try {
      const res = await fetch("/api/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seq,
          folder: selectedFolder,
        }),
      });

      if (!res.ok) {
        console.error("Failed to archive email on IMAP:", await res.text());
      }
    } catch (err) {
      console.error("Failed to archive email:", err);
    }
  }, [mails, selectedFolder, selectedMailId]);

  const toggleStar = useCallback(async (seq) => {
    if (!seq) return;
    const mail = mails.find((m) => String(m.id || m.seq) === String(seq));
    const newFlagged = !mail?.flagged;

    setMails((prev) =>
      prev.map((m) =>
        String(m.id || m.seq) === String(seq) ? { ...m, flagged: newFlagged } : m
      )
    );

    try {
      await fetch("/api/flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seq, flagged: newFlagged, folder: selectedFolder }),
      });
    } catch (err) {
      console.error("Failed to sync star flag with IMAP:", err);
    }
  }, [mails, selectedFolder]);

  // Memoized enriched mails list
  const enrichedMails = useMemo(() => {
    return mails.map((m) => {
      const id = m.id || m.seq;
      return {
        ...m,
        ai: aiMap[id] || null,
      };
    });
  }, [mails, aiMap]);

  // Group enriched mails into threads (Smart Orders + Subject Conversations)
  const threads = useMemo(() => {
    return groupMailsIntoThreads(enrichedMails, aiMap);
  }, [enrichedMails, aiMap]);

  // Filtered threads list
  const filteredThreads = useMemo(() => {
    return threads.filter((thread) => {
      if (activeTab === "unread" && !thread.hasUnread) {
        return false;
      }

      if (selectedFolder === "newsletters") {
        const isNewsletter = thread.mails.some((m) => {
          const cat = m.ai?.category?.toLowerCase();
          return (
            cat === "newsletter" ||
            cat === "werbung" ||
            cat === "angebote" ||
            m.subject?.toLowerCase().includes("newsletter")
          );
        });
        if (!isNewsletter) return false;
      }

      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const match = thread.mails.some((mail) => {
          const matchSubject = mail.subject?.toLowerCase().includes(q);
          const matchName = mail.name?.toLowerCase().includes(q);
          const matchEmail = mail.email?.toLowerCase().includes(q);
          const matchCategory = mail.ai?.category?.toLowerCase().includes(q);
          const matchTags = mail.ai?.tags?.some((t) => t.toLowerCase().includes(q));
          const matchProduct = thread.orderJourney?.productSummary?.toLowerCase().includes(q);
          const matchMerchant = thread.orderJourney?.merchant?.toLowerCase().includes(q);
          const matchOrder = thread.orderJourney?.orderId?.toLowerCase().includes(q);
          const matchTracking = thread.orderJourney?.trackingNumber?.toLowerCase().includes(q);
          const matchPayment = thread.orderJourney?.paymentProvider?.toLowerCase().includes(q);
          const matchVenue = thread.orderJourney?.venue?.toLowerCase().includes(q);
          const matchEvent = thread.orderJourney?.eventDate?.toLowerCase().includes(q);
          const matchAmount = thread.orderJourney?.amount?.toLowerCase().includes(q);
          return (
            matchSubject ||
            matchName ||
            matchEmail ||
            matchCategory ||
            matchTags ||
            matchProduct ||
            matchMerchant ||
            matchOrder ||
            matchTracking ||
            matchPayment ||
            matchVenue ||
            matchEvent ||
            matchAmount
          );
        });
        if (!match) return false;
      }

      return true;
    });
  }, [threads, activeTab, selectedFolder, searchQuery]);

  const unreadCount = useMemo(() => mails.filter((m) => !m.read).length, [mails]);

  const selectedSummaryMail = useMemo(() => {
    return mails.find((m) => String(m.id || m.seq) === String(selectedMailId));
  }, [mails, selectedMailId]);

  const activeThread = useMemo(() => {
    if (!selectedMailId) return null;
    return threads.find((t) =>
      t.mails.some((m) => String(m.id || m.seq) === String(selectedMailId))
    ) || null;
  }, [threads, selectedMailId]);

  const currentAiAnalysis = selectedMailId ? aiMap[selectedMailId] || null : null;

  const folderTitle =
    selectedFolder === "inbox"
      ? "Posteingang"
      : selectedFolder === "newsletters"
      ? "Newsletter"
      : selectedFolder === "junk"
      ? "Spam"
      : selectedFolder === "archive"
      ? "Archiv"
      : selectedFolder === "trash"
      ? "Papierkorb"
      : "Postfach";

  const handleNavigateNext = useCallback(() => {
    if (!filteredThreads || filteredThreads.length === 0) return;
    const currentIndex = filteredThreads.findIndex((t) => {
      const mainId = t.latestMail?.id || t.latestMail?.seq || t.id || t.seq;
      return (
        String(mainId) === String(selectedMailId) ||
        (t.mails && t.mails.some((m) => String(m.id || m.seq) === String(selectedMailId)))
      );
    });

    const nextIndex = currentIndex < filteredThreads.length - 1 ? currentIndex + 1 : 0;
    const nextThread = filteredThreads[nextIndex];
    const targetId =
      nextThread.latestMail?.id ||
      nextThread.latestMail?.seq ||
      nextThread.mails?.[0]?.id ||
      nextThread.id ||
      nextThread.seq;

    handleSelectMail(targetId, nextThread);

    setTimeout(() => {
      const el = document.getElementById(`mail-item-${targetId}`);
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 50);
  }, [filteredThreads, selectedMailId, handleSelectMail]);

  const handleNavigatePrev = useCallback(() => {
    if (!filteredThreads || filteredThreads.length === 0) return;
    const currentIndex = filteredThreads.findIndex((t) => {
      const mainId = t.latestMail?.id || t.latestMail?.seq || t.id || t.seq;
      return (
        String(mainId) === String(selectedMailId) ||
        (t.mails && t.mails.some((m) => String(m.id || m.seq) === String(selectedMailId)))
      );
    });

    const prevIndex = currentIndex > 0 ? currentIndex - 1 : filteredThreads.length - 1;
    const prevThread = filteredThreads[prevIndex];
    const targetId =
      prevThread.latestMail?.id ||
      prevThread.latestMail?.seq ||
      prevThread.mails?.[0]?.id ||
      prevThread.id ||
      prevThread.seq;

    handleSelectMail(targetId, prevThread);

    setTimeout(() => {
      const el = document.getElementById(`mail-item-${targetId}`);
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 50);
  }, [filteredThreads, selectedMailId, handleSelectMail]);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // 1. Command Palette: Cmd+K / Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Check if user is typing inside an input, textarea or contentEditable
      const targetTag = e.target?.tagName?.toLowerCase();
      const isInput = targetTag === "input" || targetTag === "textarea" || e.target?.isContentEditable;

      if (isInput) {
        if (e.key === "Escape") {
          e.target.blur();
        }
        return;
      }

      // 2. Escape closes modals or clears search
      if (e.key === "Escape") {
        if (isCommandPaletteOpen) {
          setIsCommandPaletteOpen(false);
          return;
        }
        if (isShortcutsModalOpen) {
          setIsShortcutsModalOpen(false);
          return;
        }
        if (searchQuery) {
          setSearchQuery("");
          return;
        }
      }

      // 3. Quick help with '?'
      if (e.key === "?") {
        e.preventDefault();
        setIsShortcutsModalOpen(true);
        return;
      }

      // 4. Focus search with '/'
      if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // 5. Undo with Cmd+Z or Ctrl+Z
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
        return;
      }

      // 6. Navigation: 'j' or ArrowDown / 'k' or ArrowUp
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        handleNavigateNext();
        return;
      }
      if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        handleNavigatePrev();
        return;
      }

      // 7. Actions on selected email
      if (e.key === "e") {
        if (selectedMailId) {
          e.preventDefault();
          archiveMail(selectedMailId);
        }
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace" || e.key === "#") {
        if (selectedMailId) {
          e.preventDefault();
          moveToTrash(selectedMailId);
        }
        return;
      }
      if (e.key.toLowerCase() === "u") {
        if (selectedMailId && selectedSummaryMail) {
          e.preventDefault();
          markMailAsRead(selectedMailId, !selectedSummaryMail.read);
        }
        return;
      }
      if (e.key.toLowerCase() === "s") {
        if (selectedMailId) {
          e.preventDefault();
          toggleStar(selectedMailId);
        }
        return;
      }
      if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        fetchEmails(true, selectedFolder);
        return;
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [
    isCommandPaletteOpen,
    isShortcutsModalOpen,
    searchQuery,
    selectedMailId,
    selectedSummaryMail,
    handleNavigateNext,
    handleNavigatePrev,
    archiveMail,
    moveToTrash,
    markMailAsRead,
    toggleStar,
    fetchEmails,
    selectedFolder,
    handleUndo,
  ]);

  // When initial sync is required: completely clean, dedicated full-screen with progress bar
  if (isInitialSyncNeeded) {
    return (
      <InitialSyncScreen
        folder={selectedFolder}
        onComplete={() => {
          setIsInitialSyncNeeded(false);
          fetchEmails(true, selectedFolder);
        }}
        onCancel={() => {
          setIsInitialSyncNeeded(false);
          fetchEmails(true, selectedFolder);
        }}
      />
    );
  }

  return (
    <TooltipProvider delayDuration={0}>
      <ResizablePanelGroup
        direction="horizontal"
        className="h-screen w-screen items-stretch overflow-hidden bg-background"
      >
        {/* Left Column: Navigation Sidebar (Always persistent) */}
        <ResizablePanel
          defaultSize={defaultLayout[0]}
          collapsedSize={navCollapsedSize}
          collapsible={true}
          minSize={14}
          maxSize={24}
          onCollapse={() => setIsCollapsed(true)}
          onResize={() => setIsCollapsed(false)}
          className={cn(
            isCollapsed && "min-w-[50px] transition-all duration-200 ease-in-out",
            "border-r bg-muted/20 select-none"
          )}
        >
          <AccountSwitcher isCollapsed={isCollapsed} accountEmail={accountEmail} />
          <Separator />
          <Nav
            isCollapsed={isCollapsed}
            links={[
              {
                title: "Posteingang",
                label: currentView === "mails" && selectedFolder === "inbox" && unreadCount > 0 ? String(unreadCount) : "",
                icon: Inbox,
                variant: currentView === "mails" && selectedFolder === "inbox" ? "default" : "ghost",
                onClick: () => handleSelectFolder("inbox"),
              },
              {
                title: "Newsletter",
                label: "",
                icon: Newspaper,
                variant: currentView === "mails" && selectedFolder === "newsletters" ? "default" : "ghost",
                onClick: () => handleSelectFolder("newsletters"),
              },
              {
                title: "Spam",
                label: "",
                icon: AlertOctagon,
                variant: currentView === "mails" && selectedFolder === "junk" ? "default" : "ghost",
                onClick: () => handleSelectFolder("junk"),
              },
              {
                title: "Archiv",
                label: "",
                icon: Archive,
                variant: currentView === "mails" && selectedFolder === "archive" ? "default" : "ghost",
                onClick: () => handleSelectFolder("archive"),
              },
              {
                title: "Papierkorb",
                label: "",
                icon: Trash2,
                variant: currentView === "mails" && selectedFolder === "trash" ? "default" : "ghost",
                onClick: () => handleSelectFolder("trash"),
              },
            ]}
          />
          <Separator className="mt-auto" />
          <Nav
            isCollapsed={isCollapsed}
            links={[
              {
                title: "KI-Aktivität",
                label: queue.length > 0 || currentItem ? `${queue.length + (currentItem ? 1 : 0)} aktiv` : "",
                icon: Sparkles,
                variant: currentView === "ai-activity" ? "default" : "ghost",
                dot: Boolean(currentItem || queue.length > 0),
                onClick: () => {
                  setCurrentView("ai-activity");
                },
              },
              {
                title: "Bestellungen & Belege",
                label: "",
                icon: Receipt,
                variant: currentView === "orders-receipts" ? "default" : "ghost",
                onClick: () => {
                  setCurrentView("orders-receipts");
                },
              },
              {
                title: "Einstellungen",
                label: "",
                icon: Settings,
                variant: currentView === "settings" ? "default" : "ghost",
                onClick: () => {
                  setCurrentView("settings");
                },
              },
              {
                title: "Tastaturkürzel",
                label: "?",
                icon: Keyboard,
                variant: "ghost",
                onClick: () => {
                  setIsShortcutsModalOpen(true);
                },
              },
            ]}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Main Content Area: Switches between Mails View, Settings View, AI Activity View, and Orders & Receipts View */}
        {currentView === "settings" ? (
          <ResizablePanel defaultSize={defaultLayout[1] + defaultLayout[2]} minSize={50} className="bg-background">
            <div className="h-full overflow-hidden flex flex-col">
              <SettingsForm onBack={() => setCurrentView("mails")} />
            </div>
          </ResizablePanel>
        ) : currentView === "orders-receipts" ? (
          <ResizablePanel defaultSize={defaultLayout[1] + defaultLayout[2]} minSize={50} className="bg-background">
            <div className="h-full overflow-hidden flex flex-col">
              <OrdersAndReceiptsView
                onSelectMail={(seq) => {
                  setCurrentView("mails");
                  setSelectedMailId(Number(seq));
                }}
                onClose={() => setCurrentView("mails")}
              />
            </div>
          </ResizablePanel>
        ) : currentView === "ai-activity" ? (
          <ResizablePanel defaultSize={defaultLayout[1] + defaultLayout[2]} minSize={50} className="bg-background">
            <div className="h-full overflow-y-auto">
              <AiActivityView
                currentFolder={selectedFolder}
                folderMails={mails}
                onBack={() => setCurrentView("mails")}
              />
            </div>
          </ResizablePanel>
        ) : (
          <>
            {/* Middle Column: Mail List with Search & Tabs */}
            <ResizablePanel defaultSize={defaultLayout[1]} minSize={25} maxSize={45} className="border-r">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
                <div className="flex h-[52px] items-center justify-between px-4 shrink-0 border-b">
                  <div className="flex items-center gap-2 min-w-0">
                    <h1 className="text-sm font-semibold tracking-tight flex items-center gap-1.5 shrink-0 text-foreground">
                      {folderTitle}
                      {mails.length > 0 && (
                        <span className="text-[11px] text-muted-foreground font-mono font-normal">
                          {mails.length}
                        </span>
                      )}
                    </h1>
                    <SyncProgressBar
                      folder={selectedFolder}
                      isInitialSyncNeeded={isInitialSyncNeeded}
                      onSyncComplete={() => {
                        setIsInitialSyncNeeded(false);
                        fetchEmails(true, selectedFolder);
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/* View Style Switcher: Compact vs Cards */}
                    <div className="flex items-center rounded-lg border border-border/70 bg-muted/40 p-0.5 h-7.5">
                      <button
                        type="button"
                        onClick={() => handleViewModeChange("mailspring")}
                        className={cn(
                          "h-6.5 w-6.5 rounded-md flex items-center justify-center transition-all cursor-pointer",
                          viewMode === "mailspring"
                            ? "bg-background text-foreground shadow-2xs"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        title="Kompaktansicht"
                      >
                        <AlignJustify className="h-3.5 w-3.5" />
                        <span className="sr-only">Kompakt</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleViewModeChange("cards")}
                        className={cn(
                          "h-6.5 w-6.5 rounded-md flex items-center justify-center transition-all cursor-pointer",
                          viewMode === "cards"
                            ? "bg-background text-foreground shadow-2xs"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        title="Kartenansicht"
                      >
                        <LayoutList className="h-3.5 w-3.5" />
                        <span className="sr-only">Karten</span>
                      </button>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7.5 w-7.5 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer transition-transform active:scale-95"
                      onClick={() => fetchEmails(true, selectedFolder)}
                      disabled={refreshing || loading}
                      title="Postfach aktualisieren (R)"
                    >
                      <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin text-primary")} />
                      <span className="sr-only">Aktualisieren</span>
                    </Button>

                    <TabsList className="h-7.5 bg-muted/40 p-0.5 border border-border/60 rounded-lg">
                      <TabsTrigger value="all" className="text-xs px-2.5 h-6.5 rounded-md cursor-pointer">
                        Alle
                      </TabsTrigger>
                      <TabsTrigger value="unread" className="text-xs px-2.5 h-6.5 rounded-md cursor-pointer">
                        Ungelesen {unreadCount > 0 && `(${unreadCount})`}
                      </TabsTrigger>
                    </TabsList>
                  </div>
                </div>

                {/* Search Input Capsule with Shortcut Badge */}
                <div className="p-3 pb-1.5 shrink-0">
                  <div className="relative flex items-center">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      ref={searchInputRef}
                      placeholder={`In ${folderTitle} suchen... (Taste /)`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-14 h-8 text-xs bg-muted/30 hover:bg-muted/50 focus-visible:bg-background border-border/70 focus-visible:border-primary/40 rounded-xl transition-all shadow-2xs"
                    />
                    <div className="absolute right-2 flex items-center gap-1">
                      {searchQuery ? (
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          className="text-muted-foreground hover:text-foreground cursor-pointer p-0.5 rounded transition-colors"
                          title="Suche zurücksetzen (Esc)"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsCommandPaletteOpen(true)}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-mono text-muted-foreground bg-muted/80 border border-border/80 hover:text-foreground cursor-pointer transition-colors"
                          title="Befehlsmenü öffnen"
                        >
                          <span>⌘K</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Onboarding / Tips Bar */}
                <QuickTipsBar onOpenShortcuts={() => setIsShortcutsModalOpen(true)} />

                {/* Mail Items Scrollable Area */}
                <div className="flex-1 overflow-y-auto">
                  {loading && mails.length === 0 ? (
                    <div className="flex h-64 flex-col items-center justify-center p-8 text-muted-foreground">
                      <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                      <p className="mt-3 text-xs">{folderTitle} wird synchronisiert...</p>
                    </div>
                  ) : error && mails.length === 0 ? (
                    <div className="flex h-64 flex-col items-center justify-center p-8 text-center text-destructive">
                      <p className="text-sm font-medium">E-Mails konnten nicht geladen werden</p>
                      <p className="mt-1 text-xs text-muted-foreground">{error}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4 cursor-pointer"
                        onClick={() => fetchEmails(false, selectedFolder)}
                      >
                        Erneut versuchen
                      </Button>
                    </div>
                  ) : (
                    <TabsContent value={activeTab} className="m-0 border-0 outline-none">
                      <MailList
                        items={filteredThreads}
                        selectedMailId={selectedMailId}
                        onSelectMail={handleSelectMail}
                        viewMode={viewMode}
                        folder={selectedFolder}
                        searchQuery={searchQuery}
                        onClearSearch={() => setSearchQuery("")}
                        onToggleRead={(seq, isRead) => markMailAsRead(seq, isRead)}
                        onMoveToTrash={(seq) => moveToTrash(seq)}
                        onArchive={(seq) => archiveMail(seq)}
                        onToggleStar={(seq) => toggleStar(seq)}
                      />
                    </TabsContent>
                  )}
                </div>
              </Tabs>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Right Column: Mail Detail Display with AI Insights & Thread Stream */}
            <ResizablePanel defaultSize={defaultLayout[2]} minSize={30}>
              <MailDisplay
                selectedMailId={selectedMailId}
                summaryMail={selectedSummaryMail}
                thread={activeThread}
                onSelectMailInThread={handleSelectMail}
                isRead={selectedSummaryMail ? selectedSummaryMail.read : false}
                currentFolder={selectedFolder}
                aiAnalysis={currentAiAnalysis}
                aiLoading={aiLoading || Boolean(currentItem && String(currentItem.id) === String(selectedMailId))}
                aiError={aiError}
                onReanalyze={handleReanalyze}
                onToggleActionItem={handleToggleActionItem}
                onOpenShortcutsModal={() => setIsShortcutsModalOpen(true)}
                onToggleRead={() => {
                  if (selectedSummaryMail) {
                    markMailAsRead(selectedMailId, !selectedSummaryMail.read);
                  }
                }}
                onMoveToTrash={() => {
                  if (selectedMailId) {
                    moveToTrash(selectedMailId);
                  }
                }}
                onArchive={() => {
                  if (selectedMailId) {
                    archiveMail(selectedMailId);
                  }
                }}
              />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>

      {/* Global Command Palette (Cmd+K / Ctrl+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectFolder={handleSelectFolder}
        onRefresh={() => fetchEmails(true, selectedFolder)}
        onToggleViewMode={handleViewModeChange}
        viewMode={viewMode}
        onOpenSettings={() => setCurrentView("settings")}
        onOpenAiActivity={() => setCurrentView("ai-activity")}
        onOpenOrdersReceipts={() => setCurrentView("orders-receipts")}
        onOpenShortcutsModal={() => setIsShortcutsModalOpen(true)}
        selectedMail={selectedSummaryMail}
        onArchiveMail={archiveMail}
        onTrashMail={moveToTrash}
        onToggleReadMail={markMailAsRead}
      />

      {/* Keyboard Shortcuts Cheat Sheet Modal (?) */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      {/* Superhuman-style Undo Action Toast */}
      <ActionToast
        toast={actionToast}
        onUndo={handleUndo}
        onDismiss={() => setActionToast(null)}
      />
    </TooltipProvider>
  );
}
