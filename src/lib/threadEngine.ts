import { getCachedAnalysis, type AiAnalysisResult, type OrderInfo } from "./aiCache";

export interface TimelineStep {
  stage: "ordered" | "shipped" | "out_for_delivery" | "delivered" | "return_initiated" | "returned" | "refunded";
  label: string;
  date?: string;
  mailId: string | number;
  mailSubject: string;
}

export interface OrderJourney {
  merchant?: string | null;
  orderId?: string | null;
  trackingNumber?: string | null;
  carrier?: string | null;
  productSummary?: string | null;
  currentStage: "ordered" | "shipped" | "out_for_delivery" | "delivered" | "return_initiated" | "returned" | "refunded" | string;
  estimatedDelivery?: string | null;
  timeline: TimelineStep[];
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
  shipped: 2,
  out_for_delivery: 3,
  delivered: 4,
  return_initiated: 5,
  returned: 6,
  refunded: 7,
};

export function getStageLabel(stage: string): string {
  switch (stage?.toLowerCase()) {
    case "ordered":
      return "Bestellt";
    case "shipped":
      return "Versendet";
    case "out_for_delivery":
      return "In Zustellung";
    case "delivered":
      return "Zugestellt";
    case "return_initiated":
      return "Retoure angemeldet";
    case "returned":
      return "Retourniert";
    case "refunded":
      return "Erstattet";
    default:
      return stage || "Status unklar";
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
 * Groups an array of emails into conversation threads and smart order threads.
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

  // 2. Identify and group Order / Shipping Emails
  for (const mail of enrichedMails) {
    const orderInfo = mail._ai?.orderInfo;
    if (orderInfo && orderInfo.isOrder) {
      let orderKey: string | null = null;

      if (orderInfo.orderId && orderInfo.orderId.length > 3) {
        orderKey = `order:id:${orderInfo.merchant || "shop"}:${orderInfo.orderId.toLowerCase().trim()}`;
      } else if (orderInfo.trackingNumber && orderInfo.trackingNumber.length > 4) {
        orderKey = `order:track:${orderInfo.carrier || "carrier"}:${orderInfo.trackingNumber.toLowerCase().trim()}`;
      } else if (orderInfo.merchant && orderInfo.productSummary) {
        // Approximate matching by merchant + short product signature
        const prodSig = orderInfo.productSummary.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16);
        orderKey = `order:prod:${orderInfo.merchant.toLowerCase().trim()}:${prodSig}`;
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

  // 3. Group remaining emails by normalized subject / conversation
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
      // Aggregate Order Details across all emails in this order thread
      let merchant: string | null = null;
      let orderId: string | null = null;
      let trackingNumber: string | null = null;
      let carrier: string | null = null;
      let productSummary: string | null = null;
      let estimatedDelivery: string | null = null;
      let highestStageRank = 0;
      let currentStage: string = "ordered";

      const timeline: TimelineStep[] = [];

      // Walk through from oldest to newest to build chronological timeline
      const chronological = [...sorted].reverse();

      for (const m of chronological) {
        const o = m._ai?.orderInfo;
        if (o) {
          if (!merchant && o.merchant) merchant = o.merchant;
          if (!orderId && o.orderId) orderId = o.orderId;
          if (!trackingNumber && o.trackingNumber) trackingNumber = o.trackingNumber;
          if (!carrier && o.carrier) carrier = o.carrier;
          if (!productSummary && o.productSummary) productSummary = o.productSummary;
          if (o.estimatedDelivery) estimatedDelivery = o.estimatedDelivery;

          const stage = (o.stage || "ordered").toLowerCase();
          const rank = STAGE_ORDER[stage] || 1;
          if (rank >= highestStageRank) {
            highestStageRank = rank;
            currentStage = stage;
          }

          timeline.push({
            stage: stage as any,
            label: getStageLabel(stage),
            date: m.date,
            mailId: m._id,
            mailSubject: m.subject || "(Kein Betreff)",
          });
        }
      }

      orderJourney = {
        merchant: merchant || "Bestellung",
        orderId,
        trackingNumber,
        carrier,
        productSummary,
        currentStage,
        estimatedDelivery,
        timeline,
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

  // Build order threads
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
