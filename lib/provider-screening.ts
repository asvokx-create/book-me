import "server-only";

import { scanContent } from "./content-safety";

export type ProviderScreeningInput = {
  emailVerified: boolean;
  phone: string;
  business: string;
  service: string;
  description: string;
  serviceArea: string;
};

export type ProviderScreeningResult = {
  allowed: boolean;
  score: number;
  summary: string;
  checks: Array<{ label: string; passed: boolean }>;
};

const placeholderPattern = /\b(?:asdf|fake listing|sample business|test business|test listing|do not book)\b/i;
const scamPattern = /\b(?:gift cards?|wire transfer|cashapp only|crypto only|guaranteed income|guaranteed returns?)\b/i;

export function screenProviderProfile(input: ProviderScreeningInput): ProviderScreeningResult {
  const phoneDigits = input.phone.replace(/\D/g, "");
  const combined = [input.business, input.service, input.description, input.serviceArea].join(" ");
  const contentResult = scanContent(combined);
  const checks = [
    { label: "Verified email", passed: input.emailVerified },
    { label: "Valid contact number", passed: phoneDigits.length >= 10 && phoneDigits.length <= 15 },
    { label: "Complete business details", passed: input.business.length >= 2 && input.business.length <= 80 },
    { label: "Clear service description", passed: input.description.length >= 30 && input.description.length <= 2000 },
    { label: "Professional, family-friendly content", passed: contentResult.allowed },
    { label: "No placeholder or suspicious payment language", passed: !placeholderPattern.test(combined) && !scamPattern.test(combined) },
  ];
  const passedCount = checks.filter((check) => check.passed).length;
  const score = Math.round((passedCount / checks.length) * 100);
  const failed = checks.filter((check) => !check.passed).map((check) => check.label.toLowerCase());

  return {
    allowed: failed.length === 0,
    score,
    summary: failed.length === 0
      ? "Automated screening passed. The profile may publish immediately."
      : `Update ${failed.join(", ")} before publishing.`,
    checks,
  };
}
