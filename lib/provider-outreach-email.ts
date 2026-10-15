import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);
}

function mailbox(value: string) {
  const matched = value.match(/<([^<>]+)>\s*$/)?.[1]?.trim() ?? value.trim();
  return emailPattern.test(matched) ? matched : "";
}

function tokenSecret() {
  const configured = process.env.OUTREACH_TOKEN_SECRET?.trim() || "";
  return configured ? createHmac("sha256", configured).update("bubsbookings-provider-outreach-v1").digest("hex") : "";
}

export function outreachSender() {
  return (process.env.OUTREACH_EMAIL_FROM?.trim() || "BubsBookings <christian@bubsbookings.com>");
}

export function outreachPostalAddress() {
  return process.env.OUTREACH_POSTAL_ADDRESS?.trim() || "";
}

function resendApiKey() {
  return process.env.RESEND_MARKETING_API_KEY?.trim() || process.env.RESEND_API_KEY?.trim() || "";
}

export function isOutreachEmailConfigured() {
  return Boolean(resendApiKey() && mailbox(outreachSender()) && outreachPostalAddress() && tokenSecret());
}

export function signedOutreachUnsubscribeToken(input: { deliveryId: string; email: string }) {
  const secret = tokenSecret();
  if (!secret) return "";
  const body = Buffer.from(JSON.stringify({ ...input, exp: String(Date.now() + 365 * 24 * 60 * 60 * 1000) })).toString("base64url");
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
}

export function readOutreachUnsubscribeToken(token: string) {
  try {
    const [body, signature] = token.split(".");
    const secret = tokenSecret();
    if (!body || !signature || !secret) return null;
    const expected = createHmac("sha256", secret).update(body).digest();
    const actual = Buffer.from(signature, "base64url");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString()) as { deliveryId?: string; email?: string; exp?: string };
    return parsed.deliveryId && parsed.email && Number(parsed.exp) > Date.now() ? { deliveryId: parsed.deliveryId, email: parsed.email } : null;
  } catch { return null; }
}

export function renderOutreachEmail(input: { businessName: string; subject: string; body: string; deliveryId: string; recipientEmail: string }) {
  const token = signedOutreachUnsubscribeToken({ deliveryId: input.deliveryId, email: input.recipientEmail });
  const unsubscribeUrl = `${appUrl}/outreach/unsubscribe?token=${encodeURIComponent(token)}`;
  const plainBody = escapeHtml(input.body).replace(/\n/g, "<br>");
  const sender = outreachSender();
  const address = escapeHtml(outreachPostalAddress());
  const html = `<!doctype html><html><body style="margin:0;background:#f4f4ef;font-family:Arial,sans-serif;color:#183126"><div style="max-width:620px;margin:0 auto;padding:28px 14px"><div style="background:#fff;border:1px solid #dfe5df;border-radius:24px;overflow:hidden"><div style="height:8px;background:#183126"></div><div style="padding:32px"><p style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">BubsBookings</p><div style="font-size:16px;line-height:1.65;color:#52665b">${plainBody}</div><p style="font-size:12px;line-height:1.55;color:#718078;border-top:1px solid #e4e8e4;padding-top:22px;margin-top:30px">Advertisement from BubsBookings. You are receiving this message because your business publicly lists this contact address and may be a fit for our local-service marketplace. <a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe from future BubsBookings provider outreach</a>.<br><br>${address}</p></div></div></div></body></html>`;
  return { sender, unsubscribeUrl, html };
}

export async function sendOutreachEmail(input: { to: string; subject: string; html: string; unsubscribeUrl: string; idempotencyKey: string }) {
  const apiKey = resendApiKey();
  if (!isOutreachEmailConfigured() || !apiKey) return { sent: false as const, error: "Outreach sending is not configured." };
  const oneClickUrl = input.unsubscribeUrl.replace("/outreach/unsubscribe?", "/api/outreach/unsubscribe?");
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": input.idempotencyKey },
      body: JSON.stringify({ from: outreachSender(), to: [input.to], reply_to: mailbox(outreachSender()), subject: input.subject, html: input.html, headers: { "List-Unsubscribe": `<${oneClickUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }),
    });
    const result = await response.json().catch(() => ({})) as { id?: string; message?: string };
    if (!response.ok) {
      console.error("Provider outreach email delivery failed", { status: response.status, message: result.message });
      return { sent: false as const, error: "The email provider could not accept this approved message." };
    }
    return { sent: true as const, messageId: result.id ?? "" };
  } catch (error) {
    console.error("Provider outreach email request failed", error);
    return { sent: false as const, error: "The email provider could not be reached. Please retry later." };
  }
}
