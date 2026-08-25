import React, { useState, useEffect, useRef } from "react";
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedFolder, setSelectedFolder] = useState("inbox");
  const [selectedMailId, setSelectedMailId] = useState(null);

  // AI State
  const [aiMap, setAiMap] = useState({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const isAnalyzingQueue = useRef(false);

  // Analyze a specific email with the AI API
  const analyzeEmail = async (mailItem, fullText = "", fullHtml = "", force = false) => {
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
  };

  // Background queue: analyze unanalyzed emails in current mailbox
  const processUnanalyzedQueue = async (items) => {
    if (isAnalyzingQueue.current || !items || items.length === 0) return;
    isAnalyzingQueue.current = true;

    try {
      const unanalyzed = items.filter((m) => {
        const id = m.id || m.seq;
        return !getCachedAnalysis(id) && !aiMap[id];
      }).slice(0, 10);

      for (const item of unanalyzed) {
        try {
          await analyzeEmail(item, "", "", false);
        } catch {
          // continue with next
        }
      }
    } finally {
      isAnalyzingQueue.current = false;
    }
  };

  const fetchEmails = async (isManualRefresh = false, folderToLoad = selectedFolder) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

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
      setAiMap(initialAiMap);

      // Auto-select first email in newly loaded folder
      if (fetchedMails.length > 0) {
        const first = fetchedMails[0];
        const firstId = first.id || first.seq;
        setSelectedMailId(firstId);
      } else {
        setSelectedMailId(null);
      }

      // Start background scan for unanalyzed emails
      processUnanalyzedQueue(fetchedMails);
    } catch (err) {
      setError(err.message || "Failed to load emails");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEmails(false, selectedFolder);
  }, [selectedFolder]);

  // When selected email changes, check if it needs immediate analysis
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
  }, [selectedMailId, currentView]);

  const handleSelectFolder = (newFolder) => {
    setCurrentView("mails");
    if (newFolder !== selectedFolder) {
      setSelectedFolder(newFolder);
      setSearchQuery("");
      setActiveTab("all");
    }
  };

  const markMailAsRead = async (seq, isRead) => {
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
  };

  const handleSelectMail = (id) => {
    setSelectedMailId(id);
    const target = mails.find((m) => String(m.id || m.seq) === String(id));
    if (target && !target.read) {
      markMailAsRead(id, true);
    }
  };

  const handleReanalyze = async () => {
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
  };

  const handleToggleActionItem = (taskIndex) => {
    if (!selectedMailId) return;
    const updated = toggleCachedActionItem(selectedMailId, taskIndex);
    if (updated) {
      setAiMap((prev) => ({ ...prev, [selectedMailId]: updated }));
    }
  };

  const moveToTrash = async (seq) => {
    if (!seq) return;

    // 1. Optimistically remove from current list
    const remaining = mails.filter((m) => String(m.id || m.seq) !== String(seq));
    setMails(remaining);

    // 2. Select next email
    if (String(selectedMailId) === String(seq)) {
      setSelectedMailId(remaining.length > 0 ? (remaining[0].id || remaining[0].seq) : null);
    }

    // 3. Send request to IMAP backend
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
  };

  // Combine mail items with their AI analysis data for rich list rendering
  const enrichedMails = mails.map((m) => {
    const id = m.id || m.seq;
    return {
      ...m,
      ai: aiMap[id] || null,
    };
  });

  // Filter mails based on tab and search query
  const filteredMails = enrichedMails.filter((mail) => {
    // Tab filter (all vs unread)
    if (activeTab === "unread" && mail.read) {
      return false;
    }

    // Folder newsletter filter (AI detected newsletter, werbung or promotions)
    if (selectedFolder === "newsletters") {
      const cat = mail.ai?.category?.toLowerCase();
      const isNewsletterOrPromo =
        cat === "newsletter" ||
        cat === "werbung" ||
        cat === "angebote" ||
        mail.subject?.toLowerCase().includes("newsletter");
      if (!isNewsletterOrPromo) return false;
    }

    // Search query filter
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

  const unreadCount = mails.filter((m) => !m.read).length;
  const selectedSummaryMail = mails.find(
    (m) => String(m.id || m.seq) === String(selectedMailId)
  );
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
            isCollapsed && "min-w-[50px] transition-all duration-300 ease-in-out",
            "border-r bg-muted/20"
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
                      className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
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
                  {loading ? (
                    <div className="flex h-64 flex-col items-center justify-center p-8 text-muted-foreground">
                      <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                      <p className="mt-3 text-xs">Loading {folderTitle.toLowerCase()} from IMAP...</p>
                    </div>
                  ) : error ? (
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
