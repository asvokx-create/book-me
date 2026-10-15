import { resolve4 } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";

const MAX_PAGES = 3;
const MAX_REDIRECTS = 3;
const MAX_HTML_BYTES = 300_000;
const REQUEST_TIMEOUT_MS = 5_000;
const DISCOVERY_USER_AGENT = "BubsBookingsPublicContactReview/1.0 (+https://bubsbookings.com)";

export type PublicEmailMatch = {
  email: string;
  sourceUrl: string;
  checkedUrls: string[];
};

type FetchedPage = { url: URL; html: string; redirect?: URL };

function decodeHtml(value: string) {
  return value.replace(/&commat;|&#64;|&#x0*40;/gi, "@").replace(/&amp;/gi, "&");
}

function normalizedHost(host: string) {
  return host.toLowerCase().replace(/^www\./, "");
}

function isSameWebsite(first: URL, second: URL) {
  return normalizedHost(first.hostname) === normalizedHost(second.hostname);
}

function isPublicIpv4(address: string) {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = octets;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && (b === 0 || b === 168)) return false;
  if (a === 198 && (b === 18 || b === 19 || b === 51)) return false;
  if (a === 203 && b === 0) return false;
  return true;
}

function validWebsite(raw: string) {
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password || isIP(url.hostname)) return null;
    if (url.port && !['80', '443'].includes(url.port)) return null;
    return url;
  } catch {
    return null;
  }
}

function validEmail(value: string) {
  const email = value.trim().toLowerCase().replace(/^mailto:/i, "").split(/[?#]/, 1)[0];
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) && email.length <= 254 ? email : "";
}

export function extractPublicBusinessEmails(html: string, websiteHost: string) {
  // Script and style content can contain unrelated vendor addresses. Only use
  // contact information rendered or linked by the business website itself.
  const publicHtml = decodeHtml(html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " "));
  const matches = publicHtml.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,63}/gi) ?? [];
  const emailDomain = normalizedHost(websiteHost);
  return [...new Set(matches.map(validEmail).filter(Boolean))].sort((left, right) => {
    const leftPreferred = left.endsWith(`@${emailDomain}`) ? 1 : 0;
    const rightPreferred = right.endsWith(`@${emailDomain}`) ? 1 : 0;
    return rightPreferred - leftPreferred || left.localeCompare(right);
  });
}

export function publicContactPageUrls(html: string, source: URL) {
  const pages = new Map<string, URL>();
  const add = (value: string) => {
    try {
      const candidate = new URL(decodeHtml(value), source);
      if (['http:', 'https:'].includes(candidate.protocol) && isSameWebsite(source, candidate)) pages.set(candidate.toString(), candidate);
    } catch { /* Ignore malformed page links. */ }
  };

  for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = match[1] || match[2] || match[3] || "";
    const label = decodeHtml(match[4] || "").replace(/<[^>]+>/g, " ");
    if (/contact|reach|email|get in touch|about/i.test(`${href} ${label}`)) add(href);
  }
  add("/contact");
  return [...pages.values()].slice(0, MAX_PAGES - 1);
}

async function resolvePublicIpv4(host: string) {
  const addresses = await resolve4(host);
  const address = addresses.find(isPublicIpv4);
  if (!address) throw new Error("The website does not resolve to a public IPv4 address.");
  return address;
}

async function requestPublicPage(url: URL): Promise<FetchedPage> {
  const address = await resolvePublicIpv4(url.hostname);
  const useHttps = url.protocol === "https:";
  const requestPage = useHttps ? httpsRequest : httpRequest;

  return new Promise<FetchedPage>((resolve, reject) => {
    let settled = false;
    const settle = (callback: () => void) => { if (!settled) { settled = true; callback(); } };
    const request = requestPage({
      hostname: address,
      port: url.port || (useHttps ? 443 : 80),
      path: `${url.pathname}${url.search}`,
      method: "GET",
      family: 4,
      ...(useHttps ? { servername: url.hostname } : {}),
      headers: {
        Host: url.host,
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": DISCOVERY_USER_AGENT,
      },
    }, (response) => {
      const status = response.statusCode ?? 502;
      const location = response.headers.location;
      if (status >= 300 && status < 400 && location) {
        try {
          settle(() => resolve({ url, html: "", redirect: new URL(location, url) }));
        } catch {
          settle(() => reject(new Error("The website returned an invalid redirect.")));
        }
        response.resume();
        return;
      }
      if (status < 200 || status >= 300) {
        response.resume();
        settle(() => reject(new Error("The business website could not be opened.")));
        return;
      }
      const contentType = String(response.headers["content-type"] || "").toLowerCase();
      if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
        response.resume();
        settle(() => reject(new Error("The business website did not return a contact page.")));
        return;
      }
      let size = 0;
      let html = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => {
        size += Buffer.byteLength(chunk);
        if (size > MAX_HTML_BYTES) {
          response.destroy();
          settle(() => reject(new Error("The business website contact page is too large to review.")));
          return;
        }
        html += chunk;
      });
      response.on("end", () => settle(() => resolve({ url, html })));
      response.on("error", (error) => settle(() => reject(error)));
    });
    const timeout = setTimeout(() => request.destroy(new Error("The business website took too long to respond.")), REQUEST_TIMEOUT_MS);
    request.on("error", (error) => settle(() => reject(error)));
    request.on("close", () => clearTimeout(timeout));
    request.end();
  });
}

async function fetchSameWebsitePage(initial: URL) {
  let pageUrl = initial;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const page = await requestPublicPage(pageUrl);
    if (!page.redirect) return page;
    if (!isSameWebsite(initial, page.redirect)) throw new Error("The business website redirected away from its public site.");
    pageUrl = page.redirect;
  }
  throw new Error("The business website redirected too many times.");
}

/**
 * Reads only a business's own public website and a small set of its public
 * contact pages. It does not use data brokers, sign in, bypass access rules,
 * submit contact forms, or store anything. The caller must require a human
 * review before persisting a returned email address.
 */
export async function findPublicBusinessEmail(rawWebsite: string): Promise<PublicEmailMatch | null> {
  const initial = validWebsite(rawWebsite);
  if (!initial) throw new Error("Enter a public http or https business website first.");

  const pagesToVisit: URL[] = [initial];
  const visited = new Set<string>();
  const found = new Map<string, string>();

  while (pagesToVisit.length && visited.size < MAX_PAGES) {
    const candidate = pagesToVisit.shift()!;
    if (visited.has(candidate.toString())) continue;
    const page = await fetchSameWebsitePage(candidate);
    visited.add(page.url.toString());
    for (const discoveredEmail of extractPublicBusinessEmails(page.html, initial.hostname)) {
      if (!found.has(discoveredEmail)) found.set(discoveredEmail, page.url.toString());
    }
    for (const contactPage of publicContactPageUrls(page.html, page.url)) {
      if (!visited.has(contactPage.toString()) && pagesToVisit.length + visited.size < MAX_PAGES) pagesToVisit.push(contactPage);
    }
  }

  const [email, sourceUrl] = [...found.entries()][0] ?? [];
  return email && sourceUrl ? { email, sourceUrl, checkedUrls: [...visited] } : null;
}
