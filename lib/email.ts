import "server-only";

import { database } from "./database";

type EmailInput = {
  to: string;
  subject: string;
  heading: string;
  message: string;
  actionLabel?: string;
  actionUrl?: string;
  userId?: string;
  bookingId?: string;
  emailType: string;
};

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);
}

function absoluteUrl(value: string) {
  try { return new URL(value, appUrl).toString(); } catch { return appUrl; }
}

async function recordDelivery(input: EmailInput, status: "sent" | "skipped" | "failed", providerMessageId = "", errorMessage = "") {
  try {
    await database.query(
      `INSERT INTO email_delivery_log (user_id, booking_id, email_type, recipient, provider_message_id, status, error_message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [input.userId ?? null, input.bookingId ?? null, input.emailType, input.to, providerMessageId || null, status, errorMessage.slice(0, 500)],
    );
  } catch (error) {
    console.warn("Email delivery could not be recorded", error);
  }
}

export async function sendTransactionalEmail(input: EmailInput) {
  if (!isEmailConfigured()) {
    await recordDelivery(input, "skipped", "", "Email provider is not configured.");
    return { sent: false, skipped: true };
  }

  const actionUrl = input.actionUrl ? absoluteUrl(input.actionUrl) : "";
  const html = `<!doctype html><html><body style="margin:0;background:#f4f4ef;font-family:Arial,sans-serif;color:#183126"><div style="max-width:600px;margin:0 auto;padding:32px 18px"><div style="background:#fff;border:1px solid #dfe5df;border-radius:24px;padding:32px"><p style="font-weight:700;font-size:20px;margin:0 0 28px">BookMe</p><h1 style="font-size:28px;line-height:1.15;margin:0 0 16px">${escapeHtml(input.heading)}</h1><p style="font-size:16px;line-height:1.65;color:#5f7067;margin:0">${escapeHtml(input.message)}</p>${actionUrl ? `<p style="margin:28px 0 0"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#eee25a;color:#183126;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:999px">${escapeHtml(input.actionLabel ?? "Open BookMe")}</a></p>` : ""}<p style="font-size:12px;line-height:1.5;color:#829087;margin:30px 0 0">BookMe will never ask for your password by email.</p></div></div></body></html>`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        ...(input.bookingId && input.userId ? { "Idempotency-Key": [input.emailType, input.bookingId, input.userId].join("-").slice(0, 250) } : {}),
      },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [input.to], subject: input.subject, html }),
    });
    const result = await response.json().catch(() => ({})) as { id?: string; message?: string };
    if (!response.ok) throw new Error(result.message ?? `Email provider returned ${response.status}.`);
    await recordDelivery(input, "sent", result.id ?? "");
    return { sent: true, skipped: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email error";
    await recordDelivery(input, "failed", "", message);
    console.error("Transactional email failed", { type: input.emailType, message });
    return { sent: false, skipped: false };
  }
}

export function sendAuthEmail(input: { to: string; name?: string; url: string; kind: "verify" | "reset" }) {
  const verification = input.kind === "verify";
  return sendTransactionalEmail({
    to: input.to,
    subject: verification ? "Verify your BookMe email" : "Reset your BookMe password",
    heading: verification ? "Verify your email address" : "Reset your password",
    message: verification
      ? `Hi ${input.name || "there"}, confirm this email address to finish securing your BookMe account.`
      : `Hi ${input.name || "there"}, use the secure link below to choose a new BookMe password. If you did not request this, you can ignore this email.`,
    actionLabel: verification ? "Verify email" : "Reset password",
    actionUrl: input.url,
    emailType: verification ? "account_verification" : "password_reset",
  });
}
