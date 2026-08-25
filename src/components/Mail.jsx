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
import {
  getCachedAnalysis,
  setCachedAnalysis,
  toggleCachedActionItem,
  getAiSettings,
} from "@/lib/aiCache";

export function Mail({
  defaultLayout = [18, 36, 46],
  defaultCollapsed = false,
  navCollapsedSize = 4,
  defaultView = "mails",
}) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [currentView, setCurrentView] = useState(defaultView); // "mails" | "settings"
  const [mails, setMails] = useState([]);
  const [accountEmail, setAccountEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedFolder, setSelectedFolder] = useState("inbox");
  const [selectedMailId, setSelectedMailId] = useState(null);

  // In-Memory Stale-While-Revalidate Folder Cache
  const folderCacheRef = useRef({});

  // AI State
  const [aiMap, setAiMap] = useState({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const isAnalyzingQueue = useRef(false);

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

    try {
      const settings = getAiSettings();
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: mailItem.subject || "",
          from: mailItem.name ? `${mailItem.name} <${mailItem.email}>` : mailItem.email || "",
          text: fullText,
          html: fullHtml,
          settings,
        }),
      });

      if (!res.ok) {
        throw new Error(`AI API error (${res.status})`);
      }

      const result = await res.json();
      setCachedAnalysis(id, result);
      setAiMap((prev) => ({ ...prev, [id]: result }));
      return result;
    } catch (err) {
      console.warn(`AI analysis failed for email ${id}:`, err.message);
      throw err;
    }
  }, []);

  // Idle Background Queue for unanalyzed emails (never blocks UI)
  const processUnanalyzedQueue = useCallback((items) => {
    if (isAnalyzingQueue.current || !items || items.length === 0) return;

    const runQueue = async () => {
      isAnalyzingQueue.current = true;
      try {
        const unanalyzed = items.filter((m) => {
          const id = m.id || m.seq;
          return !getCachedAnalysis(id) && !aiMap[id];
        }).slice(0, 8);

        for (const item of unanalyzed) {
          try {
            await analyzeEmail(item, "", "", false);
          } catch {
            // continue
          }
        }
      } finally {
        isAnalyzingQueue.current = false;
      }
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      window.requestIdleCallback(() => runQueue(), { timeout: 3000 });
    } else {
      setTimeout(runQueue, 500);
    }
  }, [aiMap, analyzeEmail]);

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
      } else {
        setSelectedMailId(null);
      }

      // Schedule background scan in idle time
      processUnanalyzedQueue(fetchedMails);
    } catch (err) {
      if (!isCached) {
        setError(err.message || "Failed to load emails");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedFolder, processUnanalyzedQueue]);

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

  // Immediate analysis for selected email
  useEffect(() => {
    if (!selectedMailId || currentView !== "mails") return;

    const target = mails.find((m) => String(m.id || m.seq) === String(selectedMailId));
    if (!target) return;

    const cached = getCachedAnalysis(selectedMailId) || aiMap[selectedMailId];
    if (!cached) {
      setAiLoading(true);
      setAiError(null);

      fetch(`/api/email?seq=${selectedMailId}&folder=${selectedFolder}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((detail) => {
          return analyzeEmail(target, detail?.text || "", detail?.html || "", false);
        })
        .then(() => {
          setAiLoading(false);
        })
        .catch((err) => {
          setAiError(err.message);
          setAiLoading(false);
        });
    } else {
      setAiLoading(false);
      setAiError(null);
    }
  }, [selectedMailId, currentView, selectedFolder, mails, aiMap, analyzeEmail]);

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

  const handleSelectMail = useCallback((id) => {
    setSelectedMailId(id);
    const target = mails.find((m) => String(m.id || m.seq) === String(id));
    if (target && !target.read) {
      markMailAsRead(id, true);
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

  const moveToTrash = useCallback(async (seq) => {
    if (!seq) return;

    const remaining = mails.filter((m) => String(m.id || m.seq) !== String(seq));
    setMails(remaining);
    if (folderCacheRef.current[selectedFolder]) {
      folderCacheRef.current[selectedFolder] = remaining;
    }

    if (String(selectedMailId) === String(seq)) {
      setSelectedMailId(remaining.length > 0 ? (remaining[0].id || remaining[0].seq) : null);
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

  // Memoized filtered mails list
  const filteredMails = useMemo(() => {
    return enrichedMails.filter((mail) => {
      if (activeTab === "unread" && mail.read) {
        return false;
      }

      if (selectedFolder === "newsletters") {
        const cat = mail.ai?.category?.toLowerCase();
        const isNewsletterOrPromo =
          cat === "newsletter" ||
          cat === "werbung" ||
          cat === "angebote" ||
          mail.subject?.toLowerCase().includes("newsletter");
        if (!isNewsletterOrPromo) return false;
      }

      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const matchSubject = mail.subject?.toLowerCase().includes(q);
        const matchName = mail.name?.toLowerCase().includes(q);
        const matchEmail = mail.email?.toLowerCase().includes(q);
        const matchCategory = mail.ai?.category?.toLowerCase().includes(q);
        const matchTags = mail.ai?.tags?.some((t) => t.toLowerCase().includes(q));
        if (!matchSubject && !matchName && !matchEmail && !matchCategory && !matchTags) {
          return false;
        }
      }

      return true;
    });
  }, [enrichedMails, activeTab, selectedFolder, searchQuery]);

  const unreadCount = useMemo(() => mails.filter((m) => !m.read).length, [mails]);
  const selectedSummaryMail = useMemo(() => {
    return mails.find((m) => String(m.id || m.seq) === String(selectedMailId));
  }, [mails, selectedMailId]);

  const currentAiAnalysis = selectedMailId ? aiMap[selectedMailId] || null : null;

  const folderTitle =
    selectedFolder === "inbox"
      ? "Inbox"
      : selectedFolder === "newsletters"
      ? "Newsletters"
      : selectedFolder === "junk"
      ? "Junk"
      : selectedFolder === "archive"
      ? "Archive"
      : selectedFolder === "trash"
      ? "Trash"
      : "Mailbox";

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
                title: "Inbox",
                label: currentView === "mails" && selectedFolder === "inbox" && unreadCount > 0 ? String(unreadCount) : "",
                icon: Inbox,
                variant: currentView === "mails" && selectedFolder === "inbox" ? "default" : "ghost",
                onClick: () => handleSelectFolder("inbox"),
              },
              {
                title: "Newsletters",
                label: "",
                icon: Newspaper,
                variant: currentView === "mails" && selectedFolder === "newsletters" ? "default" : "ghost",
                onClick: () => handleSelectFolder("newsletters"),
              },
              {
                title: "Junk",
                label: "",
                icon: AlertOctagon,
                variant: currentView === "mails" && selectedFolder === "junk" ? "default" : "ghost",
                onClick: () => handleSelectFolder("junk"),
              },
              {
                title: "Archive",
                label: "",
                icon: Archive,
                variant: currentView === "mails" && selectedFolder === "archive" ? "default" : "ghost",
                onClick: () => handleSelectFolder("archive"),
              },
              {
                title: "Trash",
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
                title: "Settings",
                label: "",
                icon: Settings,
                variant: currentView === "settings" ? "default" : "ghost",
                onClick: () => {
                  setCurrentView("settings");
                },
              },
            ]}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Main Content Area: Switches between Mails View and Settings View */}
        {currentView === "settings" ? (
          <ResizablePanel defaultSize={defaultLayout[1] + defaultLayout[2]} minSize={50} className="bg-background">
            <div className="h-full overflow-y-auto">
              <SettingsForm onBack={() => setCurrentView("mails")} />
            </div>
          </ResizablePanel>
        ) : (
          <>
            {/* Middle Column: Mail List with Search & Tabs */}
            <ResizablePanel defaultSize={defaultLayout[1]} minSize={25} maxSize={45} className="border-r">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
                <div className="flex h-[52px] items-center justify-between px-4 shrink-0">
                  <h1 className="text-base font-bold tracking-tight flex items-center gap-1.5">
                    {folderTitle}
                  </h1>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer transition-transform active:scale-95"
                      onClick={() => fetchEmails(true, selectedFolder)}
                      disabled={refreshing || loading}
                      title="Refresh mailbox"
                    >
                      <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin text-primary")} />
                      <span className="sr-only">Refresh</span>
                    </Button>
                    <TabsList className="h-8">
                      <TabsTrigger value="all" className="text-xs px-2.5 h-7 cursor-pointer">
                        All
                      </TabsTrigger>
                      <TabsTrigger value="unread" className="text-xs px-2.5 h-7 cursor-pointer">
                        Unread {unreadCount > 0 && `(${unreadCount})`}
                      </TabsTrigger>
                    </TabsList>
                  </div>
                </div>

                <Separator />

                {/* Search Input */}
                <div className="p-4 shrink-0">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={`Search in ${folderTitle.toLowerCase()}...`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 h-9 text-xs"
                    />
                  </div>
                </div>

                {/* Mail Items Scrollable Area */}
                <div className="flex-1 overflow-y-auto">
                  {loading && mails.length === 0 ? (
                    <div className="flex h-64 flex-col items-center justify-center p-8 text-muted-foreground">
                      <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                      <p className="mt-3 text-xs">Loading {folderTitle.toLowerCase()} from IMAP...</p>
                    </div>
                  ) : error && mails.length === 0 ? (
                    <div className="flex h-64 flex-col items-center justify-center p-8 text-center text-destructive">
                      <p className="text-sm font-medium">Failed to load emails</p>
                      <p className="mt-1 text-xs text-muted-foreground">{error}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4 cursor-pointer"
                        onClick={() => fetchEmails(false, selectedFolder)}
                      >
                        Retry
                      </Button>
                    </div>
                  ) : (
                    <TabsContent value={activeTab} className="m-0 border-0 outline-none">
                      <MailList
                        items={filteredMails}
                        selectedMailId={selectedMailId}
                        onSelectMail={handleSelectMail}
                      />
                    </TabsContent>
                  )}
                </div>
              </Tabs>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Right Column: Mail Detail Display with AI Insights */}
            <ResizablePanel defaultSize={defaultLayout[2]} minSize={30}>
              <MailDisplay
                selectedMailId={selectedMailId}
                summaryMail={selectedSummaryMail}
                isRead={selectedSummaryMail ? selectedSummaryMail.read : false}
                currentFolder={selectedFolder}
                aiAnalysis={currentAiAnalysis}
                aiLoading={aiLoading}
                aiError={aiError}
                onReanalyze={handleReanalyze}
                onToggleActionItem={handleToggleActionItem}
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
              />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </TooltipProvider>
  );
}
