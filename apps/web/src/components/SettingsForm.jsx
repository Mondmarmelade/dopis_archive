import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  Save,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Trash2,
  Server,
  ShieldCheck,
  Code2,
  Sparkles,
  Image as ImageIcon,
  ExternalLink,
  AlignJustify,
  LayoutList,
  Settings,
  RotateCcw,
  AlertTriangle,
  Play,
  ListChecks,
  FileText,
  Layers,
  Zap,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  getAiSettings,
  saveAiSettings,
  getCachedAnalysis,
  DEFAULT_AI_SETTINGS,
} from "@/lib/aiCache";
import { aiQueue } from "@/lib/aiQueue";

const TABS = [
  { id: "general", label: "Darstellung", icon: AlignJustify, description: "Listenansicht & Layout" },
  { id: "ai", label: "KI-Modelle & Provider", icon: Server, description: "Clef, Clairic & Endpunkte" },
  { id: "queue", label: "Analyse & Ablauf", icon: Sparkles, description: "Starten & neue Mails" },
  { id: "logos", label: "Absender-Logos", icon: ImageIcon, description: "Logo.dev Token" },
  { id: "privacy", label: "Datenschutz", icon: ShieldCheck, description: "PII-Maskierung" },
  { id: "developer", label: "Entwickler & Debug", icon: Code2, description: "Inspektor & Rohdaten" },
  { id: "storage", label: "Speicher & Cache", icon: Trash2, description: "Lokale Analysedaten" },
];

const PROVIDER_PRESETS = [
  {
    id: "openrouter_system_one",
    title: "OpenRouter (Clef + Clairic)",
    badge: "Empfohlen",
    description:
      "Nutzt Cloudflares schnelle System-One-Modelle über OpenRouter: Clef-flash zum Einordnen und Clairic zum Auslesen von Rechnungen, Paketen & Belegen.",
    defaults: {
      deciderBaseUrl: "https://openrouter.ai/api",
      deciderModel: "cloudflare/clef-flash",
      deciderProtocol: "openrouter_decisions",
      extractorBaseUrl: "https://openrouter.ai/api",
      extractorModel: "cloudflare/clairic",
      extractorProtocol: "openrouter_extractions",
    },
  },
  {
    id: "self_hosted_system_one",
    title: "Self-Hosted System One",
    badge: "Open-Weight",
    description:
      "Verbindet deinen eigenen vLLM-, SGLang- oder Ollama-v0.35+-Server mit /v1/systemone (Clef) und eigenem Clairic-Endpunkt.",
    defaults: {
      deciderBaseUrl: "http://localhost:30000/v1",
      deciderModel: "clef-flash",
      deciderProtocol: "systemone",
      extractorBaseUrl: "http://localhost:30001/v1",
      extractorModel: "clairic",
      extractorProtocol: "clairic_native",
    },
  },
  {
    id: "openai_compatible",
    title: "Eigener OpenAI-kompatibler Endpunkt",
    badge: "Flexibel",
    description:
      "Für Ollama, LM Studio, vLLM oder eigene Proxys mit klassischem /v1/chat/completions-Endpunkt (JSON-Schema-Fallback für beide Schritte).",
    defaults: {
      deciderBaseUrl: "http://localhost:11434/v1",
      deciderModel: "llama3.2",
      deciderProtocol: "openai_compat",
      extractorBaseUrl: "http://localhost:11434/v1",
      extractorModel: "llama3.2",
      extractorProtocol: "openai_compat",
    },
  },
];

export function SettingsForm({
  onBack,
  folderMails = [],
  currentFolder = "inbox",
  onOpenAiActivity,
}) {
  const [activeTab, setActiveTab] = useState("ai");

  const [preset, setPreset] = useState(DEFAULT_AI_SETTINGS.preset);
  const [deciderBaseUrl, setDeciderBaseUrl] = useState(DEFAULT_AI_SETTINGS.deciderBaseUrl);
  const [deciderApiKey, setDeciderApiKey] = useState("");
  const [deciderModel, setDeciderModel] = useState(DEFAULT_AI_SETTINGS.deciderModel);
  const [deciderProtocol, setDeciderProtocol] = useState(DEFAULT_AI_SETTINGS.deciderProtocol);

  const [extractorBaseUrl, setExtractorBaseUrl] = useState(DEFAULT_AI_SETTINGS.extractorBaseUrl);
  const [extractorApiKey, setExtractorApiKey] = useState("");
  const [extractorModel, setExtractorModel] = useState(DEFAULT_AI_SETTINGS.extractorModel);
  const [extractorProtocol, setExtractorProtocol] = useState(DEFAULT_AI_SETTINGS.extractorProtocol);

  const [extractAttachments, setExtractAttachments] = useState(true);
  const [autoAnalyzeNewEmails, setAutoAnalyzeNewEmails] = useState(true);
  const [anonymizePii, setAnonymizePii] = useState(true);
  const [developerMode, setDeveloperMode] = useState(false);
  const [logoDevToken, setLogoDevToken] = useState("");
  const [viewMode, setViewMode] = useState("mailspring");

  // Optional on-demand text summary (collapsed by default, never automatic)
  const [showOptionalSummary, setShowOptionalSummary] = useState(false);
  const [summaryEnabled, setSummaryEnabled] = useState(false);
  const [summaryBaseUrl, setSummaryBaseUrl] = useState(DEFAULT_AI_SETTINGS.summaryBaseUrl);
  const [summaryModel, setSummaryModel] = useState(DEFAULT_AI_SETTINGS.summaryModel);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [savedMessage, setSavedMessage] = useState(false);
  const [queueMessage, setQueueMessage] = useState("");

  const [deciderModels, setDeciderModels] = useState([]);
  const [extractorModels, setExtractorModels] = useState([]);
  const [fetchingStep, setFetchingStep] = useState(null);

  useEffect(() => {
    const current = getAiSettings();
    setPreset(current.preset || "openrouter_system_one");
    setDeciderBaseUrl(current.deciderBaseUrl || DEFAULT_AI_SETTINGS.deciderBaseUrl);
    setDeciderApiKey(current.deciderApiKey || "");
    setDeciderModel(current.deciderModel || DEFAULT_AI_SETTINGS.deciderModel);
    setDeciderProtocol(current.deciderProtocol || DEFAULT_AI_SETTINGS.deciderProtocol);

    setExtractorBaseUrl(current.extractorBaseUrl || DEFAULT_AI_SETTINGS.extractorBaseUrl);
    setExtractorApiKey(current.extractorApiKey || current.deciderApiKey || "");
    setExtractorModel(current.extractorModel || DEFAULT_AI_SETTINGS.extractorModel);
    setExtractorProtocol(current.extractorProtocol || DEFAULT_AI_SETTINGS.extractorProtocol);

    setExtractAttachments(current.extractAttachments !== false);
    setAutoAnalyzeNewEmails(current.autoAnalyzeNewEmails !== false);
    setAnonymizePii(current.anonymizePii !== false);
    setDeveloperMode(Boolean(current.developerMode));
    setLogoDevToken(current.logoDevToken || "");
    setSummaryEnabled(Boolean(current.summaryEnabled));
    setSummaryBaseUrl(current.summaryBaseUrl || DEFAULT_AI_SETTINGS.summaryBaseUrl);
    setSummaryModel(current.summaryModel || DEFAULT_AI_SETTINGS.summaryModel);

    if (typeof window !== "undefined") {
      setViewMode(localStorage.getItem("dopis_mail_view_mode") || "mailspring");
    }
  }, []);

  const mailStats = useMemo(() => {
    const total = folderMails.length;
    let analyzed = 0;
    const unanalyzedList = [];
    for (const m of folderMails) {
      const id = m.id || m.seq;
      if (m.aiAnalysis || getCachedAnalysis(id)) {
        analyzed++;
      } else {
        unanalyzedList.push(m);
      }
    }
    return { total, analyzed, unanalyzed: unanalyzedList.length, unanalyzedList };
  }, [folderMails]);

  const applyPreset = (presetId) => {
    const found = PROVIDER_PRESETS.find((p) => p.id === presetId);
    if (!found) return;
    setPreset(found.id);
    setDeciderBaseUrl(found.defaults.deciderBaseUrl);
    setDeciderModel(found.defaults.deciderModel);
    setDeciderProtocol(found.defaults.deciderProtocol);
    setExtractorBaseUrl(found.defaults.extractorBaseUrl);
    setExtractorModel(found.defaults.extractorModel);
    setExtractorProtocol(found.defaults.extractorProtocol);
    setDeciderModels([]);
    setExtractorModels([]);
    setTestResult(null);
  };

  const buildCurrentSettingsObject = () => ({
    preset,
    deciderBaseUrl,
    deciderApiKey,
    deciderModel,
    deciderProtocol,
    extractorBaseUrl: preset === "openrouter_system_one" ? deciderBaseUrl : extractorBaseUrl,
    extractorApiKey: extractorApiKey || deciderApiKey,
    extractorModel,
    extractorProtocol,
    summaryEnabled,
    summaryBaseUrl,
    summaryApiKey: deciderApiKey,
    summaryModel,
    extractAttachments,
    autoAnalyzeNewEmails,
    anonymizePii,
    developerMode,
    logoDevToken,
    // Keep legacy fields mirrored for backwards compatibility
    baseUrl: deciderBaseUrl,
    apiKey: deciderApiKey,
    model: deciderModel,
  });

  const handleSave = (e) => {
    if (e) e.preventDefault();
    const cfg = buildCurrentSettingsObject();
    saveAiSettings(cfg);
    aiQueue.setAutoQueueEnabled(autoAnalyzeNewEmails);
    if (typeof window !== "undefined") {
      localStorage.setItem("dopis_mail_view_mode", viewMode);
    }
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 2500);
  };

  const handleFetchModels = async (step) => {
    setFetchingStep(step);
    const targetUrl =
      step === "decider"
        ? deciderBaseUrl
        : preset === "openrouter_system_one"
        ? deciderBaseUrl
        : extractorBaseUrl;
    const targetKey = step === "decider" ? deciderApiKey : extractorApiKey || deciderApiKey;
    const capability =
      step === "decider"
        ? deciderProtocol === "openrouter_decisions"
          ? "decisions"
          : "chat"
        : extractorProtocol === "openrouter_extractions"
        ? "extractions"
        : "chat";

    try {
      const res = await fetch("/api/ai/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: targetUrl, apiKey: targetKey, capability }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.models) && data.models.length > 0) {
        if (step === "decider") {
          setDeciderModels(data.models);
          if (!data.models.includes(deciderModel)) setDeciderModel(data.models[0]);
        } else {
          setExtractorModels(data.models);
          if (!data.models.includes(extractorModel)) setExtractorModel(data.models[0]);
        }
      } else {
        alert(data.error || "Keine passenden Modelle gefunden.");
      }
    } catch (e) {
      alert(`Fehler beim Abrufen der Modelle: ${e.message}`);
    } finally {
      setFetchingStep(null);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildCurrentSettingsObject()),
      });

      const data = await res.json();
      setTestResult({
        success: Boolean(res.ok && data.success),
        stages: data.stages || null,
        message:
          res.ok && data.success
            ? "Beide Analyse-Schritte erfolgreich getestet."
            : data.error || "Verbindung fehlgeschlagen",
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: err.message || "Netzwerkfehler beim Verbindungstest",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleAnalyzeAllImported = () => {
    saveAiSettings(buildCurrentSettingsObject());
    if (mailStats.unanalyzedList.length === 0) {
      setQueueMessage("Alle E-Mails in diesem Ordner sind bereits analysiert.");
      return;
    }
    const added = aiQueue.enqueueEmails(mailStats.unanalyzedList, {
      folder: currentFolder,
      trigger: "manual",
    });
    setQueueMessage(`${added} E-Mails wurden zur Analyse gestartet.`);
    if (onOpenAiActivity) {
      onOpenAiActivity();
    }
  };

  const handleClearCache = () => {
    if (confirm("Möchtest du wirklich alle lokal im Browser gecachten KI-Analysen löschen?")) {
      Object.keys(localStorage)
        .filter((key) => key.startsWith("dopis:ai:cache:"))
        .forEach((key) => localStorage.removeItem(key));
      alert("Lokaler KI-Cache erfolgreich geleert!");
    }
  };

  const handleHardReset = () => {
    if (
      confirm(
        "Möchtest du die App wirklich komplett auf Werkseinstellungen zurücksetzen? Alle lokalen Caches und Anmeldesitzungen werden gelöscht und du wirst zum Einrichtungs-Bildschirm weitergeleitet."
      )
    ) {
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
      {/* Header Toolbar */}
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

      {/* Main Split Area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Sidebar */}
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
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Right Content Pane */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <form id="settings-form" onSubmit={handleSave} className="max-w-3xl space-y-6">
            {/* TAB: DARSTELLUNG */}
            {activeTab === "general" && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="border-b pb-3">
                  <h2 className="text-sm font-semibold text-foreground">Darstellung &amp; E-Mail-Listenansicht</h2>
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

            {/* TAB: KI-MODELLE & PROVIDER */}
            {activeTab === "ai" && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <div className="border-b pb-3">
                  <h2 className="text-sm font-semibold text-foreground">
                    KI-Analyse mit Spezialmodellen (Clef &amp; Clairic)
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Statt eines langsamen Chat-Modells nutzt Dopis zwei spezialisierte, schnelle Schritte.
                  </p>
                </div>

                {/* User-friendly 2-step explainer */}
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <Layers className="h-4 w-4 text-primary" />
                    <span>So funktioniert die E-Mail-Analyse in Dopis</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                    <div className="rounded-lg bg-background/80 border border-border/70 p-3 space-y-1">
                      <p className="font-semibold text-foreground flex items-center gap-1.5">
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                          1
                        </span>
                        Schnell einordnen (z. B. Clef)
                      </p>
                      <p className="text-muted-foreground leading-relaxed">
                        Prüft jede analysierte E-Mail in Sekundenbruchteilen: Kategorie (Rechnung, Newsletter, Werbung, Persönlich, …), Dringlichkeit und ob Bestell-, Beleg- oder 2FA-Daten enthalten sind.
                      </p>
                    </div>
                    <div className="rounded-lg bg-background/80 border border-border/70 p-3 space-y-1">
                      <p className="font-semibold text-foreground flex items-center gap-1.5">
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                          2
                        </span>
                        Gezielt Daten auslesen (z. B. Clairic)
                      </p>
                      <p className="text-muted-foreground leading-relaxed">
                        Startet <strong>nur bei Bedarf</strong> (z. B. bei Bestellungen, Rechnungen oder 2FA-Codes) und liest Beträge, Fälligkeiten, Sendungsnummern und PDF-Belege exakt aus. Bei reiner Werbung oder Newslettern wird Schritt 2 gespart.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Provider Presets */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground block">
                    Anbieter-Vorlage wählen
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    {PROVIDER_PRESETS.map((p) => {
                      const active = preset === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => applyPreset(p.id)}
                          className={cn(
                            "text-left rounded-lg border p-3 transition-all cursor-pointer space-y-1",
                            active
                              ? "border-primary bg-primary/5 shadow-2xs"
                              : "border-border/80 hover:bg-muted/40"
                          )}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-semibold text-foreground">{p.title}</span>
                            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                              {p.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-snug">
                            {p.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Endpoint & API Key */}
                <div className="divide-y divide-border/50 rounded-lg border p-4 space-y-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2.5">
                    <div className="space-y-0.5 max-w-sm">
                      <label className="text-xs font-semibold text-foreground block">
                        {preset === "openrouter_system_one" ? "OpenRouter API-URL" : "Schritt 1: Decider Base-URL"}
                      </label>
                      <p className="text-[11px] text-muted-foreground">
                        {preset === "openrouter_system_one"
                          ? "Standard: https://openrouter.ai/api"
                          : "z. B. http://localhost:30000/v1 oder http://localhost:11434/v1"}
                      </p>
                    </div>
                    <div className="sm:w-80 shrink-0">
                      <Input
                        type="url"
                        value={deciderBaseUrl}
                        onChange={(e) => setDeciderBaseUrl(e.target.value)}
                        required
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2.5">
                    <div className="space-y-0.5 max-w-sm">
                      <label className="text-xs font-semibold text-foreground block">API-Schlüssel</label>
                      <p className="text-[11px] text-muted-foreground">
                        {preset === "openrouter_system_one"
                          ? "Dein OpenRouter API-Key (sk-or-...)"
                          : "Optional bei lokalen Servern (z. B. Ollama / vLLM)"}
                      </p>
                    </div>
                    <div className="sm:w-80 shrink-0">
                      <Input
                        type="password"
                        value={deciderApiKey}
                        onChange={(e) => {
                          setDeciderApiKey(e.target.value);
                          if (preset === "openrouter_system_one") setExtractorApiKey(e.target.value);
                        }}
                        placeholder={preset === "openrouter_system_one" ? "sk-or-v1-..." : "Optional"}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* Step 1 Model */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 py-2.5">
                    <div className="space-y-0.5 max-w-sm">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-foreground block">
                          Schritt 1: Einordnungs-Modell
                        </label>
                        <button
                          type="button"
                          onClick={() => handleFetchModels("decider")}
                          disabled={fetchingStep === "decider"}
                          className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
                        >
                          {fetchingStep === "decider" ? "Lade..." : "Modelle abrufen"}
                        </button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Standard: <code>cloudflare/clef-flash</code> (schnell &amp; günstig) oder <code>cloudflare/clef</code>.
                      </p>
                    </div>
                    <div className="sm:w-80 shrink-0 space-y-1.5">
                      {deciderModels.length > 0 && (
                        <select
                          value={deciderModel}
                          onChange={(e) => setDeciderModel(e.target.value)}
                          className="w-full h-8 px-2 text-xs font-mono rounded-md border bg-background text-foreground cursor-pointer"
                        >
                          {deciderModels.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      )}
                      <Input
                        type="text"
                        value={deciderModel}
                        onChange={(e) => setDeciderModel(e.target.value)}
                        required
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* Step 2 Base URL (only shown for Self-Hosted or Custom) */}
                  {preset !== "openrouter_system_one" && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2.5">
                      <div className="space-y-0.5 max-w-sm">
                        <label className="text-xs font-semibold text-foreground block">
                          Schritt 2: Extraktions-Base-URL
                        </label>
                        <p className="text-[11px] text-muted-foreground">
                          Eigener Clairic- oder OpenAI-kompatibler Endpunkt (kann identisch zu Schritt 1 sein).
                        </p>
                      </div>
                      <div className="sm:w-80 shrink-0">
                        <Input
                          type="url"
                          value={extractorBaseUrl}
                          onChange={(e) => setExtractorBaseUrl(e.target.value)}
                          required
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                    </div>
                  )}

                  {/* Step 2 Model */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 py-2.5">
                    <div className="space-y-0.5 max-w-sm">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-foreground block">
                          Schritt 2: Datenauslesungs-Modell
                        </label>
                        <button
                          type="button"
                          onClick={() => handleFetchModels("extractor")}
                          disabled={fetchingStep === "extractor"}
                          className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
                        >
                          {fetchingStep === "extractor" ? "Lade..." : "Modelle abrufen"}
                        </button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Standard: <code>cloudflare/clairic</code> (liest Beträge, Termine, Bestell-/Tracking-Nummern &amp; Belege).
                      </p>
                    </div>
                    <div className="sm:w-80 shrink-0 space-y-1.5">
                      {extractorModels.length > 0 && (
                        <select
                          value={extractorModel}
                          onChange={(e) => setExtractorModel(e.target.value)}
                          className="w-full h-8 px-2 text-xs font-mono rounded-md border bg-background text-foreground cursor-pointer"
                        >
                          {extractorModels.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      )}
                      <Input
                        type="text"
                        value={extractorModel}
                        onChange={(e) => setExtractorModel(e.target.value)}
                        required
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* Attachment Extraction Toggle */}
                  <div className="py-2.5">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={extractAttachments}
                        onChange={(e) => setExtractAttachments(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-primary text-primary cursor-pointer"
                      />
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-foreground">
                          PDF-Rechnungen &amp; Bild-Belege automatisch mit auslesen
                        </p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Wenn Schritt 1 eine Rechnung oder Bestellung erkennt, liest Dopis angehängte PDFs und Beleg-Bilder (bis 4 MiB) mit aus und legt das Original-PDF im Beleg-Archiv ab.
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Test Connection */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3">
                    <div className="space-y-0.5 max-w-sm">
                      <p className="text-xs font-semibold text-foreground">2-Schritt-Verbindungstest</p>
                      <p className="text-[11px] text-muted-foreground">
                        Prüft Einordnungs- und Extraktionsmodell getrennt und misst die Antwortzeit.
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
                        <RefreshCw
                          className={cn("mr-1.5 h-3.5 w-3.5", testing && "animate-spin text-primary")}
                        />
                        {testing ? "Teste beide Schritte..." : "Verbindung testen"}
                      </Button>
                    </div>
                  </div>
                </div>

                {testResult && (
                  <div
                    className={cn(
                      "rounded-lg p-3 text-xs space-y-2 border shadow-2xs",
                      testResult.success
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                        : "bg-destructive/10 text-destructive border-destructive/20"
                    )}
                  >
                    <div className="flex items-center gap-2 font-medium">
                      {testResult.success ? (
                        <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                      )}
                      <span>{testResult.message}</span>
                    </div>
                    {testResult.stages && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px] font-mono">
                        <div className="rounded bg-background/70 border border-border/60 p-2 text-foreground">
                          <span className="font-semibold">Schritt 1 (Einordnung): </span>
                          {testResult.stages.decider?.ok
                            ? `OK · ${testResult.stages.decider.durationMs} ms`
                            : `Fehler: ${testResult.stages.decider?.error}`}
                        </div>
                        <div className="rounded bg-background/70 border border-border/60 p-2 text-foreground">
                          <span className="font-semibold">Schritt 2 (Auslesung): </span>
                          {testResult.stages.extractor?.ok
                            ? `OK · ${testResult.stages.extractor.durationMs} ms`
                            : `Fehler: ${testResult.stages.extractor?.error}`}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Optional On-Demand Text Summary (collapsed) */}
                <div className="rounded-lg border border-border/70">
                  <button
                    type="button"
                    onClick={() => setShowOptionalSummary(!showOptionalSummary)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5" />
                      Optional: Ausführliche Text-Zusammenfassung auf Knopfdruck
                    </span>
                    {showOptionalSummary ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                  {showOptionalSummary && (
                    <div className="px-4 pb-4 pt-2 border-t border-border/60 space-y-3">
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Normalerweise erstellt Dopis die Übersicht komplett ohne Chat-Modell aus Schritt 1 &amp; 2. Wenn du bei einzelnen langen E-Mails zusätzlich einen Button „Text-Zusammenfassung“ wünschst, kannst du hier ein kleines Sprachmodell hinterlegen.
                      </p>
                      <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={summaryEnabled}
                          onChange={(e) => setSummaryEnabled(e.target.checked)}
                          className="h-4 w-4 rounded border-primary text-primary cursor-pointer"
                        />
                        <span>Button „Text-Zusammenfassung“ in der E-Mail-Ansicht anzeigen</span>
                      </label>
                      {summaryEnabled && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div>
                            <label className="text-[11px] font-medium block mb-1">Base-URL (/v1)</label>
                            <Input
                              type="url"
                              value={summaryBaseUrl}
                              onChange={(e) => setSummaryBaseUrl(e.target.value)}
                              className="h-8 text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] font-medium block mb-1">Modellname</label>
                            <Input
                              type="text"
                              value={summaryModel}
                              onChange={(e) => setSummaryModel(e.target.value)}
                              placeholder="z. B. openai/gpt-4o-mini"
                              className="h-8 text-xs font-mono"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: ANALYSE & ABLAUF (Post-Import Start + New Incoming Emails) */}
            {activeTab === "queue" && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <div className="border-b pb-3">
                  <h2 className="text-sm font-semibold text-foreground">Analyse starten &amp; neue E-Mails</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Du hast die volle Kontrolle: Bestands-Mails werden nach dem Import erst auf deinen Klick analysiert.
                  </p>
                </div>

                {/* Manual Post-Import Analysis Card */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-2xs">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-primary" />
                        Importierte E-Mails analysieren
                      </h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        Nach Abschluss des Imports bleiben bestehende E-Mails zunächst unberührt. Starte hier die Analyse für alle noch offenen E-Mails oder wähle gezielt einzelne E-Mails aus.
                      </p>
                    </div>
                    {mailStats.total > 0 && (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                        {mailStats.analyzed} / {mailStats.total} analysiert
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAnalyzeAllImported}
                      disabled={mailStats.unanalyzed === 0}
                      className="h-8 text-xs gap-1.5 cursor-pointer"
                    >
                      <Play className="h-3.5 w-3.5" />
                      {mailStats.unanalyzed > 0
                        ? `Alle ${mailStats.unanalyzed} offenen E-Mails analysieren`
                        : "Alle E-Mails bereits analysiert"}
                    </Button>

                    {onOpenAiActivity && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onOpenAiActivity}
                        className="h-8 text-xs gap-1.5 cursor-pointer"
                      >
                        <ListChecks className="h-3.5 w-3.5" />
                        Einzelne E-Mails auswählen &amp; analysieren
                      </Button>
                    )}
                  </div>

                  {queueMessage && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                      {queueMessage}
                    </p>
                  )}
                </div>

                {/* Automatic Single-Email Analysis for NEW incoming mails */}
                <div className="py-1">
                  <label className="flex items-start gap-3 rounded-lg border p-3.5 cursor-pointer hover:bg-muted/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={autoAnalyzeNewEmails}
                      onChange={(e) => setAutoAnalyzeNewEmails(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-primary text-primary focus:ring-primary cursor-pointer"
                    />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-foreground">
                        Neu eintreffende E-Mails einzeln automatisch analysieren (Empfohlen)
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Gilt <strong>ausschließlich für neue E-Mails</strong>, die nach dem Erstabruf in deinem Postfach ankommen. Jede neue Nachricht wird direkt einzeln eingeordnet (Schritt 1) und bei Bestellungen/Rechnungen ausgelesen (Schritt 2). Bestehende Altmails werden dadurch niemals ungefragt analysiert.
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
                  <h2 className="text-sm font-semibold text-foreground">Datenschutz &amp; Anonymisierung</h2>
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
                        Persönliche Daten vor dem Senden automatisch schwärzen (Empfohlen)
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Maskiert E-Mail-Adressen, Telefonnummern, IBANs, Kreditkartennummern, IP-Adressen und Postanschriften vor dem Senden, während Bestell- und Sendungsnummern für die Auslesung erhalten bleiben.
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
                  <h2 className="text-sm font-semibold text-foreground">Entwickler-Optionen &amp; Debug-Modus</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Erweiterte Diagnose für Clef-Wahrscheinlichkeiten, Clairic-Felder und Latenzanalyse.
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
                        System-One Entwickler-Inspektor in jeder E-Mail aktivieren
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Zeigt direkt in jeder E-Mail die exakten Clef-Wahrscheinlichkeiten (Schritt 1), die Clairic-Extraktionen inkl. Konfidenz &amp; Text-Offsets (Schritt 2), Latenzzeiten und Token-Zahlen.
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
                  <h2 className="text-sm font-semibold text-foreground">Speicher, Cache &amp; App-Reset</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Verwalte lokal im Browser zwischengespeicherte E-Mail-Analysen oder setze die Installation zurück.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 border-b border-border/40">
                  <div className="space-y-0.5 max-w-sm">
                    <p className="text-xs font-semibold text-foreground">Browser-Cache zurücksetzen</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Löscht zwischengespeicherte Analysen im Browser (in PocketBase/SQLite gespeicherte Analysen bleiben erhalten).
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
                      Browser-Cache leeren
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
                      Meldet dein Konto ab, invalidiert alle Sitzungs-Cookies, löscht lokale Caches und startet den Ersteinrichtungs-Ablauf neu.
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
