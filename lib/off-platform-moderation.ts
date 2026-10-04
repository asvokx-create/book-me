export type CircumventionRisk = "none" | "low" | "medium" | "high";

export type MessageBookingContext = {
  bookingId: string | null;
  state: "none" | "quote" | "pending" | "confirmed" | "paid" | "completed";
  quoteStatus: string | null;
  bookingStatus: string | null;
  paymentStatus: string | null;
};

export type CircumventionAssessment = {
  riskLevel: CircumventionRisk;
  blocked: boolean;
  reason: string;
  triggeredRules: string[];
  signals: string[];
};

const WARNING = "This message was not sent because it may attempt to move a BubsBookings booking or payment off platform. BubsBookings does not allow using the marketplace to find customers or providers and then moving the transaction elsewhere to avoid platform fees.";

function normalizeMessage(value: string) {
  const base = value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s*([@.$:/-])\s*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return base.replace(/(?:\b[a-z]\s+){2,}[a-z]\b/g, (match) => match.replace(/\s+/g, ""));
}

function hasPhoneLikeValue(value: string) {
  const numeric = value.match(/(?:\+?1[\s().-]*)?(?:\d[\s().-]*){10}/);
  if (numeric) return true;
  const numberWords: Record<string, string> = { zero: "0", oh: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9" };
  const converted = value.split(/[^a-z0-9]+/).map((part) => numberWords[part] ?? (part.length === 1 && /\d/.test(part) ? part : " ")).join("");
  return /\d{7,}/.test(converted);
}

function matches(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

export function assessOffPlatformMessage(message: string, context: MessageBookingContext): CircumventionAssessment {
  const value = normalizeMessage(message);
  const signals: string[] = [];
  const rules: string[] = [];
  const add = (signal: string) => { if (!signals.includes(signal)) signals.push(signal); };
  const trigger = (rule: string) => { if (!rules.includes(rule)) rules.push(rule); };

  const paymentPlatform = matches(value, [
    /\bvenmo\b/, /\bcash\s?app\b/, /\bzelle\b/, /\bpaypal\b/, /paypal\.me\//,
  ]);
  const paymentHandle = /(?:\$[a-z][a-z0-9._-]{1,30}\b|(?:venmo|cashapp|paypal)(?:\s+(?:is|at|me))?\s+@?[a-z][a-z0-9._-]{2,30})/.test(value);
  const directPayment = matches(value, [
    /\bpay\s+(?:me\s+)?direct(?:ly)?\b/, /\bsend\s+(?:me\s+)?(?:the\s+)?money\b/,
    /\bpay\s+(?:me\s+)?(?:through|via|on|with)\s+(?:venmo|cash\s?app|zelle|paypal)\b/,
    /\b(?:venmo|cash\s?app|zelle|paypal)\s+(?:me|instead|direct(?:ly)?)\b/,
  ]);
  const feeAvoidance = matches(value, [
    /\bavoid\s+(?:the\s+)?(?:bubsbookings\s+)?fee(?:s)?\b/,
    /\bskip\s+(?:the\s+)?(?:app|platform|fee(?:s)?)\b/,
    /\bwithout\s+(?:the\s+)?(?:app|platform|fee(?:s)?)\b/,
    /\b(?:no|zero)\s+(?:platform\s+)?fee(?:s)?\b/,
  ]);
  const bookingBypass = matches(value, [
    /\bdon'?t\s+book\s+(?:it\s+)?(?:through|on|with)\s+bubsbookings\b/,
    /\bbook\s+(?:it\s+)?direct(?:ly)?(?:\s+with\s+me)?\b/,
    /\bbook\s+(?:with\s+)?me\s+(?:off|outside)\s+(?:the\s+)?(?:app|platform)\b/,
    /\bmove\s+(?:this|it|the\s+booking)\s+(?:off|outside)\s+(?:the\s+)?(?:app|platform)\b/,
  ]);
  const cancellation = /\bcancel\s+(?:this|it|the\s+booking|your\s+booking)\b/.test(value);
  const cheaper = /\b(?:cheaper|discount|lower\s+price|save\s+(?:you\s+)?money)\b/.test(value);
  const redirect = matches(value, [
    /\b(?:text|call|email|contact)\s+me\b/, /\b(?:text|call|email)\s+(?:this|my)\s+(?:number|phone|email)\b/,
    /\b(?:dm|message)\s+me\s+(?:on|through|via)\b/, /\b(?:instead|outside\s+(?:the\s+)?app)\b/,
  ]);
  const socialPlatform = /\b(?:instagram|insta|ig|facebook|messenger|whatsapp|telegram|signal|snapchat|tiktok)\b/.test(value);
  const email = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/.test(value);
  const url = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9][a-z0-9-]{1,62}\.(?:com|net|org|co|io|me|biz|book|app)(?:\/\S*)?\b/.test(value);
  const phone = hasPhoneLikeValue(value);
  const socialHandle = /(?:^|\s)@[a-z][a-z0-9._-]{2,30}\b/.test(value);
  const logistics = matches(value, [
    /\b(?:find|reach|get\s+to|arrive|arrival|gate|door|building|unit|apartment|parking|delivery|access|running\s+late)\b/,
    /\b(?:address|directions|entry|code)\b/,
  ]);
  const supportOrRefundContext = /\b(?:support\s+(?:said|asked|instructed)|refund(?:ed)?|reimburse(?:d)?)\b/.test(value);
  const booked = ["confirmed", "paid", "completed"].includes(context.state);
  const paid = ["paid", "completed"].includes(context.state);

  if (paymentPlatform) add("payment_platform");
  if (paymentHandle) add("payment_handle");
  if (directPayment) add("direct_payment_request");
  if (feeAvoidance) add("fee_avoidance");
  if (bookingBypass) add("booking_bypass");
  if (cancellation) add("booking_cancellation");
  if (cheaper) add("off_platform_discount");
  if (redirect) add("communication_redirect");
  if (socialPlatform || socialHandle) add("social_contact");
  if (email) add("email_address");
  if (url) add("external_url");
  if (phone) add("phone_number");

  if (booked && logistics && !directPayment && !feeAvoidance && !bookingBypass && !cancellation && !cheaper && !paymentPlatform) {
    return { riskLevel: "none", blocked: false, reason: "Booked-service logistics are allowed.", triggeredRules: [], signals: [] };
  }

  if (feeAvoidance || bookingBypass || (directPayment && (paymentPlatform || paymentHandle || phone || email || url || socialHandle || cheaper || cancellation)) || (cancellation && (directPayment || paymentPlatform || redirect)) || (cheaper && (directPayment || paymentPlatform || redirect))) {
    trigger("explicit_circumvention");
    return { riskLevel: "high", blocked: true, reason: WARNING + " Clear or repeated violations may lead to account review, suspension, or banning.", triggeredRules: rules, signals };
  }

  if ((directPayment && !paid) || (paymentPlatform && !paid && (redirect || paymentHandle)) || (redirect && !booked)) {
    trigger(paymentPlatform || directPayment ? "off_platform_payment" : "pre_booking_redirect");
    return { riskLevel: "medium", blocked: true, reason: WARNING, triggeredRules: rules, signals };
  }

  if (paymentPlatform && !paid && !supportOrRefundContext) {
    trigger("pre_payment_platform_discussion");
    return { riskLevel: "medium", blocked: true, reason: WARNING, triggeredRules: rules, signals };
  }

  if (signals.length > 0) {
    trigger(booked && logistics ? "booked_logistics_contact" : "contextual_contact_signal");
    return { riskLevel: "low", blocked: false, reason: "Potential off-platform signal logged without enforcement.", triggeredRules: rules, signals };
  }

  return { riskLevel: "none", blocked: false, reason: "No off-platform transaction signal detected.", triggeredRules: [], signals: [] };
}

export const OFF_PLATFORM_WARNING = WARNING;
