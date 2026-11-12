import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Search,
  Inbox,
  Newspaper,
  AlertOctagon,
  Archive,
  Trash2,
  Sparkles,
  Receipt,
  Settings,
  RefreshCw,
  AlignJustify,
  LayoutList,
  CornerDownLeft,
  X,
  Command,
  HelpCircle,
  MailCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function CommandPalette({
  isOpen,
  onClose,
  onSelectFolder,
  onRefresh,
  onToggleViewMode,
  viewMode = "mailspring",
  onOpenSettings,
  onOpenAiActivity,
  onOpenOrdersReceipts,
  onOpenShortcutsModal,
  selectedMail,
  onArchiveMail,
  onTrashMail,
  onToggleReadMail,
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const commands = useMemo(() => {
    const list = [
      // Navigation
      {
        id: "nav-inbox",
        group: "Navigation",
        title: "Zu Posteingang wechseln",
        icon: Inbox,
        shortcut: "G I",
        action: () => onSelectFolder("inbox"),
      },
      {
        id: "nav-newsletters",
        group: "Navigation",
        title: "Zu Newsletter wechseln",
        icon: Newspaper,
        action: () => onSelectFolder("newsletters"),
      },
      {
        id: "nav-orders",
        group: "Navigation",
        title: "Bestellungen & Belege anzeigen",
        icon: Receipt,
        action: () => onOpenOrdersReceipts?.(),
      },
      {
        id: "nav-ai",
        group: "Navigation",
        title: "KI-Aktivität & Queue öffnen",
        icon: Sparkles,
        action: () => onOpenAiActivity?.(),
      },
      {
        id: "nav-archive",
        group: "Navigation",
        title: "Zu Archiv wechseln",
        icon: Archive,
        shortcut: "G A",
        action: () => onSelectFolder("archive"),
      },
      {
        id: "nav-trash",
        group: "Navigation",
        title: "Zu Papierkorb wechseln",
        icon: Trash2,
        shortcut: "G T",
        action: () => onSelectFolder("trash"),
      },
      {
        id: "nav-spam",
        group: "Navigation",
        title: "Zu Spam wechseln",
        icon: AlertOctagon,
        action: () => onSelectFolder("junk"),
      },
      {
        id: "nav-settings",
        group: "Navigation",
        title: "Einstellungen öffnen",
        icon: Settings,
        action: () => onOpenSettings?.(),
      },

      // Aktionen
      {
        id: "act-refresh",
        group: "Aktionen",
        title: "Postfach jetzt aktualisieren",
        icon: RefreshCw,
        shortcut: "R",
        action: () => onRefresh?.(),
      },
      {
        id: "act-toggle-view",
        group: "Aktionen",
        title:
          viewMode === "mailspring"
            ? "Zu Kartenansicht (Erweitert) wechseln"
            : "Zu Kompaktansicht (Mailspring) wechseln",
        icon: viewMode === "mailspring" ? LayoutList : AlignJustify,
        action: () =>
          onToggleViewMode?.(viewMode === "mailspring" ? "cards" : "mailspring"),
      },
      {
        id: "act-help",
        group: "Aktionen",
        title: "Tastaturkürzel anzeigen",
        icon: HelpCircle,
        shortcut: "?",
        action: () => onOpenShortcutsModal?.(),
      },
    ];

    // Kontextuelle Aktionen für ausgewählte E-Mail
    if (selectedMail) {
      list.push(
        {
          id: "act-archive-mail",
          group: "Ausgewählte E-Mail",
          title: `"${selectedMail.subject || 'E-Mail'}" archivieren`,
          icon: Archive,
          shortcut: "E",
          action: () => onArchiveMail?.(selectedMail.id || selectedMail.seq),
        },
        {
          id: "act-trash-mail",
          group: "Ausgewählte E-Mail",
          title: `"${selectedMail.subject || 'E-Mail'}" löschen`,
          icon: Trash2,
          shortcut: "Entf",
          action: () => onTrashMail?.(selectedMail.id || selectedMail.seq),
        },
        {
          id: "act-toggle-read-mail",
          group: "Ausgewählte E-Mail",
          title: selectedMail.read
            ? `Als ungelesen markieren`
            : `Als gelesen markieren`,
          icon: MailCheck,
          shortcut: "U",
          action: () => onToggleReadMail?.(selectedMail.id || selectedMail.seq, !selectedMail.read),
        }
      );
    }

    if (!query.trim()) return list;

    const q = query.toLowerCase().trim();
    return list.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q) ||
        (item.shortcut && item.shortcut.toLowerCase().includes(q))
    );
  }, [
    query,
    selectedMail,
    viewMode,
    onSelectFolder,
    onRefresh,
    onToggleViewMode,
    onOpenSettings,
    onOpenAiActivity,
    onOpenOrdersReceipts,
    onOpenShortcutsModal,
    onArchiveMail,
    onTrashMail,
    onToggleReadMail,
  ]);

  // Tastaturnavigation innerhalb der Palette
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, commands.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev === 0 ? Math.max(0, commands.length - 1) : prev - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (commands[selectedIndex]) {
        executeCommand(commands[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  const executeCommand = (cmd) => {
    cmd.action?.();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28 bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-background rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[75vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/20">
          <Command className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Befehl eingeben oder suchen... (z. B. Posteingang, Archiv, Ansicht)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none border-0 p-0 focus:ring-0"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted border rounded">
              ESC
            </kbd>
          )}
        </div>

        {/* Command Items List */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-1">
          {commands.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              Kein passender Befehl gefunden für "{query}"
            </div>
          ) : (
            commands.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  onClick={() => executeCommand(cmd)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    "flex items-center justify-between px-3 py-2.5 rounded-xl text-xs cursor-pointer transition-all",
                    isSelected
                      ? "bg-primary/10 text-primary font-semibold shadow-2xs"
                      : "text-foreground hover:bg-muted/60"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={cn(
                        "w-4 h-4 shrink-0 transition-colors",
                        isSelected ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                    <span className="truncate">{cmd.title}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={cn(
                        "text-[10px]",
                        isSelected
                          ? "text-primary/70"
                          : "text-muted-foreground/60"
                      )}
                    >
                      {cmd.group}
                    </span>
                    {cmd.shortcut && (
                      <kbd
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-mono border",
                          isSelected
                            ? "bg-primary/15 border-primary/25 text-primary"
                            : "bg-muted border-border text-muted-foreground"
                        )}
                      >
                        {cmd.shortcut}
                      </kbd>
                    )}
                    {isSelected && (
                      <CornerDownLeft className="w-3.5 h-3.5 text-primary" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Hint Bar */}
        <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.2 bg-muted border rounded text-[9px] font-mono">↑</kbd>
              <kbd className="px-1 py-0.2 bg-muted border rounded text-[9px] font-mono">↓</kbd>
              <span>Navigieren</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.2 bg-muted border rounded text-[9px] font-mono">↵</kbd>
              <span>Ausführen</span>
            </span>
          </div>
          <span>Dopis Quick Command</span>
        </div>
      </div>
    </div>
  );
}
