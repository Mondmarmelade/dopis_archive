import React, { useState, useEffect } from "react";
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
  MailCheck,
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

export function Mail({
  defaultLayout = [18, 36, 46],
  defaultCollapsed = false,
  navCollapsedSize = 4,
}) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [mails, setMails] = useState([]);
  const [accountEmail, setAccountEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedFolder, setSelectedFolder] = useState("inbox");
  const [selectedMailId, setSelectedMailId] = useState(null);

  const markMailAsRead = async (seq, isRead) => {
    if (!seq) return;

    // 1. Optimistic UI update: instantly update blue dot and counter
    setMails((prev) =>
      prev.map((m) =>
        String(m.id || m.seq) === String(seq) ? { ...m, read: isRead } : m
      )
    );

    // 2. Persist flag to IMAP server in background
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

  const fetchEmails = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const res = await fetch("/api/emails");
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

      // Auto-select first email if none selected
      if (!selectedMailId && fetchedMails.length > 0) {
        const first = fetchedMails[0];
        const firstId = first.id || first.seq;
        setSelectedMailId(firstId);
        if (!first.read) {
          markMailAsRead(firstId, true);
        }
      }
    } catch (err) {
      setError(err.message || "Failed to load emails");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, []);

  // Filter mails based on tab, folder and search query
  const filteredMails = mails.filter((mail) => {
    // Tab filter (all vs unread)
    if (activeTab === "unread" && mail.read) {
      return false;
    }

    // Search query filter
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      const matchSubject = mail.subject?.toLowerCase().includes(q);
      const matchName = mail.name?.toLowerCase().includes(q);
      const matchEmail = mail.email?.toLowerCase().includes(q);
      if (!matchSubject && !matchName && !matchEmail) {
        return false;
      }
    }

    return true;
  });

  const unreadCount = mails.filter((m) => !m.read).length;
  const selectedSummaryMail = mails.find(
    (m) => String(m.id || m.seq) === String(selectedMailId)
  );

  return (
    <TooltipProvider delayDuration={0}>
      <ResizablePanelGroup
        direction="horizontal"
        className="h-screen w-screen items-stretch overflow-hidden bg-background"
      >
        {/* Left Column: Folders & Navigation */}
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
                label: unreadCount > 0 ? String(unreadCount) : String(mails.length),
                icon: Inbox,
                variant: selectedFolder === "inbox" ? "default" : "ghost",
                onClick: () => setSelectedFolder("inbox"),
              },
              {
                title: "Newsletters",
                label: "",
                icon: Newspaper,
                variant: selectedFolder === "newsletters" ? "default" : "ghost",
                onClick: () => setSelectedFolder("newsletters"),
              },
              {
                title: "Junk",
                label: "",
                icon: AlertOctagon,
                variant: selectedFolder === "junk" ? "default" : "ghost",
                onClick: () => setSelectedFolder("junk"),
              },
              {
                title: "Archive",
                label: "",
                icon: Archive,
                variant: selectedFolder === "archive" ? "default" : "ghost",
                onClick: () => setSelectedFolder("archive"),
              },
              {
                title: "Trash",
                label: "",
                icon: Trash2,
                variant: selectedFolder === "trash" ? "default" : "ghost",
                onClick: () => setSelectedFolder("trash"),
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
                variant: "ghost",
                onClick: () => {},
              },
            ]}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Middle Column: Mail List with Search & Tabs */}
        <ResizablePanel defaultSize={defaultLayout[1]} minSize={25} maxSize={45} className="border-r">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
            <div className="flex h-[52px] items-center justify-between px-4 shrink-0">
              <h1 className="text-base font-bold tracking-tight">
                {selectedFolder === "inbox"
                  ? "Inbox"
                  : selectedFolder === "newsletters"
                  ? "Newsletters"
                  : selectedFolder === "junk"
                  ? "Junk Mail"
                  : selectedFolder === "archive"
                  ? "Archive"
                  : "Trash"}
              </h1>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => fetchEmails(true)}
                  disabled={refreshing || loading}
                  title="Refresh mail"
                >
                  <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin text-primary")} />
                  <span className="sr-only">Refresh</span>
                </Button>
                <TabsList className="h-8">
                  <TabsTrigger value="all" className="text-xs px-2.5 h-7">
                    All mail
                  </TabsTrigger>
                  <TabsTrigger value="unread" className="text-xs px-2.5 h-7">
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
                  placeholder="Search emails..."
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
                  <p className="mt-3 text-xs">Fetching messages from IMAP...</p>
                </div>
              ) : error ? (
                <div className="flex h-64 flex-col items-center justify-center p-8 text-center text-destructive">
                  <p className="text-sm font-medium">Failed to load emails</p>
                  <p className="mt-1 text-xs text-muted-foreground">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => fetchEmails(false)}
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

        {/* Right Column: Mail Detail Display */}
        <ResizablePanel defaultSize={defaultLayout[2]} minSize={30}>
          <MailDisplay
            selectedMailId={selectedMailId}
            summaryMail={selectedSummaryMail}
            isRead={selectedSummaryMail ? selectedSummaryMail.read : false}
            onToggleRead={() => {
              if (selectedSummaryMail) {
                markMailAsRead(selectedMailId, !selectedSummaryMail.read);
              }
            }}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </TooltipProvider>
  );
}
