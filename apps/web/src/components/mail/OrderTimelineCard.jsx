import React from "react";
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  ExternalLink,
  RotateCcw,
  ShoppingBag,
  MapPin,
  Receipt,
  AlertCircle,
  Check,
  Ticket,
  CreditCard,
  Calendar,
  Laptop,
  Key,
  Download,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getTrackingUrl, getStageLabel } from "@/lib/threadEngine";

function getHeaderIcon(orderType = "physical") {
  switch (orderType) {
    case "ticket":
      return Ticket;
    case "booking":
      return Calendar;
    case "digital":
      return Laptop;
    case "subscription":
      return RefreshCwIcon;
    default:
      return Package;
  }
}

function RefreshCwIcon(props) {
  return <CreditCard {...props} />;
}

function getMilestoneIcon(stage = "", orderType = "physical") {
  const s = stage.toLowerCase();
  if (s.includes("pay") || s.includes("bezahlt") || s.includes("rechnung") || s.includes("autorisiert")) {
    return CreditCard;
  }
  if (s.includes("ticket") || s.includes("barcode") || s.includes("einlass")) {
    return Ticket;
  }
  if (s.includes("digital") || s.includes("lizenz") || s.includes("zugang")) {
    return Key;
  }
  if (s.includes("order") || s.includes("bestell") || s.includes("buch")) {
    return orderType === "ticket" ? Ticket : orderType === "booking" ? Calendar : ShoppingBag;
  }
  if (s.includes("ship") || s.includes("versand") || s.includes("paket")) return Package;
  if (s.includes("delivery") || s.includes("zustell") || s.includes("unterwegs")) return Truck;
  if (s.includes("deliver") || s.includes("zugestellt") || s.includes("angekommen")) return CheckCircle2;
  if (s.includes("return") || s.includes("retoure") || s.includes("rück")) return RotateCcw;
  if (s.includes("refund") || s.includes("erstatt") || s.includes("gutschrift")) return Receipt;
  if (s.includes("cancel") || s.includes("storno")) return AlertCircle;
  return orderType === "ticket" ? Ticket : Package;
}

function formatMilestoneDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";

  return date.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OrderTimelineCard({ orderJourney, onSelectMail, activeMailId, receipts = [] }) {
  if (!orderJourney) return null;

  const {
    merchant = "Händler",
    orderType = "physical",
    orderId,
    trackingNumber,
    carrier,
    productSummary,
    amount,
    paymentProvider,
    transactionId,
    eventDate,
    venue,
    currentStage = "ordered",
    statusTitle,
    statusDetail,
    deliveryLocation,
    estimatedDelivery,
    milestones = [],
    receipts: journeyReceipts = [],
  } = orderJourney;

  const allReceipts = [...(receipts || []), ...(journeyReceipts || [])];

  const trackingUrl = getTrackingUrl(carrier, trackingNumber);
  const HeaderIcon = getHeaderIcon(orderType);

  const nodes = milestones.length > 0 ? milestones : [
    {
      id: "milestone_default",
      stage: currentStage,
      title: statusTitle || getStageLabel(currentStage),
      detail: statusDetail,
      status: "current",
    },
  ];

  return (
    <div className="mx-6 sm:mx-8 my-3 rounded-2xl border border-border/80 bg-gradient-to-b from-card to-muted/20 p-4 shadow-xs space-y-3.5 text-xs text-foreground transition-all">
      {/* 1. Header: Type Badge, Product/Event Summary, Payment & Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0 shadow-2xs">
            <HeaderIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-xs sm:text-sm text-foreground truncate">
                {productSummary || (orderType === "ticket" ? "Event / Ticket" : "Bestell- & Zahlungsverlauf")}
              </span>
              {merchant && (
                <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-medium border-border/80">
                  {merchant}
                </Badge>
              )}
              {orderType === "ticket" && (
                <span className="inline-flex items-center gap-1 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 px-1.5 py-0.2 text-[10px] font-semibold">
                  <Ticket className="h-2.5 w-2.5" />
                  Ticket
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-[11px] text-muted-foreground font-mono">
              {orderId && (
                <span>
                  Nr.: <span className="text-foreground/90 select-all">{orderId}</span>
                </span>
              )}
              {paymentProvider && (
                <span className="inline-flex items-center gap-1 text-foreground/85">
                  <CreditCard className="h-3 w-3 text-primary" />
                  {paymentProvider} {amount ? `(${amount})` : ""}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Current status pill & tracking/ticket button */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/25 px-3 py-1 text-xs font-semibold text-primary shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            {statusTitle || getStageLabel(currentStage)}
          </span>

          {trackingUrl && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-7 text-xs px-2.5 gap-1.5 cursor-pointer shadow-2xs hover:border-primary/40 hover:text-primary transition-all"
            >
              <a href={trackingUrl} target="_blank" rel="noopener noreferrer">
                <span>{carrier ? `${carrier}` : "Tracking"}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* 2. Connected Modular Visual Timeline */}
      <div className="relative pt-2 pb-1 overflow-x-auto">
        <div
          className="flex items-start justify-between min-w-[340px] relative gap-2"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${nodes.length}, minmax(0, 1fr))`,
          }}
        >
          {nodes.map((milestone, idx) => {
            const isCompleted = milestone.status === "completed";
            const isCurrent = milestone.status === "current";
            const isPending = milestone.status === "pending";
            const isClickable = Boolean(milestone.mailId);
            const isSelected = activeMailId && String(activeMailId) === String(milestone.mailId);

            const IconComp = getMilestoneIcon(milestone.stage, orderType);
            const isLast = idx === nodes.length - 1;

            return (
              <div
                key={milestone.id || idx}
                onClick={() => isClickable && onSelectMail && onSelectMail(milestone.mailId)}
                className={cn(
                  "relative flex flex-col items-center text-center group transition-all",
                  isClickable ? "cursor-pointer" : "cursor-default"
                )}
              >
                {/* Horizontal Connecting Line Track to NEXT node */}
                {!isLast && (
                  <div
                    className={cn(
                      "absolute top-4 left-[50%] right-[-50%] h-[2px] z-0 transition-colors",
                      isCompleted
                        ? "bg-emerald-500 dark:bg-emerald-500"
                        : isCurrent
                        ? "bg-gradient-to-r from-primary to-border"
                        : "border-t border-dashed border-border"
                    )}
                  />
                )}

                {/* Node Circle */}
                <div className="relative z-10 mb-2">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all duration-200",
                      isCompleted && "bg-emerald-500 text-white shadow-xs group-hover:scale-105",
                      isCurrent && "bg-primary text-primary-foreground shadow-sm ring-4 ring-primary/20 scale-105",
                      isPending && "bg-muted text-muted-foreground border border-border/80 border-dashed opacity-75",
                      isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background scale-110"
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4 stroke-[2.5]" />
                    ) : (
                      <IconComp className="h-3.5 w-3.5" />
                    )}
                  </div>
                </div>

                {/* Milestone Title */}
                <span
                  className={cn(
                    "text-[11px] leading-tight px-1 transition-colors",
                    isCurrent
                      ? "font-bold text-primary"
                      : isCompleted
                      ? "font-medium text-foreground group-hover:text-primary"
                      : "font-normal text-muted-foreground"
                  )}
                >
                  {milestone.title}
                </span>

                {/* Date / Detail */}
                {milestone.date ? (
                  <span className="text-[10px] text-muted-foreground mt-0.5 font-mono whitespace-nowrap">
                    {formatMilestoneDate(milestone.date)}
                  </span>
                ) : milestone.detail ? (
                  <span className="text-[10px] text-muted-foreground/80 mt-0.5 px-1 truncate max-w-[120px]">
                    {milestone.detail}
                  </span>
                ) : null}

                {/* Amount or Location pill */}
                {milestone.amount && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] text-primary mt-1 bg-primary/10 px-1.5 py-0.2 rounded font-mono font-medium">
                    {milestone.amount}
                  </span>
                )}
                {milestone.location && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] text-emerald-600 dark:text-emerald-400 mt-1 bg-emerald-500/10 px-1 py-0.2 rounded border border-emerald-500/20">
                    <MapPin className="h-2.5 w-2.5" />
                    {milestone.location}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Linked Receipts from PocketBase */}
      {allReceipts && allReceipts.length > 0 && (
        <div className="pt-2 pb-1 border-t flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-foreground flex items-center gap-1">
            <Receipt className="h-3 w-3 text-emerald-500" />
            Belege ({allReceipts.length}):
          </span>
          {allReceipts.map((rec, rIdx) => (
            <div
              key={rIdx}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-medium text-foreground"
            >
              <span>{rec.title || rec.merchant || "Beleg"}</span>
              {rec.amount && <span className="font-bold text-emerald-600 dark:text-emerald-400">({rec.amount})</span>}
              {rec.file && (
                <a
                  href={rec.file}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 text-primary hover:underline ml-1 font-semibold"
                >
                  <Download className="h-2.5 w-2.5" /> PDF
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 3. Meta Footer Info Bar: Event Date / Venue / Carrier / Payment details */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground pt-2.5 border-t bg-muted/20 -mx-4.5 -mb-4.5 px-4.5 py-2.5 rounded-b-xl">
        <div className="flex flex-wrap items-center gap-3">
          {eventDate && (
            <span className="flex items-center gap-1 text-foreground/90 font-medium">
              <Calendar className="h-3 w-3 text-primary" />
              Event: {eventDate}
            </span>
          )}

          {venue && (
            <span className="flex items-center gap-1 text-foreground/90 font-medium">
              <MapPin className="h-3 w-3 text-primary" />
              {venue}
            </span>
          )}

          {carrier && trackingNumber && (
            <span className="font-mono">
              <strong className="text-foreground">{carrier}:</strong> {trackingNumber}
            </span>
          )}

          {estimatedDelivery && (
            <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-medium">
              <Clock className="h-3 w-3" />
              Zustellung: {estimatedDelivery}
            </span>
          )}

          {amount && !eventDate && (
            <span className="flex items-center gap-1 text-foreground/90 font-mono font-medium">
              <CreditCard className="h-3 w-3 text-primary" />
              Betrag: {amount} {paymentProvider ? `(${paymentProvider})` : ""}
            </span>
          )}
        </div>

        <span className="text-[10px] text-muted-foreground/70">
          {nodes.filter((n) => n.mailId).length} E-Mails (inkl. Zahlungsbelege) verknüpft
        </span>
      </div>
    </div>
  );
}
