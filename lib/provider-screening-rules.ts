export const placeholderPattern = /\b(?:asdf|fake listing|sample business|test business|test listing|do not book)\b/i;

// Mentioning a legitimate offering such as gift cards must not block a listing.
// Only payment instructions that direct a customer to use an off-platform cash
// equivalent are screened here; the financial-crime review applies separately.
const offPlatformPaymentInstructionPattern = /\b(?:(?:pay|send|transfer)\b.{0,35}\b(?:gift\s*cards?|cryptocurrency|crypto|bitcoin|wire\s+transfer|money\s+order|cash\s*app|cashapp)|(?:gift\s*cards?|cryptocurrency|crypto|bitcoin|wire\s+transfer|money\s+order|cash\s*app|cashapp)\s+only|guaranteed\s+(?:income|returns?))\b/i;

export function hasOffPlatformPaymentInstruction(content: string) {
  return offPlatformPaymentInstructionPattern.test(content);
}
