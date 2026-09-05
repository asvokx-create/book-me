import { createHash } from "node:crypto";
import { database } from "@/lib/database";

export type SafetySeverity = "medium" | "high" | "critical";

export type SafetyResult = {
  allowed: boolean;
  category: string | null;
  severity: SafetySeverity | null;
  message: string | null;
};

type SafetyRule = {
  category: string;
  severity: SafetySeverity;
  patterns: RegExp[];
};

const rules: SafetyRule[] = [
  {
    category: "credible threat or self-harm encouragement",
    severity: "critical",
    patterns: [
      /\b(?:i(?:'|’)ll|i will|i am going to|im going to|gonna)\s+(?:kill|shoot|stab|hurt)\b/,
      /\b(?:kill|hurt)\s+(?:yourself|urself)\b/,
      /\b(?:bomb threat|school shooting|mass shooting)\b/,
    ],
  },
  {
    category: "sexual or exploitative content",
    severity: "critical",
    patterns: [
      /\b(?:child porn|child pornography|underage sex|sexual minor|nude minor)\b/,
      /\b(?:rape|raping|molest|molesting)\b/,
    ],
  },
  {
    category: "hateful or abusive language",
    severity: "high",
    patterns: [
      /\b(?:nigger|nigga|faggot|chink|kike|wetback)\b/,
      /\b(?:white power|heil hitler|gas the jews)\b/,
    ],
  },
  {
    category: "explicit sexual content",
    severity: "high",
    patterns: [
      /\b(?:porn|pornography|blowjob|handjob|cumshot|onlyfans)\b/,
      /\b(?:send nudes|nude pics|sexual services)\b/,
    ],
  },
  {
    category: "illegal transaction",
    severity: "high",
    patterns: [
      /\b(?:buy|sell|selling|deal|dealing)\s+(?:cocaine|meth|heroin|fentanyl)\b/,
      /\b(?:stolen credit card|fake id|counterfeit money)\b/,
    ],
  },
  {
    category: "profanity or harassment",
    severity: "medium",
    patterns: [
      /\b(?:fuck|fucking|motherfucker|shit|bullshit|bitch|bastard|asshole|dickhead)\b/,
      /\b(?:you(?:'|’)re|you are|ur)\s+(?:an?\s+)?(?:idiot|moron|loser|stupid)\b/,
    ],
  },
];

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[@4]/g, "a")
    .replace(/[3]/g, "e")
    .replace(/[1!|]/g, "i")
    .replace(/[0]/g, "o")
    .replace(/[$5]/g, "s")
    .replace(/[7]/g, "t")
    .replace(/[^a-z0-9'’]+/g, " ")
    .replace(/(.)\1{2,}/g, "$1$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function scanContent(value: string): SafetyResult {
  const normalized = normalize(value);
  for (const rule of rules) {
    if (rule.patterns.some((pattern) => pattern.test(normalized))) {
      const message = rule.severity === "critical"
        ? "This content may put someone at risk and cannot be posted. Keep BubsBookings safe and professional."
        : rule.severity === "high"
          ? "This content cannot be posted. Remove hateful, sexual, illegal, threatening, or abusive language."
          : "Please remove profanity or insulting language and keep BubsBookings professional and family-friendly.";
      return { allowed: false, category: rule.category, severity: rule.severity, message };
    }
  }
  return { allowed: true, category: null, severity: null, message: null };
}

export async function checkAndRecordContent({
  userId,
  surface,
  fields,
}: {
  userId: string;
  surface: string;
  fields: string[];
}): Promise<SafetyResult> {
  for (const value of fields) {
    if (!value.trim()) continue;
    const result = scanContent(value);
    if (!result.allowed) {
      const contentHash = createHash("sha256").update(value).digest("hex");
      try {
        await database.query(
          `INSERT INTO moderation_events (user_id, surface, category, severity, action, content_hash)
           VALUES ($1, $2, $3, $4, 'blocked', $5)`,
          [userId, surface, result.category, result.severity, contentHash],
        );
      } catch (error) {
        console.error("Moderation event logging failed", error);
      }
      return result;
    }
  }
  return { allowed: true, category: null, severity: null, message: null };
}
