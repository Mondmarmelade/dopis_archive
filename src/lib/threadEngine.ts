import {
  getCachedAnalysis,
  type AiAnalysisResult,
  type OrderInfo,
  type PaymentInfo,
} from "./aiCache";

export type MilestoneStatus = "completed" | "current" | "pending";

export interface TimelineMilestone {
  id: string;
  stage: string;
  title: string;
  detail?: string | null;
  date?: string | null;
  mailId?: string | number | null;
  mailSubject?: string | null;
  status: MilestoneStatus;
  isPredicted?: boolean;
  carrier?: string | null;
  trackingNumber?: string | null;
  location?: string | null;
  provider?: string | null;
  amount?: string | null;
}

export interface OrderJourney {
  merchant?: string | null;
  orderType: "physical" | "digital" | "ticket" | "booking" | "subscription" | "service";
  orderId?: string | null;
  trackingNumber?: string | null;
  carrier?: string | null;
  productSummary?: string | null;
  amount?: string | null;
  paymentProvider?: string | null;
  transactionId?: string | null;
  eventDate?: string | null;
  venue?: string | null;
  currentStage: string;
  statusTitle?: string | null;
  statusDetail?: string | null;
  deliveryLocation?: string | null;
  estimatedDelivery?: string | null;
  milestones: TimelineMilestone[];
  timeline: TimelineMilestone[]; // Alias for backwards compatibility
}

export interface ThreadItem {
  id: string;
  subject: string;
  mails: any[];
  latestMail: any;
  count: number;
  hasUnread: boolean;
  isOrderThread: boolean;
  orderJourney?: OrderJourney | null;
  participants: { name: string; email: string }[];
  date: string;
}

// Stage ranking for progression calculation
const STAGE_ORDER: Record<string, number> = {
  ordered: 1,
  payment_confirmed: 2,
  tickets_issued: 3,
  digital_delivered: 4,
  shipped: 5,
  out_for_delivery: 6,
  delivered: 7,
  return_initiated: 8,
  return_dropped: 9,
  returned: 10,
  refunded: 11,
  cancelled: 12,
};

export function getStageLabel(stage: string): string {
  switch (stage?.toLowerCase()) {
    case "ordered":
      return "Bestellt / Gebucht";
    case "payment_confirmed":
      return "Zahlung verbucht";
    case "tickets_issued":
      return "Tickets bereit";
    case "digital_delivered":
      return "Bereitgestellt";
    case "shipped":
      return "Versendet";
    case "out_for_delivery":
      return "In Zustellung";
    case "delivered":
      return "Zugestellt";
    case "return_initiated":
      return "Retoure angemeldet";
    case "return_dropped":
      return "Retoure abgegeben";
    case "returned":
      return "Retourniert";
    case "refunded":
      return "Erstattet";
    case "cancelled":
      return "Storniert";
    default:
      return stage || "Status unklar";
  }
}

export function getDefaultMilestoneTitle(stage: string, orderType: string = "physical", provider?: string | null): string {
  switch (stage?.toLowerCase()) {
    case "ordered":
      return orderType === "ticket"
        ? "Ticket-Bestellung bestätigt"
        : orderType === "booking"
        ? "Buchung bestätigt"
        : "Bestellung bestätigt";
    case "payment_confirmed":
      return provider ? `Zahlung via ${provider} verbucht` : "Zahlung bestätigt";
    case "tickets_issued":
      return "E-Tickets & Barcode bereitgestellt";
    case "digital_delivered":
      return "Digitales Produkt / Zugang freigeschaltet";
    case "shipped":
      return "Paket verschickt";
    case "out_for_delivery":
      return "In Zustellung heute";
    case "delivered":
      return "Erfolgreich zugestellt";
    case "return_initiated":
      return "Retourenschein erstellt";
    case "return_dropped":
      return "Retoure bei Paketdienst abgegeben";
    case "returned":
      return "Im Lager eingetroffen";
    case "refunded":
      return "Gutschrift / Erstattung verbucht";
    case "cancelled":
      return "Bestellung storniert";
    default:
      return getStageLabel(stage);
  }
}

export function getTrackingUrl(carrier?: string | null, trackingNumber?: string | null): string | null {
  if (!trackingNumber) return null;
  const num = encodeURIComponent(trackingNumber.trim());
  const c = carrier?.toLowerCase() || "";

  if (c.includes("dhl") || c.includes("deutsche post")) {
    return `https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${num}`;
  }
  if (c.includes("hermes")) {
    return `https://www.myhermes.de/empfangen/sendungsverfolgung/sendungsdetails#${num}`;
  }
  if (c.includes("dpd")) {
    return `https://tracking.dpd.de/status/de_DE/parcel/${num}`;
  }
  if (c.includes("ups")) {
    return `https://www.ups.com/track?tracknum=${num}`;
  }
  if (c.includes("gls")) {
    return `https://www.gls-pakete.de/sendungsverfolgung?match=${num}`;
  }
  if (c.includes("amazon")) {
    return `https://www.amazon.de/gp/your-account/order-history`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(`${carrier || "Paket"} Sendungsverfolgung ${trackingNumber}`)}`;
}

/**
 * Normalizes an email subject by stripping prefixes (Re:, Fwd:, Aw:, Wg:, etc.)
 */
export function normalizeSubject(subject: string = ""): string {
  if (!subject) return "";
  let clean = subject.trim();

  // Repeatedly remove prefixes
  const prefixRegex = /^(?:\[(?:extern|external|spam|newsletter)\]\s*|(?:\b(?:re|fwd|fw|aw|wg|sv|vs|antw|betr)\b(?:\s*\[\d+\])?\s*:\s*))+/i;
  let previous;
  do {
    previous = clean;
    clean = clean.replace(prefixRegex, "").trim();
  } while (clean !== previous && clean.length > 0);

  // Collapse multiple spaces
  return clean.replace(/\s+/g, " ").toLowerCase();
}

/**
 * Normalizes merchant names (e.g. "CTS Eventim AG & Co. KGaA" -> "eventim")
 */
export function normalizeMerchant(name: string = ""): string {
  if (!name) return "";
  let clean = name.toLowerCase().trim();
  clean = clean.replace(/\b(ag|gmbh|co|kgaa|inc|corp|ltd|llc|bv|se|sa|de|com)\b/g, "").trim();
  clean = clean.replace(/[^a-z0-9]/g, "");
  return clean;
}

/**
 * Groups an array of emails into conversation threads, smart order journeys, and payment provider threads.
 */
export function groupMailsIntoThreads(
  mails: any[] = [],
  aiMap: Record<string, AiAnalysisResult> = {}
): ThreadItem[] {
  if (!Array.isArray(mails) || mails.length === 0) {
    return [];
  }

  // 1. First pass: Collect AI analysis for each mail
  const enrichedMails = mails.map((mail) => {
    const id = mail.id || mail.seq;
    const ai = aiMap[id] || getCachedAnalysis(id);
    return {
      ...mail,
      _id: id,
      _ai: ai,
      _dateObj: mail.date ? new Date(mail.date) : new Date(0),
    };
  });

  // Group maps
  const orderGroups = new Map<string, typeof enrichedMails>();
  const subjectGroups = new Map<string, typeof enrichedMails>();
  const processedMailIds = new Set<string | number>();

  // 2. Identify Order / Shipping / Ticket / Payment Emails
  // First, extract all direct orders with IDs or Tracking numbers
  for (const mail of enrichedMails) {
    const orderInfo = mail._ai?.orderInfo;
    const paymentInfo = mail._ai?.paymentInfo;

    if (orderInfo && (orderInfo.isOrder || orderInfo.orderType)) {
      let orderKey: string | null = null;
      const merchantNorm = normalizeMerchant(orderInfo.merchant || "");

      if (orderInfo.orderId && orderInfo.orderId.length > 3) {
        orderKey = `order:id:${merchantNorm || "shop"}:${orderInfo.orderId.toLowerCase().trim()}`;
      } else if (orderInfo.trackingNumber && orderInfo.trackingNumber.length > 4) {
        orderKey = `order:track:${orderInfo.carrier || "carrier"}:${orderInfo.trackingNumber.toLowerCase().trim()}`;
      } else if (merchantNorm && orderInfo.productSummary) {
        // Approximate matching by merchant + short product signature
        const prodSig = orderInfo.productSummary.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16);
        orderKey = `order:prod:${merchantNorm}:${prodSig}`;
      }

      if (orderKey) {
        if (!orderGroups.has(orderKey)) {
          orderGroups.set(orderKey, []);
        }
        orderGroups.get(orderKey)!.push(mail);
        processedMailIds.add(mail._id);
      }
    }
  }

  // 3. Second pass for Payment Provider Receipts (PayPal, Klarna, Stripe, etc.)
  // Match payment receipts against existing orders by merchant & timeframe or group them by transaction
  for (const mail of enrichedMails) {
    if (processedMailIds.has(mail._id)) continue;

    const paymentInfo = mail._ai?.paymentInfo;
    const orderInfo = mail._ai?.orderInfo;

    if (paymentInfo && paymentInfo.isPaymentReceipt) {
      const paidToNorm = normalizeMerchant(paymentInfo.paidTo || "");
      let matchedGroupKey: string | null = null;

      // Check if we already have an order group matching this merchant within +/- 48h
      if (paidToNorm) {
        for (const [groupKey, groupMails] of orderGroups.entries()) {
          const groupHasMatchingMerchant = groupMails.some((m) => {
            const mNorm = normalizeMerchant(m._ai?.orderInfo?.merchant || "");
            const mSubj = (m.subject || "").toLowerCase();
            return (
              mNorm.includes(paidToNorm) ||
              paidToNorm.includes(mNorm) ||
              mSubj.includes(paidToNorm)
            );
          });

          if (groupHasMatchingMerchant) {
            // Check time proximity (e.g. within 72 hours)
            const mailTime = mail._dateObj.getTime();
            const isNearInTime = groupMails.some(
              (m) => Math.abs(m._dateObj.getTime() - mailTime) < 72 * 60 * 60 * 1000
            );

            if (isNearInTime) {
              matchedGroupKey = groupKey;
              break;
            }
          }
        }
      }

      if (matchedGroupKey) {
        orderGroups.get(matchedGroupKey)!.push(mail);
        processedMailIds.add(mail._id);
      } else if (paymentInfo.transactionId || paidToNorm) {
        // Group as a standalone payment receipt thread
        const payKey = paymentInfo.transactionId
          ? `pay:tx:${paymentInfo.transactionId}`
          : `pay:to:${paidToNorm}:${mail._dateObj.toISOString().slice(0, 10)}`;
        if (!orderGroups.has(payKey)) {
          orderGroups.set(payKey, []);
        }
        orderGroups.get(payKey)!.push(mail);
        processedMailIds.add(mail._id);
      }
    }
  }

  // 4. Group remaining emails by normalized subject / conversation
  for (const mail of enrichedMails) {
    if (processedMailIds.has(mail._id)) continue;

    const normSubj = normalizeSubject(mail.subject);
    const subjKey = normSubj.length > 2 ? `subj:${normSubj}` : `mail:${mail._id}`;

    if (!subjectGroups.has(subjKey)) {
      subjectGroups.set(subjKey, []);
    }
    subjectGroups.get(subjKey)!.push(mail);
  }

  const resultThreads: ThreadItem[] = [];

  // Helper to build a ThreadItem from an array of grouped emails
  const buildThread = (
    threadId: string,
    groupedMails: typeof enrichedMails,
    isOrder: boolean
  ): ThreadItem => {
    // Sort chronological: newest first
    const sorted = [...groupedMails].sort((a, b) => b._dateObj.getTime() - a._dateObj.getTime());
    const latest = sorted[0];

    const hasUnread = sorted.some((m) => !m.read);
    const participantsMap = new Map<string, string>();
    sorted.forEach((m) => {
      const email = m.email || m.from?.address || "";
      const name = m.name || m.from?.name || email;
      if (email) participantsMap.set(email, name);
    });

    const participants = Array.from(participantsMap.entries()).map(([email, name]) => ({
      name,
      email,
    }));

    let orderJourney: OrderJourney | null = null;

    if (isOrder) {
      let merchant: string | null = null;
      let orderType: OrderJourney["orderType"] = "physical";
      let orderId: string | null = null;
      let trackingNumber: string | null = null;
      let carrier: string | null = null;
      let productSummary: string | null = null;
      let amount: string | null = null;
      let paymentProvider: string | null = null;
      let transactionId: string | null = null;
      let eventDate: string | null = null;
      let venue: string | null = null;
      let estimatedDelivery: string | null = null;
      let deliveryLocation: string | null = null;
      let statusTitle: string | null = null;
      let statusDetail: string | null = null;
      let highestStageRank = 0;
      let currentStage: string = "ordered";

      // Walk through from oldest to newest to build actual chronological milestones
      const chronological = [...sorted].sort((a, b) => a._dateObj.getTime() - b._dateObj.getTime());
      const rawMilestones: TimelineMilestone[] = [];

      for (let i = 0; i < chronological.length; i++) {
        const m = chronological[i];
        const o = m._ai?.orderInfo;
        const p = m._ai?.paymentInfo;

        // Extract metadata from orderInfo
        if (o) {
          if (!merchant && o.merchant) merchant = o.merchant;
          if (o.orderType) orderType = o.orderType as any;
          if (!orderId && o.orderId) orderId = o.orderId;
          if (!trackingNumber && o.trackingNumber) trackingNumber = o.trackingNumber;
          if (!carrier && o.carrier) carrier = o.carrier;
          if (!productSummary && o.productSummary) productSummary = o.productSummary;
          if (!amount && o.amount) amount = o.amount;
          if (!eventDate && o.eventDate) eventDate = o.eventDate;
          if (!venue && o.venue) venue = o.venue;
          if (o.estimatedDelivery) estimatedDelivery = o.estimatedDelivery;
          if (o.deliveryLocation) deliveryLocation = o.deliveryLocation;
          if (o.statusTitle) statusTitle = o.statusTitle;
          if (o.statusDetail) statusDetail = o.statusDetail;

          const stage = (o.stage || "ordered").toLowerCase();
          const rank = STAGE_ORDER[stage] || 1;
          if (rank >= highestStageRank) {
            highestStageRank = rank;
            currentStage = stage;
          }

          rawMilestones.push({
            id: `milestone_${m._id}`,
            stage: stage,
            title: o.statusTitle || getDefaultMilestoneTitle(stage, orderType, paymentProvider),
            detail:
              o.statusDetail ||
              o.venue ||
              o.eventDate ||
              o.deliveryLocation ||
              (o.carrier ? `${o.carrier} ${o.trackingNumber || ""}` : null),
            date: m.date,
            mailId: m._id,
            mailSubject: m.subject || "(Kein Betreff)",
            status: "completed",
            carrier: o.carrier,
            trackingNumber: o.trackingNumber,
            location: o.deliveryLocation || o.venue,
            amount: o.amount,
          });
        }

        // Extract payment metadata
        if (p && p.isPaymentReceipt) {
          if (!merchant && p.paidTo) merchant = p.paidTo;
          if (!paymentProvider && p.provider) paymentProvider = p.provider;
          if (!amount && p.amount) amount = p.amount;
          if (!transactionId && p.transactionId) transactionId = p.transactionId;

          // If no order milestone was added for this specific email, add a payment milestone
          const alreadyAdded = rawMilestones.some((ms) => String(ms.mailId) === String(m._id));
          if (!alreadyAdded) {
            rawMilestones.push({
              id: `milestone_pay_${m._id}`,
              stage: "payment_confirmed",
              title: p.provider ? `Zahlung via ${p.provider} autorisiert` : "Zahlungsbeleg erhalten",
              detail: p.amount ? `Betrag: ${p.amount}${p.paidTo ? ` an ${p.paidTo}` : ""}` : p.paidTo,
              date: m.date,
              mailId: m._id,
              mailSubject: m.subject || "(Zahlungsbestätigung)",
              status: "completed",
              provider: p.provider,
              amount: p.amount,
            });
          }
        }
      }

      // Check if ticket keywords appear in product summary or merchant
      const summaryLower = (productSummary || "").toLowerCase();
      const merchantLower = (merchant || "").toLowerCase();
      if (
        summaryLower.includes("ticket") ||
        summaryLower.includes("konzert") ||
        summaryLower.includes("festival") ||
        summaryLower.includes("event") ||
        summaryLower.includes("eintritt") ||
        merchantLower.includes("eventim") ||
        merchantLower.includes("ticketmaster") ||
        merchantLower.includes("bahn")
      ) {
        orderType = "ticket";
      }

      // Mark the latest milestone in the chain as "current"
      if (rawMilestones.length > 0) {
        rawMilestones[rawMilestones.length - 1].status = "current";
      }

      // Dynamic predicted milestone for physical in-transit orders
      if (orderType === "physical") {
        const isDelivered = rawMilestones.some((ms) => ms.stage === "delivered");
        const isReturned = rawMilestones.some((ms) => ms.stage === "refunded" || ms.stage === "returned");
        const isCancelled = rawMilestones.some((ms) => ms.stage === "cancelled");

        if (!isDelivered && !isReturned && !isCancelled) {
          const lastStage = rawMilestones[rawMilestones.length - 1]?.stage;
          if (
            lastStage === "ordered" ||
            lastStage === "shipped" ||
            lastStage === "out_for_delivery" ||
            lastStage === "payment_confirmed"
          ) {
            rawMilestones.push({
              id: `milestone_predicted_delivery`,
              stage: "delivered",
              title: "Zustellung",
              detail: estimatedDelivery ? `Voraussichtlich: ${estimatedDelivery}` : "Wird zugestellt",
              date: null,
              mailId: null,
              status: "pending",
              isPredicted: true,
            });
          }
        }
      } else if (orderType === "ticket") {
        // For ticket bookings: if order is placed & paid but tickets not yet marked issued, add pending tickets node
        const hasTicketsIssued = rawMilestones.some((ms) => ms.stage === "tickets_issued");
        if (!hasTicketsIssued) {
          rawMilestones.push({
            id: `milestone_predicted_tickets`,
            stage: "tickets_issued",
            title: "Tickets & Einlass",
            detail: eventDate ? `Event am ${eventDate}` : "Bereitstellung vor Event",
            date: null,
            mailId: null,
            status: "pending",
            isPredicted: true,
          });
        }
      }

      // If return is initiated but not yet refunded, append pending "Erstattung"
      const isReturnInitiated = rawMilestones.some(
        (ms) => ms.stage === "return_initiated" || ms.stage === "return_dropped" || ms.stage === "returned"
      );
      const isRefunded = rawMilestones.some((ms) => ms.stage === "refunded");
      if (isReturnInitiated && !isRefunded) {
        rawMilestones.push({
          id: `milestone_predicted_refund`,
          stage: "refunded",
          title: "Erstattung",
          detail: "Ausstehend nach Prüfung",
          date: null,
          mailId: null,
          status: "pending",
          isPredicted: true,
        });
      }

      orderJourney = {
        merchant: merchant || (paymentProvider ? `Zahlung ${paymentProvider}` : "Bestellung"),
        orderType,
        orderId,
        trackingNumber,
        carrier,
        productSummary: productSummary || (paymentProvider && amount ? `Zahlung über ${amount}` : null),
        amount,
        paymentProvider,
        transactionId,
        eventDate,
        venue,
        currentStage,
        statusTitle,
        statusDetail,
        deliveryLocation,
        estimatedDelivery,
        milestones: rawMilestones,
        timeline: rawMilestones, // backwards compatibility
      };
    }

    return {
      id: threadId,
      subject: latest.subject || "(Kein Betreff)",
      mails: sorted,
      latestMail: latest,
      count: sorted.length,
      hasUnread,
      isOrderThread: isOrder,
      orderJourney,
      participants,
      date: latest.date,
    };
  };

  // Build order & payment threads
  for (const [key, group] of orderGroups.entries()) {
    resultThreads.push(buildThread(`thread_${key}`, group, true));
  }

  // Build subject/standard threads
  for (const [key, group] of subjectGroups.entries()) {
    resultThreads.push(buildThread(`thread_${key}`, group, false));
  }

  // Final sort: newest thread first
  return resultThreads.sort((a, b) => {
    const timeA = new Date(a.date || 0).getTime();
    const timeB = new Date(b.date || 0).getTime();
    return timeB - timeA;
  });
}
