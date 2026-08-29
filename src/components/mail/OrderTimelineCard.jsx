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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getTrackingUrl, getStageLabel } from "@/lib/threadEngine";

function getMilestoneIcon(stage = "") {
  const s = stage.toLowerCase();
  if (s.includes("order") || s.includes("bestell")) return ShoppingBag;
  if (s.includes("payment") || s.includes("rechnung") || s.includes("bezahlt")) return Receipt;
  if (s.includes("ship") || s.includes("versand") || s.includes("paket")) return Package;
  if (s.includes("delivery") || s.includes("zustell") || s.includes("unterwegs")) return Truck;
  if (s.includes("deliver") || s.includes("zugestellt") || s.includes("angekommen")) return CheckCircle2;
  if (s.includes("return") || s.includes("retoure") || s.includes("rück")) return RotateCcw;
  if (s.includes("refund") || s.includes("erstatt") || s.includes("gutschrift")) return Receipt;
  if (s.includes("cancel") || s.includes("storno")) return AlertCircle;
  return Package;
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

export function OrderTimelineCard({ orderJourney, onSelectMail, activeMailId }) {
  if (!orderJourney) return null;

  const {
    merchant = "Händler",
    orderId,
    trackingNumber,
    carrier,
    productSummary,
    currentStage = "ordered",
    statusTitle,
    statusDetail,
    deliveryLocation,
    estimatedDelivery,
    milestones = [],
  } = orderJourney;

  const trackingUrl = getTrackingUrl(carrier, trackingNumber);

  // If no milestones array exists, synthesize at least 1 current step
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
    <div className="mx-4 my-3 rounded-xl border bg-card p-4.5 shadow-2xs space-y-4 text-xs text-foreground transition-all">
      {/* 1. Header: Merchant, Product & Current Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0 shadow-2xs">
            <Package className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-xs sm:text-sm text-foreground truncate">
                {productSummary || "Bestell- & Lieferverlauf"}
              </span>
              {merchant && (
                <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-medium border-border/80">
                  {merchant}
                </Badge>
              )}
            </div>
            {orderId && (
              <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">
                Bestell-Nr.: <span className="text-foreground/90 select-all">{orderId}</span>
              </p>
            )}
          </div>
        </div>

        {/* Current status pill & tracking button */}
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

            const IconComp = getMilestoneIcon(milestone.stage);
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
                      isCompleted ? "bg-emerald-500 dark:bg-emerald-500" : isCurrent ? "bg-gradient-to-r from-primary to-border" : "border-t border-dashed border-border"
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

                {/* Date */}
                {milestone.date ? (
                  <span className="text-[10px] text-muted-foreground mt-0.5 font-mono whitespace-nowrap">
                    {formatMilestoneDate(milestone.date)}
                  </span>
                ) : milestone.detail ? (
                  <span className="text-[10px] text-muted-foreground/80 mt-0.5 px-1 truncate max-w-[120px]">
                    {milestone.detail}
                  </span>
                ) : null}

                {/* Detail pill on hover or active */}
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

      {/* 3. Meta Footer Info Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground pt-2.5 border-t bg-muted/20 -mx-4.5 -mb-4.5 px-4.5 py-2.5 rounded-b-xl">
        <div className="flex flex-wrap items-center gap-3">
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

          {deliveryLocation && (
            <span className="flex items-center gap-1 text-foreground/90 font-medium">
              <MapPin className="h-3 w-3 text-primary" />
              Ort: {deliveryLocation}
            </span>
          )}
        </div>

        <span className="text-[10px] text-muted-foreground/70">
          {nodes.filter((n) => n.mailId).length} E-Mails in diesem Ablauf verknüpft
        </span>
      </div>
    </div>
  );
}
