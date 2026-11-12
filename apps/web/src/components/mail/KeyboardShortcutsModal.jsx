import React from "react";
import { X, Keyboard, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function KeyboardShortcutsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const shortcutGroups = [
    {
      category: "Navigation & Auswahl",
      shortcuts: [
        { keys: ["J", "oder", "↓"], description: "Nächste E-Mail auswählen" },
        { keys: ["K", "oder", "↑"], description: "Vorherige E-Mail auswählen" },
        { keys: ["⌘K", "/", "Strg+K"], description: "Befehlsmenü & Schnellwechsel öffnen" },
        { keys: ["G", "I"], description: "Direkt zum Posteingang springen" },
        { keys: ["G", "A"], description: "Direkt zum Archiv springen" },
        { keys: ["G", "T"], description: "Direkt zum Papierkorb springen" },
      ],
    },
    {
      category: "E-Mail Triage & Aktionen",
      shortcuts: [
        { keys: ["E"], description: "E-Mail archivieren" },
        { keys: ["Entf", "/", "#"], description: "In den Papierkorb verschieben" },
        { keys: ["U"], description: "Gelesen / Ungelesen umschalten" },
        { keys: ["S"], description: "Mit Stern markieren (Favorit)" },
        { keys: ["Strg+Z"], description: "Letzte Aktion rückgängig machen (Undo)" },
        { keys: ["R"], description: "Postfach manuell synchronisieren" },
      ],
    },
    {
      category: "Allgemein & Suche",
      shortcuts: [
        { keys: ["/"], description: "Suchleiste sofort fokussieren" },
        { keys: ["ESC"], description: "Suche zurücksetzen oder Dialoge schließen" },
        { keys: ["?"], description: "Diese Tastaturkürzel-Übersicht anzeigen" },
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-background rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Tastaturkürzel</h2>
              <p className="text-xs text-muted-foreground">
                Arbeite blitzschnell und ohne Maus wie in Superhuman & Linear
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer rounded-full"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content Body with Shortcut Categories */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {shortcutGroups.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.category}
              </h3>
              <div className="divide-y divide-border/50 border rounded-xl bg-card overflow-hidden">
                {group.shortcuts.map((item, itemIdx) => (
                  <div
                    key={itemIdx}
                    className="flex items-center justify-between px-4 py-2.5 text-xs hover:bg-muted/40 transition-colors"
                  >
                    <span className="text-foreground font-normal">{item.description}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.keys.map((k, kIdx) => {
                        const isSeparator = k === "oder" || k === "/";
                        if (isSeparator) {
                          return (
                            <span key={kIdx} className="text-[10px] text-muted-foreground font-medium">
                              {k}
                            </span>
                          );
                        }
                        return (
                          <kbd
                            key={kIdx}
                            className="inline-flex items-center justify-center min-w-[22px] px-1.5 py-0.5 text-[11px] font-mono font-medium rounded-md bg-muted border border-border/80 text-foreground shadow-2xs"
                          >
                            {k}
                          </kbd>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t bg-muted/20 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Tipp: Drücke jederzeit <kbd className="px-1 py-0.2 bg-muted border rounded font-mono text-[10px]">?</kbd> für diese Ansicht</span>
          </div>
          <Button size="sm" variant="default" onClick={onClose} className="h-7 text-xs px-3">
            Verstanden
          </Button>
        </div>
      </div>
    </div>
  );
}
