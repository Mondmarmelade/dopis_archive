import React, { useState, useEffect } from "react";
import {
  Package,
  Receipt,
  Truck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Download,
  Paperclip,
  Search,
  RefreshCw,
  Plus,
  Link as LinkIcon,
  Unlink,
  AlertCircle,
  FileText,
  Calendar,
  CreditCard,
  Building,
  Upload,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getTrackingUrl, getStageLabel } from "@/lib/threadEngine";

export function OrdersAndReceiptsView({ onSelectMail, onClose }) {
  const [activeTab, setActiveTab] = useState("orders"); // "orders" | "receipts"
  const [orders, setOrders] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pbAvailable, setPbAvailable] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLinking, setIsLinking] = useState(null); // orderId being linked to
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);

  // New receipt upload form state
  const [newTitle, setNewTitle] = useState("");
  const [newMerchant, setNewMerchant] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newProvider, setNewProvider] = useState("");
  const [newFile, setNewFile] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordersRes, receiptsRes] = await Promise.all([
        fetch("/api/orders").then((r) => r.json()),
        fetch("/api/receipts").then((r) => r.json()),
      ]);

      if (ordersRes && Array.isArray(ordersRes.orders)) {
        setOrders(ordersRes.orders);
        setPbAvailable(ordersRes.pocketBaseAvailable !== false);
      }
      if (receiptsRes && Array.isArray(receiptsRes.receipts)) {
        setReceipts(receiptsRes.receipts);
      }
    } catch (err) {
      console.error("Failed to load orders or receipts:", err);
      setPbAvailable(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLinkReceipt = async (orderId, receiptId) => {
    try {
      const res = await fetch("/api/orders/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, receiptId, action: "link" }),
      });
      if (res.ok) {
        setIsLinking(null);
        await fetchData();
      }
    } catch (e) {
      console.error("Failed to link receipt:", e);
    }
  };

  const handleUnlinkReceipt = async (receiptId) => {
    try {
      const res = await fetch("/api/orders/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptId, action: "unlink" }),
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (e) {
      console.error("Failed to unlink receipt:", e);
    }
  };

  const handleUploadReceipt = async (e) => {
    e.preventDefault();
    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append("title", newTitle || "Manueller Beleg");
      formData.append("merchant", newMerchant);
      formData.append("amount", newAmount);
      formData.append("provider", newProvider);
      formData.append("date", new Date().toISOString());
      if (newFile) {
        formData.append("file", newFile);
      }

      const res = await fetch("/api/receipts", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setShowUploadModal(false);
        setNewTitle("");
        setNewMerchant("");
        setNewAmount("");
        setNewProvider("");
        setNewFile(null);
        await fetchData();
      }
    } catch (err) {
      console.error("Failed to upload receipt:", err);
    } finally {
      setUploadLoading(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (o.merchant && o.merchant.toLowerCase().includes(q)) ||
      (o.order_number && o.order_number.toLowerCase().includes(q)) ||
      (o.status_title && o.status_title.toLowerCase().includes(q)) ||
      (o.tracking_number && o.tracking_number.toLowerCase().includes(q))
    );
  });

  const filteredReceipts = receipts.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (r.merchant && r.merchant.toLowerCase().includes(q)) ||
      (r.title && r.title.toLowerCase().includes(q)) ||
      (r.amount && r.amount.toLowerCase().includes(q)) ||
      (r.provider && r.provider.toLowerCase().includes(q)) ||
      (r.transaction_id && r.transaction_id.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Top Header */}
      <div className="p-4 border-b flex flex-wrap items-center justify-between gap-3 bg-card/60">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">Bestellungen & Quittungen</h1>
            {pbAvailable ? (
              <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> PocketBase aktiv
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> PocketBase offline (Port 8090)
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Zentrale Verknüpfung von Sendungen, Rechnungs-PDFs und E-Mails
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-1.5 text-xs">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Aktualisieren
          </Button>
          <Button size="sm" onClick={() => setShowUploadModal(true)} className="gap-1.5 text-xs">
            <Upload className="w-3.5 h-3.5" /> Beleg hochladen
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
              Schließen
            </Button>
          )}
        </div>
      </div>

      {/* Filter and Tab Navigation Bar */}
      <div className="px-4 py-2.5 border-b bg-muted/20 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-0.5 bg-muted rounded-lg text-xs font-medium">
          <button
            onClick={() => setActiveTab("orders")}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === "orders" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Package className="w-3.5 h-3.5 text-primary" />
            Bestellungen & Sendungen ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab("receipts")}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === "receipts" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Receipt className="w-3.5 h-3.5 text-emerald-500" />
            Quittungen & Rechnungen ({receipts.length})
          </button>
        </div>

        <div className="relative w-64 max-w-full">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Suchen nach Händler, Nr., Betrag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-xs h-8"
          />
        </div>
      </div>

      {/* Main Content List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && (
          <div className="py-16 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            Lade Daten aus PocketBase...
          </div>
        )}

        {!loading && activeTab === "orders" && (
          <>
            {filteredOrders.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-sm">
                <Package className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
                <p className="font-semibold text-foreground">Keine Bestellungen gefunden</p>
                <p className="text-xs mt-1">
                  E-Mails mit Bestellbestätigungen werden bei der KI-Analyse automatisch erfasst.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredOrders.map((order) => {
                  const trackingUrl = getTrackingUrl(order.carrier, order.tracking_number);
                  const linkedReceipts = order.expand?.receipts || [];

                  return (
                    <div
                      key={order.id}
                      className="rounded-xl border bg-card p-4 shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between"
                    >
                      <div>
                        {/* Header: Merchant, Status & Amount */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-base text-foreground">
                                {order.merchant || "Unbekannter Händler"}
                              </span>
                              {order.order_number && (
                                <Badge variant="secondary" className="font-mono text-[10px]">
                                  #{order.order_number}
                                </Badge>
                              )}
                            </div>
                            {order.status_title && (
                              <p className="text-xs font-medium text-primary mt-0.5">
                                {order.status_title}
                              </p>
                            )}
                          </div>

                          <div className="text-right">
                            {order.amount && (
                              <span className="text-base font-extrabold text-foreground">
                                {order.amount}
                              </span>
                            )}
                            <div>
                              <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                                {getStageLabel(order.stage || "ordered")}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        {order.status_detail && (
                          <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg mb-3">
                            {order.status_detail}
                          </p>
                        )}

                        {/* Tracking Info if available */}
                        {order.tracking_number && (
                          <div className="flex items-center justify-between gap-2 p-2 bg-muted/40 rounded-lg text-xs font-mono mb-3">
                            <span className="flex items-center gap-1.5 text-muted-foreground truncate">
                              <Truck className="w-3.5 h-3.5 shrink-0 text-primary" />
                              {order.carrier ? `${order.carrier}: ` : ""}
                              <span className="text-foreground">{order.tracking_number}</span>
                            </span>
                            {trackingUrl && (
                              <a
                                href={trackingUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-sans font-semibold shrink-0"
                              >
                                Verfolgen <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        )}

                        {/* Linked Receipts Section */}
                        <div className="mt-3 pt-3 border-t">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                              <Receipt className="w-3.5 h-3.5 text-emerald-500" />
                              Verknüpfte Quittungen ({linkedReceipts.length})
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setIsLinking(isLinking === order.id ? null : order.id)}
                              className="text-[11px] h-6 px-2 gap-1 text-primary"
                            >
                              <Plus className="w-3 h-3" /> Quittung zuordnen
                            </Button>
                          </div>

                          {/* Quick linking dropdown if opened */}
                          {isLinking === order.id && (
                            <div className="p-2.5 bg-muted/60 rounded-lg border mb-2 text-xs space-y-2">
                              <p className="font-semibold text-foreground text-[11px]">
                                Wähle eine Quittung zum Verknüpfen:
                              </p>
                              {receipts.filter((r) => r.order !== order.id).length === 0 ? (
                                <p className="text-[11px] text-muted-foreground italic">
                                  Keine weiteren Quittungen verfügbar.
                                </p>
                              ) : (
                                <div className="max-h-36 overflow-y-auto space-y-1">
                                  {receipts
                                    .filter((r) => r.order !== order.id)
                                    .map((rec) => (
                                      <div
                                        key={rec.id}
                                        className="flex items-center justify-between p-1.5 bg-background rounded border text-[11px]"
                                      >
                                        <div className="truncate mr-2">
                                          <span className="font-medium text-foreground">{rec.merchant || rec.title}</span>
                                          {rec.amount && <span className="ml-1 text-muted-foreground">({rec.amount})</span>}
                                        </div>
                                        <Button
                                          size="sm"
                                          className="h-5 px-1.5 text-[10px]"
                                          onClick={() => handleLinkReceipt(order.id, rec.id)}
                                        >
                                          Verknüpfen
                                        </Button>
                                      </div>
                                    ))}
                                </div>
                              )}
                            </div>
                          )}

                          {linkedReceipts.length === 0 ? (
                            <p className="text-[11px] text-muted-foreground italic">
                              Noch keine Quittung mit dieser Bestellung verknüpft.
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              {linkedReceipts.map((rec) => (
                                <div
                                  key={rec.id}
                                  className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs"
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <div className="truncate">
                                      <p className="font-medium text-foreground truncate">{rec.title || "Beleg"}</p>
                                      <p className="text-[10px] text-muted-foreground">
                                        {rec.amount} • {rec.provider || "Zahlung"}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    {rec.file && (
                                      <a
                                        href={rec.file}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-600 text-white rounded text-[10px] font-semibold hover:bg-emerald-700"
                                      >
                                        <Download className="w-3 h-3" /> PDF
                                      </a>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleUnlinkReceipt(rec.id)}
                                      title="Verknüpfung aufheben"
                                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                    >
                                      <Unlink className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Footer: Date & Mail jump */}
                      <div className="mt-4 pt-2 border-t flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>
                          {order.order_date
                            ? new Date(order.order_date).toLocaleDateString("de-DE", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : ""}
                        </span>
                        {order.raw_metadata?.lastMailSeq && onSelectMail && (
                          <button
                            onClick={() => onSelectMail(order.raw_metadata.lastMailSeq)}
                            className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                          >
                            Zur E-Mail <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {!loading && activeTab === "receipts" && (
          <>
            {filteredReceipts.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-sm">
                <Receipt className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
                <p className="font-semibold text-foreground">Keine Quittungen hinterlegt</p>
                <p className="text-xs mt-1">
                  Quittungs-E-Mails und PDF-Anhänge werden bei der KI-Analyse automatisch gespeichert.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredReceipts.map((rec) => {
                  const linkedOrder = orders.find((o) => o.id === rec.order);

                  return (
                    <div
                      key={rec.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-card rounded-xl border hover:border-primary/40 transition-all shadow-sm"
                    >
                      <div className="flex items-center gap-3 min-w-[240px]">
                        <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                          <Receipt className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground">
                              {rec.merchant || "Händler / Aussteller"}
                            </span>
                            {rec.amount && (
                              <Badge className="bg-emerald-600/10 text-emerald-600 border-emerald-500/20 text-xs font-bold">
                                {rec.amount}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate max-w-md">{rec.title}</p>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                            {rec.provider && <span>Zahlung: {rec.provider}</span>}
                            {rec.transaction_id && <span>• ID: {rec.transaction_id}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Associated Order info */}
                      <div className="flex items-center gap-2">
                        {linkedOrder ? (
                          <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20 flex items-center gap-1 font-medium">
                            <Package className="w-3 h-3" />
                            Bestellung #{linkedOrder.order_number || linkedOrder.merchant}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs text-muted-foreground">
                            Keine Bestellung verknüpft
                          </Badge>
                        )}
                      </div>

                      {/* Actions: Download PDF / View */}
                      <div className="flex items-center gap-2">
                        {rec.file ? (
                          <a
                            href={rec.file}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-sm"
                          >
                            <Download className="w-3.5 h-3.5" /> PDF Beleg
                          </a>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic px-2">Kein PDF</span>
                        )}

                        {rec.source_mail_id && onSelectMail && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onSelectMail(rec.source_mail_id)}
                            className="text-xs h-8"
                          >
                            E-Mail öffnen
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Upload Beleg Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-2xl border shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Upload className="w-4 h-4 text-primary" /> Beleg / Rechnung hochladen
              </h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadReceipt} className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground font-medium mb-1">Titel / Betreff</label>
                <Input
                  required
                  placeholder="z. B. Büromaterial Rechnung"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="text-xs h-8"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-muted-foreground font-medium mb-1">Händler / Aussteller</label>
                  <Input
                    placeholder="z. B. Amazon, Staples"
                    value={newMerchant}
                    onChange={(e) => setNewMerchant(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground font-medium mb-1">Betrag</label>
                  <Input
                    placeholder="z. B. 49,99 €"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="text-xs h-8"
                  />
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">Zahlungsmethode</label>
                <Input
                  placeholder="z. B. PayPal, Kreditkarte, Überweisung"
                  value={newProvider}
                  onChange={(e) => setNewProvider(e.target.value)}
                  className="text-xs h-8"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">Beleg-Datei (PDF / Bild)</label>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) => setNewFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-muted-foreground file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:opacity-90"
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowUploadModal(false)}
                  disabled={uploadLoading}
                >
                  Abbrechen
                </Button>
                <Button type="submit" size="sm" disabled={uploadLoading}>
                  {uploadLoading ? "Speichere..." : "In PocketBase speichern"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
