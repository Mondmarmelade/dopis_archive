import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Server,
  Key,
  Cpu,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Trash2,
  RefreshCw,
  Save,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { getAiSettings, saveAiSettings } from "@/lib/aiCache";

export function SettingsForm() {
  const [baseUrl, setBaseUrl] = useState("http://localhost:11434/v1");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("llama3.2");
  const [anonymizePii, setAnonymizePii] = useState(true);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [savedMessage, setSavedMessage] = useState(false);

  useEffect(() => {
    const current = getAiSettings();
    if (current.baseUrl) setBaseUrl(current.baseUrl);
    if (current.apiKey) setApiKey(current.apiKey);
    if (current.model) setModel(current.model);
    if (current.anonymizePii !== undefined) setAnonymizePii(current.anonymizePii);
  }, []);

  const handleSave = (e) => {
    if (e) e.preventDefault();
    saveAiSettings({ baseUrl, apiKey, model, anonymizePii });
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 3000);
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
          message: `Verbindung erfolgreich hergestellt mit ${data.endpoint} (Modell: ${data.model})`,
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

  return (
    <div className="max-w-2xl mx-auto p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <a
            href="/mails"
            className="flex h-9 w-9 items-center justify-center rounded-lg border bg-background hover:bg-accent text-foreground transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Zurück zu Mails</span>
          </a>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Einstellungen & KI-Konfiguration
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Verbinde deinen bevorzugten OpenAI-kompatiblen Endpoint (Ollama, Hetzner, OpenAI, vLLM).
            </p>
          </div>
        </div>
      </div>

      <Separator className="mb-6" />

      {savedMessage && (
        <div className="mb-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>Einstellungen wurden erfolgreich im Browser gespeichert!</span>
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="rounded-xl border bg-card p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Server className="h-4 w-4 text-primary" />
            OpenAI-kompatibler AI-Provider
          </h2>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Endpoint Base URL</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                z. B. <code>http://localhost:11434/v1</code> für Ollama
              </span>
            </label>
            <Input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="http://localhost:11434/v1"
              required
              className="text-xs font-mono"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>API Key</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                Optional bei lokalem Ollama
              </span>
            </label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="text-xs font-mono"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Modellname</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                z. B. <code>llama3.2</code>, <code>mistral</code>, <code>gpt-4o-mini</code>
              </span>
            </label>
            <Input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="llama3.2"
              required
              className="text-xs font-mono"
            />
          </div>

          {/* Test connection output */}
          {testResult && (
            <div
              className={`rounded-lg p-3 text-xs flex items-center gap-2 border ${
                testResult.success
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                  : "bg-destructive/10 text-destructive border-destructive/20"
              }`}
            >
              {testResult.success ? (
                <CheckCircle className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testing}
              className="text-xs cursor-pointer"
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${testing ? "animate-spin" : ""}`} />
              {testing ? "Teste Verbindung..." : "Verbindung testen"}
            </Button>
          </div>
        </div>

        {/* Privacy & PII Redaction Card */}
        <div className="rounded-xl border bg-card p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Datenschutz & Anonymisierung
            </h2>
          </div>

          <label className="flex items-start gap-3 rounded-lg border p-3.5 cursor-pointer hover:bg-accent/40 transition-colors">
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

        {/* Cache Management */}
        <div className="rounded-xl border bg-card p-6 shadow-xs space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-primary" />
            Speicher & KI-Cache
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Dopis speichert KI-Analysen (Zusammenfassungen, Kategorien und To-Dos) lokal im Cache deines Browsers, damit E-Mails nicht mehrfach an die KI gesendet werden.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClearCache}
            className="text-xs text-destructive hover:bg-destructive/10 hover:border-destructive/30 cursor-pointer"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            KI-Cache leeren
          </Button>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" size="default" className="text-xs font-semibold cursor-pointer">
            <Save className="mr-1.5 h-4 w-4" />
            Alle Einstellungen speichern
          </Button>
        </div>
      </form>
    </div>
  );
}
