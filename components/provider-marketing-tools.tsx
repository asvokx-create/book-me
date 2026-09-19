"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import QRCode from "react-qr-code";

type MarketingService = {
  id: string;
  slug: string;
  title: string;
  businessName: string;
  category: string;
  location: string;
};

const publicSiteUrl = "https://bubsbookings.com";

function safeFilename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "listing";
}

export default function ProviderMarketingTools({ services }: { services: MarketingService[] }) {
  const [selectedId, setSelectedId] = useState(services[0]?.id ?? "");
  const [copied, setCopied] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const qrRef = useRef<HTMLDivElement>(null);
  const selected = services.find((service) => service.id === selectedId) ?? services[0];
  const listingUrl = selected ? `${publicSiteUrl}/services/${selected.slug}` : "";

  async function copyLink() {
    if (!listingUrl) return;
    try {
      await navigator.clipboard.writeText(listingUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function shareListing() {
    if (!selected || !listingUrl) return;
    if (navigator.share) {
      await navigator.share({ title: selected.title, text: `Book ${selected.title} on BubsBookings`, url: listingUrl }).catch(() => undefined);
      return;
    }
    await copyLink();
  }

  function downloadQrCode() {
    if (!selected || !qrRef.current) return;
    setDownloadError("");
    const svg = qrRef.current.querySelector("svg");
    if (!svg) {
      setDownloadError("The QR code could not be downloaded. Please try again.");
      return;
    }

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", "1200");
    clone.setAttribute("height", "1200");
    const source = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1600;
      canvas.height = 1600;
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(objectUrl);
        setDownloadError("The QR code could not be downloaded. Please try again.");
        return;
      }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 160, 160, 1280, 1280);
      URL.revokeObjectURL(objectUrl);
      canvas.toBlob((png) => {
        if (!png) {
          setDownloadError("The QR code could not be downloaded. Please try again.");
          return;
        }
        const link = document.createElement("a");
        link.href = URL.createObjectURL(png);
        link.download = `${safeFilename(selected.title)}-bubsbookings-qr.png`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      }, "image/png");
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setDownloadError("The QR code could not be downloaded. Please try again.");
    };
    image.src = objectUrl;
  }

  if (!services.length) {
    return <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-7 sm:p-9">
      <div className="max-w-xl">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#fff4a8] text-2xl">▦</span>
        <h1 className="mt-5 text-3xl font-bold tracking-[-.04em]">Create a listing to start marketing</h1>
        <p className="mt-3 text-sm leading-6 text-[#66776e]">Once your first service is live, BubsBookings will make a shareable link and QR code for it automatically.</p>
        <Link href="/providers/join" className="mt-6 inline-flex rounded-full bg-[#183126] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#315846]">Create a service listing</Link>
      </div>
    </section>;
  }

  return <div>
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="text-sm font-semibold text-[#687a70]">Grow your business</p>
        <h1 className="mt-1 text-3xl font-bold tracking-[-.04em] sm:text-4xl">Marketing tools</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#687a70]">Share a direct path to your listing online, on business cards, or anywhere customers discover you.</p>
      </div>
      <span className="w-fit rounded-full bg-[#e7eee2] px-4 py-2 text-xs font-bold">Included with every provider plan</span>
    </div>

    <div className="mt-8 grid gap-5 xl:grid-cols-[.82fr_1.18fr]">
      <section className="rounded-[2rem] bg-[#183126] p-6 text-white sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[.14em] text-[#b9c9c0]">Choose a listing</p>
        {services.length > 1 ? <label className="mt-4 block">
          <span className="sr-only">Service listing</span>
          <select value={selected.id} onChange={(event) => { setSelectedId(event.target.value); setCopied(false); setDownloadError(""); }} className="marketing-listing-select w-full rounded-2xl border px-5 py-3.5 text-sm font-bold outline-none">
            {services.map((service) => <option key={service.id} value={service.id}>{service.title} — {service.businessName}</option>)}
          </select>
        </label> : null}

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs font-bold uppercase tracking-[.12em] text-[#acc0b5]">{selected.category}</p>
          <h2 className="mt-2 text-2xl font-bold">{selected.title}</h2>
          <p className="mt-1 text-sm text-[#c2d0c8]">{selected.businessName} · {selected.location}</p>
        </div>

        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-[.12em] text-[#acc0b5]">Your direct link</p>
          <div className="mt-2 break-all rounded-2xl border border-white/10 bg-[#0f271d] p-4 text-sm text-[#eef5f0]">{listingUrl}</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={copyLink} className="rounded-full bg-[#eee25a] px-5 py-3 text-sm font-bold text-[#183126] transition hover:bg-[#f7ed74]">{copied ? "Copied ✓" : "Copy link"}</button>
            <button type="button" onClick={shareListing} className="rounded-full border border-white/20 px-5 py-3 text-sm font-bold text-white transition hover:border-white/40 hover:bg-white/10">Share listing</button>
          </div>
          <Link href={`/services/${selected.slug}`} target="_blank" className="mt-4 inline-flex text-sm font-bold text-[#eee25a] underline decoration-[#eee25a]/60 underline-offset-4">Preview public listing ↗</Link>
        </div>
      </section>

      <section className="rounded-[2rem] border border-[#183126]/10 bg-white p-6 shadow-[0_8px_32px_rgba(24,49,38,.06)] sm:p-8">
        <div className="grid gap-7 md:grid-cols-[auto_1fr] md:items-center">
          <div className="mx-auto rounded-[1.75rem] border border-[#183126]/10 bg-white p-5 shadow-[0_8px_28px_rgba(24,49,38,.08)]">
            <div ref={qrRef} className="h-[220px] w-[220px] bg-white p-1">
              <QRCode value={listingUrl} size={212} level="H" bgColor="#ffffff" fgColor="#183126" aria-label={`QR code for ${selected.title}`} />
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#718078]">Ready to print</p>
            <h2 className="mt-2 text-2xl font-bold">Your listing QR code</h2>
            <p className="mt-3 text-sm leading-6 text-[#66776e]">Customers who scan it go directly to <strong className="text-[#183126]">{selected.title}</strong>, where they can review the details and request a booking.</p>
            <button type="button" onClick={downloadQrCode} className="mt-5 w-full rounded-full bg-[#183126] px-6 py-3.5 text-sm font-bold text-white transition hover:bg-[#315846] sm:w-auto">Download print-quality PNG</button>
            {downloadError && <p role="alert" className="mt-3 text-xs font-semibold text-[#9b4934]">{downloadError}</p>}
          </div>
        </div>

        <div className="mt-7 grid gap-3 border-t border-[#183126]/10 pt-6 sm:grid-cols-3">
          <div className="rounded-2xl bg-[#f5f5ef] p-4"><p className="font-bold">Keep the white border</p><p className="mt-1 text-xs leading-5 text-[#718078]">It helps phone cameras scan the code reliably.</p></div>
          <div className="rounded-2xl bg-[#f5f5ef] p-4"><p className="font-bold">Print at 1 inch or larger</p><p className="mt-1 text-xs leading-5 text-[#718078]">Ideal for business cards, flyers, signs, and menus.</p></div>
          <div className="rounded-2xl bg-[#f5f5ef] p-4"><p className="font-bold">Test before ordering</p><p className="mt-1 text-xs leading-5 text-[#718078]">Scan a proof with your phone before a large print run.</p></div>
        </div>
      </section>
    </div>
  </div>;
}
