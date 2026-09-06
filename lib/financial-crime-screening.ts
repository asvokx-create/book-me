import "server-only";

import { createHash } from "node:crypto";
import { database } from "@/lib/database";

export type ListingFinancialCrimeInput = {
  businessName: string;
  title: string;
  category: string;
  description: string;
  priceCents: number;
};

export type ListingFinancialCrimeResult = {
  allowed: boolean;
  reviewRequired: boolean;
  score: number;
  level: "low" | "medium" | "high";
  category: "suspected financial crime" | null;
  reasons: string[];
  message: string | null;
};

type RiskSignal = {
  reason: string;
  weight: number;
  patterns: RegExp[];
};

const riskSignals: RiskSignal[] = [
  {
    reason: "Language suggesting concealment or laundering of funds",
    weight: 100,
    patterns: [
      /\b(?:launder|laundering)\s+(?:money|cash|funds|proceeds)\b/i,
      /\bclean(?:ing)?\s+(?:dirty\s+)?(?:money|cash|funds|proceeds)\b/i,
    ],
  },
  {
    reason: "Payment requested without a genuine service",
    weight: 90,
    patterns: [
      /\b(?:fake|dummy|fabricated)\s+(?:invoice|receipt|booking|service|job)\b/i,
      /\b(?:no|without)\s+(?:actual\s+|real\s+)?(?:service|work|job)\s+(?:needed|required|performed)\b/i,
      /\b(?:book|booking|charge|payment)\s+(?:only\s+)?(?:to|for)\s+(?:move|transfer|process)\s+(?:money|cash|funds)\b/i,
    ],
  },
  {
    reason: "Overpayment or refund-difference arrangement",
    weight: 90,
    patterns: [
      /\boverpay(?:ment|ing|s|ed)?\b.{0,80}\b(?:refund|return|send\s+back|difference)\b/i,
      /\brefund\b.{0,50}\b(?:difference|extra|remaining|balance)\b/i,
    ],
  },
  {
    reason: "Pass-through payment or cash-out service",
    weight: 75,
    patterns: [
      /\b(?:cash\s*out|payment\s*processing|move\s+funds|pass[- ]through\s+(?:payment|funds)|third[- ]party\s+payments?)\b/i,
      /\baccept(?:ing|s)?\s+payments?\s+(?:for|on\s+behalf\s+of)\s+(?:another|others?|third\s+part)\b/i,
      /\b(?:keep|take)\s+(?:a\s+)?(?:percentage|percent|cut|fee)\b.{0,60}\b(?:send|return|refund|transfer)\b/i,
    ],
  },
  {
    reason: "Off-platform cash-equivalent payment instructions",
    weight: 60,
    patterns: [
      /\b(?:pay|send|transfer)\b.{0,35}\b(?:gift\s*cards?|cryptocurrency|crypto|bitcoin|wire\s+transfer|money\s+order|cash\s*app|cashapp)\b/i,
      /\b(?:gift\s*cards?|cryptocurrency|crypto|bitcoin|wire\s+transfer|money\s+order|cash\s*app|cashapp)\s+only\b/i,
    ],
  },
  {
    reason: "Language suggesting secrecy or avoidance of checks",
    weight: 45,
    patterns: [
      /\b(?:no\s+questions\s+asked|off\s+the\s+books|avoid\s+(?:bank|tax|reporting|verification)|bypass\s+(?:bank|tax|reporting|verification))\b/i,
    ],
  },
];

function listingText(input: ListingFinancialCrimeInput) {
  return [input.businessName, input.title, input.category, input.description].join("\n").trim();
}

export function assessListingFinancialCrimeRisk(input: ListingFinancialCrimeInput): ListingFinancialCrimeResult {
  const content = listingText(input);
  const matched = riskSignals.filter((signal) => signal.patterns.some((pattern) => pattern.test(content)));
  const reasons = matched.map((signal) => signal.reason);
  let score = matched.reduce((total, signal) => total + signal.weight, 0);

  if (input.priceCents >= 10_000_00 && input.description.trim().length < 80) {
    score += 25;
    reasons.push("Unusually high price paired with a very limited service description");
  }
  if (input.priceCents >= 100_000_00) {
    score += 35;
    reasons.push("Exceptionally high listing price requires additional review");
  }

  score = Math.min(100, score);
  const reviewRequired = score >= 45;
  const level = score >= 70 ? "high" : score >= 45 ? "medium" : "low";

  return {
    allowed: !reviewRequired,
    reviewRequired,
    score,
    level,
    category: reviewRequired ? "suspected financial crime" : null,
    reasons,
    message: reviewRequired
      ? "This listing cannot be published because its payment or service language requires a financial-safety review. BubsBookings may only be used to pay for genuine services through the supported checkout flow."
      : null,
  };
}

export async function checkAndRecordListingFinancialCrimeRisk({
  userId,
  surface,
  input,
  action = "blocked",
}: {
  userId: string;
  surface: string;
  input: ListingFinancialCrimeInput;
  action?: "blocked" | "flagged";
}) {
  const result = assessListingFinancialCrimeRisk(input);
  if (!result.reviewRequired) return result;

  try {
    await database.query(
      `INSERT INTO moderation_events (user_id, surface, category, severity, action, content_hash)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        surface,
        result.category,
        result.level === "high" ? "high" : "medium",
        action,
        createHash("sha256").update(`${listingText(input)}\n${input.priceCents}`).digest("hex"),
      ],
    );
  } catch (error) {
    console.error("Financial-crime screening event logging failed", error);
  }

  return result;
}
