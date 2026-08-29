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
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getTrackingUrl, getStageLabel } from "@/lib/threadEngine";

const STANDARD_STAGES = [
  { id: "ordered", label: "Bestellt", icon: ShoppingBag },
  { id: "shipped", label: "Versendet", icon: Package },
  { id: "out_for_delivery", label: "In Zustellung", icon: Truck },
  { id: "delivered", label: "Zugestellt", icon: CheckCircle2 },
];

const RETURN_STAGES = [
  { id: "return_initiated", label: "Retoure", icon: RotateCcw },
  { id: "returned", label: "Eingegangen", icon: Package },
  { id: "refunded", label: "Erstattet", icon: CheckCircle2 },
];

const STAGE_INDEX_MAP = {
  ordered: 0,
  shipped: 1,
  out_for_delivery: 2,
  delivered: 3,
  return_initiated: 4,
  returned: 5,
  refunded: 6,
};

export function OrderTimelineCard({ orderJourney, onSelectMail, activeMailId }) {
  if (!orderJourney) return null;

  const {
    merchant = "Händler",
    orderId,
    trackingNumber,
    carrier,
    productSummary,
    currentStage = "ordered",
    estimatedDelivery,
    timeline = [],
  } = orderJourney;

  const isReturnFlow =
    currentStage === "return_initiated" ||
    currentStage === "returned" ||
    currentStage === "refunded";

  const activeIndex = STAGE_INDEX_MAP[currentStage] ?? 0;
  const stagesToRender = isReturnFlow
    ? [...STANDARD_STAGES, ...RETURN_STAGES]
    : STANDARD_STAGES;

  const trackingUrl = getTrackingUrl(carrier, trackingNumber);

  return (
    <div className="mx-4 my-3 rounded-lg border bg-card p-4 shadow-2xs space-y-3.5 text-xs text-foreground">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary border border-primary/20 shrink-0">
            <Package className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-foreground truncate">
                {productSummary || "Bestell- & Lieferverlauf"}
              </span>
              {merchant && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium">
                  {merchant}
                </Badge>
              )}
            </div>
            {orderId && (
              <p className="text-[11px] text-muted-foreground font-mono truncate">
                Bestell-Nr.: {orderId}
              </p>
            )}
          </div>
        </div>

        {/* Current status & tracking button */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/25 px-2.5 py-0.5 text-xs font-semibold text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            {getStageLabel(currentStage)}
          </span>

          {trackingUrl && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-7 text-xs px-2 gap-1 cursor-pointer"
            >
              <a href={trackingUrl} target="_blank" rel="noopener noreferrer">
                <span>{carrier ? `${carrier}-Tracking` : "Sendungsverfolgung"}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Visual Stepper */}
      <div className="relative pt-1 pb-1">
        <div className="grid grid-cols-4 sm:grid-cols-4 gap-2 relative">
          {stagesToRender.slice(0, 4).map((step, idx) => {
            const isCompleted = activeIndex > idx;
            const isCurrent = activeIndex === idx;
            const isPending = activeIndex < idx;

            const matchingStep = timeline.find((t) => t.stage === step.id);
            const IconComponent = step.icon;

            return (
              <div
                key={step.id}
                onClick={() => matchingStep && onSelectMail && onSelectMail(matchingStep.mailId)}
                className={cn(
                  "flex flex-col items-center text-center p-2 rounded-md transition-all",
                  matchingStep ? "cursor-pointer hover:bg-muted/40" : "opacity-60",
                  isCurrent && "bg-primary/5 border border-primary/20",
                  matchingStep && activeMailId === matchingStep.mailId && "ring-1 ring-primary"
                )}
              >
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all mb-1.5",
                    isCompleted && "bg-emerald-500 text-white shadow-2xs",
                    isCurrent && "bg-primary text-primary-foreground animate-pulse shadow-xs",
                    isPending && "bg-muted text-muted-foreground border border-border"
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <IconComponent className="h-3.5 w-3.5" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-[11px] font-medium leading-tight",
                    isCurrent ? "text-primary font-bold" : isCompleted ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
                {matchingStep && matchingStep.date && (
                  <span className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">
                    {new Date(matchingStep.date).toLocaleDateString([], {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Meta Footer Info */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-muted-foreground pt-2 border-t bg-muted/20 -mx-4 -mb-4 px-4 py-2.5 rounded-b-lg">
        <div className="flex flex-wrap items-center gap-3">
          {carrier && trackingNumber && (
            <span className="font-mono">
              <strong className="text-foreground">{carrier}:</strong> {trackingNumber}
            </span>
          )}
          {estimatedDelivery && (
            <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-medium">
              <Clock className="h-3 w-3" />
              Lieferung: {estimatedDelivery}
            </span>
          )}
        </div>

        <span className="text-[10px] text-muted-foreground/75">
          {timeline.length} zusammengehörige Status-Mails verknüpft
        </span>
      </div>
    </div>
  );
}
