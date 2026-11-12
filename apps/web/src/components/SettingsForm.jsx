import React, { useState, useEffect } from "react";
import {
  Settings,
  ArrowLeft,
  Save,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  AlignJustify,
  LayoutList,
  Server,
  Sparkles,
  ShieldCheck,
  Image as ImageIcon,
  Code2,
  Trash2,
  ExternalLink,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { getAiSettings, saveAiSettings } from "@/lib/aiCache";
import { aiQueue } from "@/lib/aiQueue";

const TABS = [
  { id: "general", label: "Darstellung", icon: AlignJustify, description: "Listenansicht & Layout" },
  { id: "ai", label: "KI-Provider", icon: Server, description: "Endpoint & Modell" },
  { id: "queue", label: "Warteschlange", icon: Sparkles, description: "Hintergrund-Analyse" },
  { id: "logos", label: "Absender-Logos", icon: ImageIcon, description: "Logo.dev Token" },
  { id: "privacy", label: "Datenschutz", icon: ShieldCheck, description: "PII-Maskierung" },
  { id: "developer", label: "Entwickler & Debug", icon: Code2, description: "Inspektor & Rohdaten" },
  { id: "storage", label: "Speicher & Cache", icon: Trash2, description: "Lokale Analysedaten" },
];

export function SettingsForm({ onBack }) {
  const [activeTab, setActiveTab] = useState("general");

  const [baseUrl, setBaseUrl] = useState("http://localhost:11434/v1");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("llama3.2");
  const [anonymizePii, setAnonymizePii] = useState(true);
  const [developerMode, setDeveloperMode] = useState(false);
  const [logoDevToken, setLogoDevToken] = useState("");
  const [autoQueue, setAutoQueue] = useState(false);
  const [viewMode, setViewMode] = useState("mailspring");

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [savedMessage, setSavedMessage] = useState(false);
  const [serverModels, setServerModels] = useState([]);
  const [fetchingModels, setFetchingModels] = useState(false);

  const handleFetchModels = async () => {
    setFetchingModels(true);
    try {
      const res = await fetch("/api/ai/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, apiKey }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.models) && data.models.length > 0) {
        setServerModels(data.models);
        if (!data.models.includes(model)) {
          setModel(data.models[0]);
        }
      } else {
        alert(data.error || "Keine Modelle gefunden.");
      }
    } catch (e) {
      alert(`Fehler beim Abrufen der Modelle: ${e.message}`);
    } finally {
      setFetchingModels(false);
    }
  };

  useEffect(() => {
    const current = getAiSettings();
    if (current.baseUrl) setBaseUrl(current.baseUrl);
    if (current.apiKey) setApiKey(current.apiKey);
    if (current.model) setModel(current.model);
    if (current.anonymizePii !== undefined) setAnonymizePii(current.anonymizePii);
    if (current.developerMode !== undefined) setDeveloperMode(current.developerMode);
    if (current.logoDevToken) setLogoDevToken(current.logoDevToken);
    setAutoQueue(aiQueue.getState().isAutoQueueEnabled);
    if (typeof window !== "undefined") {
      setViewMode(localStorage.getItem("dopis_mail_view_mode") || "mailspring");
    }
  }, []);

  const handleSave = (e) => {
    if (e) e.preventDefault();
    saveAiSettings({
      baseUrl,
      apiKey,
      model,
      anonymizePii,
      developerMode,
      logoDevToken,
    });
    aiQueue.setAutoQueueEnabled(autoQueue);
    if (typeof window !== "undefined") {
      localStorage.setItem("dopis_mail_view_mode", viewMode);
    }
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 2500);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl,
          apiKey,
          model,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: `Verbindung erfolgreich mit ${data.endpoint} (Modell: ${data.model})`,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || "Verbindung fehlgeschlagen",
        });
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: err.message || "Netzwerkfehler beim Verbindungstest",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleClearCache = () => {
    if (confirm("Möchtest du wirklich alle zwischengespeicherten KI-Analysen löschen?")) {
      Object.keys(localStorage)
        .filter((key) => key.startsWith("dopis:ai:cache:"))
        .forEach((key) => localStorage.removeItem(key));
      alert("KI-Cache erfolgreich geleert!");
    }
  };

  const handleHardReset = () => {
    if (confirm("Möchtest du die App wirklich komplett auf Werkseinstellungen zurücksetzen? Alle lokalen Caches und Anmeldesitzungen werden gelöscht und du wirst zum Einrichtungs-Bildschirm weitergeleitet. Deine Zugangsdaten und KI-Einstellungen bleiben für die Neueinrichtung vorausgefüllt.")) {
      if (typeof window !== "undefined") {
        const savedLogin = localStorage.getItem("dopis:saved_login");
        const savedAi = localStorage.getItem("dopis:ai:settings");
        localStorage.clear();
        sessionStorage.clear();
        if (savedLogin) localStorage.setItem("dopis:saved_login", savedLogin);
        if (savedAi) localStorage.setItem("dopis:ai:settings", savedAi);
        window.location.href = "/logout?reset=1";
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* 1. Header Toolbar (compact 52px, matches mail toolbar) */}
      <div className="flex h-[52px] items-center justify-between px-4 border-b shrink-0 bg-background/95 backdrop-blur-xs">
        <div className="flex items-center gap-3">
          {onBack ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
              title="Zurück zum Postfach"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Zurück zu Mails</span>
            </Button>
          ) : (
            <a
              href="/mails"
              className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Zurück zu Mails</span>
            </a>
          )}
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" />
            <h1 className="text-sm font-bold text-foreground tracking-tight">Einstellungen</h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {savedMessage && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5 animate-in fade-in duration-200">
              <CheckCircle className="h-3.5 w-3.5" />
              Gespeichert
            </span>
          )}
          <Button
            type="submit"
            form="settings-form"
            size="sm"
            className="h-8 text-xs font-medium cursor-pointer shadow-2xs"
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Speichern
          </Button>
        </div>
      </div>

      {/* 2. Main Split Area: Left Categories Navigation + Right Content Pane */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Categories Sidebar */}
        <aside className="w-48 sm:w-56 shrink-0 border-r bg-muted/15 p-2 flex flex-col gap-0.5 overflow-y-auto select-none">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all text-left cursor-pointer",
                  isActive
                    ? "bg-background text-foreground shadow-2xs border border-border/80"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Icon className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Right Settings Content Pane */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <form id="settings-form" onSubmit={handleSave} className="max-w-3xl space-y-6">
            {/* TAB: DARSTELLUNG */}
            {activeTab === "general" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="border-b pb-3">
                  <h2 className="text-sm font-semibold text-foreground">Darstellung & E-Mail-Listenansicht</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Passe das Layout der E-Mail-Liste an deine bevorzugte Arbeitsweise an.
                  </p>
                </div>

                <div className="space-y-3 pt-1">
                  <label className="text-xs font-semibold text-foreground block">Listenstil im Postfach</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div
                      onClick={() => setViewMode("mailspring")}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-3.5 cursor-pointer transition-all",
                        viewMode === "mailspring"
                          ? "border-primary bg-primary/5 shadow-2xs"
                          : "hover:bg-muted/40"
                      )}
                    >
                      <input
                        type="radio"
                        name="viewMode"
                        value="mailspring"
                        checked={viewMode === "mailspring"}
                        onChange={() => setViewMode("mailspring")}
                        className="mt-0.5 h-4 w-4 border-primary text-primary focus:ring-primary cursor-pointer"
                      />
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <AlignJustify className="h-3.5 w-3.5 text-primary" />
                          <p className="text-xs font-semibold text-foreground">Mailspring-Stil (Kompakt)</p>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Einzeilig, tabellarisch mit Avataren, Betreff + Snippet auf einer Linie und Schnellaktionen beim Hovern.
                        </p>
                      </div>
                    </div>

                    <div
                      onClick={() => setViewMode("cards")}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-3.5 cursor-pointer transition-all",
                        viewMode === "cards"
                          ? "border-primary bg-primary/5 shadow-2xs"
                          : "hover:bg-muted/40"
                      )}
                    >
                      <input
                        type="radio"
                        name="viewMode"
                        value="cards"
                        checked={viewMode === "cards"}
                        onChange={() => setViewMode("cards")}
                        className="mt-0.5 h-4 w-4 border-primary text-primary focus:ring-primary cursor-pointer"
                      />
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <LayoutList className="h-3.5 w-3.5 text-primary" />
                          <p className="text-xs font-semibold text-foreground">Karten-Ansicht (Erweitert)</p>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Mehrzeilige Karten mit KI-Kategorie-Chips, Tags, Queue-Status und Bestell-Fortschritts-Badges.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: KI-PROVIDER */}
            {activeTab === "ai" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="border-b pb-3">
                  <h2 className="text-sm font-semibold text-foreground">Eigener KI-Endpunkt (OpenAI-kompatibles Protokoll)</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Verbinde deinen eigenen KI-Server (vLLM, LM Studio, Ollama etc.) direkt über die standardisierte API-Schnittstelle (<code>/v1</code>). Keine Verbindung zur OpenAI Cloud.
                  </p>
                </div>

                <div className="divide-y divide-border/40">
                  {/* Endpoint Base URL */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3">
                    <div className="space-y-0.5 max-w-sm">
                      <label className="text-xs font-semibold text-foreground block">Server Base URL</label>
                      <p className="text-[11px] text-muted-foreground">
                        Basis-URL deines Servers, z. B. <code>http://localhost:11434/v1</code> oder <code>https://mein-server.de/v1</code>
                      </p>
                    </div>
                    <div className="sm:w-80 shrink-0">
                      <Input
                        type="text"
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        placeholder="http://localhost:11434/v1"
                        required
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* API Key */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3">
                    <div className="space-y-0.5 max-w-sm">
                      <label className="text-xs font-semibold text-foreground block">API Key / Auth-Token (optional)</label>
                      <p className="text-[11px] text-muted-foreground">
                        Wird im Authorization-Header an deinen Server übermittelt
                      </p>
                    </div>
                    <div className="sm:w-80 shrink-0">
                      <Input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Optional bei lokalen Servern"
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* Modellname */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 py-3">
                    <div className="space-y-0.5 max-w-sm">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-foreground block">Modellname</label>
                        <button
                          type="button"
                          onClick={handleFetchModels}
                          disabled={fetchingModels}
                          className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
                        >
                          {fetchingModels ? "Lade..." : "Modelle vom Server abrufen"}
                        </button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Wähle ein Modell deines Servers oder trage den Namen manuell ein.
                      </p>
                    </div>
                    <div className="sm:w-80 shrink-0 space-y-1.5">
                      {serverModels.length > 0 && (
                        <select
                          value={model}
                          onChange={(e) => setModel(e.target.value)}
                          className="w-full h-8 px-2 text-xs font-mono rounded-md border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                        >
                          {serverModels.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      )}
                      <Input
                        type="text"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        placeholder="z. B. Qwen/Qwen3.6-35B oder llama3.2"
                        required
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* Test Connection */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5">
                    <div className="space-y-0.5 max-w-sm">
                      <p className="text-xs font-semibold text-foreground">Verbindungstest</p>
                      <p className="text-[11px] text-muted-foreground">
                        Überprüft, ob der Endpunkt antwortet und das Modell geladen werden kann.
                      </p>
                    </div>
                    <div className="sm:w-80 shrink-0 flex items-center justify-start sm:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleTestConnection}
                        disabled={testing}
                        className="h-8 text-xs cursor-pointer shadow-2xs"
                      >
                        <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", testing && "animate-spin text-primary")} />
                        {testing ? "Teste Verbindung..." : "Verbindung testen"}
                      </Button>
                    </div>
                  </div>
                </div>

                {testResult && (
                  <div
                    className={cn(
                      "rounded-md p-3 text-xs flex items-center gap-2 border shadow-2xs mt-2",
                      testResult.success
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                        : "bg-destructive/10 text-destructive border-destructive/20"
                    )}
                  >
                    {testResult.success ? (
                      <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                    )}
                    <span className="leading-normal">{testResult.message}</span>
                  </div>
                )}
              </div>
            )}

            {/* TAB: WARTESCHLANGE */}
            {activeTab === "queue" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="border-b pb-3">
                  <h2 className="text-sm font-semibold text-foreground">Automatische Hintergrund-Warteschlange</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Automatische KI-Verarbeitung neu eintreffender E-Mails im Leerlauf.
                  </p>
                </div>

                <div className="py-2">
                  <label className="flex items-start gap-3 rounded-lg border p-3.5 cursor-pointer hover:bg-muted/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={autoQueue}
                      onChange={(e) => setAutoQueue(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-primary text-primary focus:ring-primary cursor-pointer"
                    />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-foreground">
                        Ungelesene E-Mails automatisch im Leerlauf analysieren (Selektive Automatik)
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Reiht neu eintreffende und ungelesene E-Mails ressourcenschonend im Hintergrund in die Warteschlange ein. Bestehende und gelesene E-Mails können jederzeit manuell im Dashboard &quot;KI-Aktivität&quot; analysiert werden.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* TAB: LOGOS */}
            {activeTab === "logos" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="border-b pb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Absender-Logos (Logo.dev)</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Offizieller Nachfolger der Clearbit Logo API für gestochen scharfe Unternehmenslogos.
                    </p>
                  </div>
                  <a
                    href="https://www.logo.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0 font-medium"
                  >
                    logo.dev besuchen <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 border-b border-border/40">
                  <div className="space-y-0.5 max-w-sm">
                    <label className="text-xs font-semibold text-foreground block">Logo.dev Publishable Key</label>
                    <p className="text-[11px] text-muted-foreground">
                      Format: <code>pk_...</code> (Kostenlos auf logo.dev erstellbar)
                    </p>
                  </div>
                  <div className="sm:w-80 shrink-0">
                    <Input
                      type="text"
                      value={logoDevToken}
                      onChange={(e) => setLogoDevToken(e.target.value)}
                      placeholder="pk_xxxxxxxxxxxxxxxx"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB: DATENSCHUTZ */}
            {activeTab === "privacy" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="border-b pb-3">
                  <h2 className="text-sm font-semibold text-foreground">Datenschutz & Anonymisierung</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Schutz personenbezogener Daten vor der KI-Verarbeitung.
                  </p>
                </div>

                <div className="py-2">
                  <label className="flex items-start gap-3 rounded-lg border p-3.5 cursor-pointer hover:bg-muted/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={anonymizePii}
                      onChange={(e) => setAnonymizePii(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-primary text-primary focus:ring-primary cursor-pointer"
                    />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-foreground">
                        Persönliche Daten vor dem Senden an die KI automatisch schwärzen (Empfohlen)
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Entfernt und maskiert E-Mail-Adressen, Telefonnummern, IBANs, Kreditkartennummern, IP-Adressen und Postanschriften aus dem E-Mail-Text und Absender, bevor die Anfrage den KI-Server erreicht.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* TAB: ENTWICKLER */}
            {activeTab === "developer" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="border-b pb-3">
                  <h2 className="text-sm font-semibold text-foreground">Entwickler-Optionen & Debug-Modus</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Erweiterte Diagnose- und Debug-Werkzeuge für Prompt-Engineering und Latenzanalyse.
                  </p>
                </div>

                <div className="py-2">
                  <label className="flex items-start gap-3 rounded-lg border p-3.5 cursor-pointer hover:bg-muted/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={developerMode}
                      onChange={(e) => setDeveloperMode(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-primary text-primary focus:ring-primary cursor-pointer"
                    />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-foreground">
                        Entwickler-Inspektor in der E-Mail-Ansicht aktivieren
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Ermöglicht das Einsehen der exakten Prompts, des unformatierten JSON-Outputs des Modells, der Latenzzeiten (ms), Tokens und IMAP-Metadaten direkt in jeder E-Mail.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* TAB: SPEICHER & CACHE */}
            {activeTab === "storage" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="border-b pb-3">
                  <h2 className="text-sm font-semibold text-foreground">Speicher, Cache & App-Reset</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Verwalte lokal im Browser zwischengespeicherte E-Mail-Analysen oder setze die gesamte Installation zurück.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 border-b border-border/40">
                  <div className="space-y-0.5 max-w-sm">
                    <p className="text-xs font-semibold text-foreground">Lokalen Cache zurücksetzen</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Löscht alle gecachten Zusammenfassungen, Kategorien und To-Dos aus dem Browser-Speicher.
                    </p>
                  </div>
                  <div className="sm:w-80 shrink-0 flex items-center justify-start sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleClearCache}
                      className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:border-destructive/30 cursor-pointer shadow-2xs"
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      KI-Cache leeren
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4 mt-4">
                  <div className="space-y-1 max-w-md">
                    <p className="text-xs font-bold text-destructive flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4" />
                      Auf Werkseinstellungen zurücksetzen (Frischer Install)
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Meldet dein Konto ab, invalidiert alle Sitzungs-Cookies, löscht gespeicherte KI-Konfigurationen und simuliert einen frischen App-Start mit Ersteinrichtung.
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center justify-start sm:justify-end">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={handleHardReset}
                      className="h-8 text-xs font-medium cursor-pointer shadow-2xs"
                    >
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                      App zurücksetzen
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </form>
        </main>
      </div>
    </div>
  );
}
