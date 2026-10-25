import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { database } from "@/lib/database";
import { bugReportStatusDetails } from "@/lib/bug-report-status";
import BrandLockup from "@/components/brand-lockup";
import AccountNav from "@/components/account-nav";
import BackButton from "@/components/back-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "My bug reports", robots: { index: false, follow: false } };

type Report = {
  id: string;
  title: string;
  details: string;
  status: string;
  created_at: Date;
  updated_at: Date;
};

export default async function BugReportsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const result = session ? await database.query<Report>(
    `SELECT id::text, title, details, status, created_at, updated_at
     FROM bug_reports
     WHERE reporter_id = $1
     ORDER BY created_at DESC
     LIMIT 100`,
    [session.user.id],
  ) : { rows: [] as Report[] };

  return (
    <main className="min-h-screen bg-[#f5f4ef] text-[#183126]">
      <header className="border-b border-[#183126]/10 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-8">
          <Link href="/" aria-label="BubsBookings home"><BrandLockup /></Link>
          <AccountNav />
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
        <BackButton label="Back to my account" fallbackHref="/account" className="mb-6" />
        <p className="text-xs font-bold uppercase tracking-[.15em] text-[#718078]">Support progress</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">My bug reports</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#64756c]">Track reports you submitted to BubsBookings. You will also receive a notification when a report moves into review or is closed.</p>

        <div className="mt-8 space-y-4">
          {result.rows.map((report) => {
            const status = bugReportStatusDetails(report.status);
            return (
              <article key={report.id} className="rounded-[1.7rem] border border-[#183126]/10 bg-white p-5 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${status.step === 3 ? "bg-[#e4f3e4] text-[#2f6f46]" : status.step === 2 ? "bg-[#fff1bf] text-[#745f0d]" : "bg-[#edf2e9] text-[#59645e]"}`}>{status.label}</span>
                    <h2 className="mt-3 break-words text-xl font-bold">{report.title}</h2>
                    <p className="mt-1 text-xs text-[#718078]">Submitted {new Date(report.created_at).toLocaleString()} · Updated {new Date(report.updated_at).toLocaleString()}</p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-[#64756c]">Step {status.step} of 3</span>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2" aria-label={`Bug report progress: ${status.label}`}>
                  {[1, 2, 3].map((step) => <span key={step} className={`h-2 rounded-full ${step <= status.step ? "bg-[#34704a]" : "bg-[#e3e8e2]"}`} />)}
                </div>
                <p className="mt-4 text-sm font-semibold text-[#52665b]">{status.description}</p>
                <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-[#f7f7f2] p-4 text-sm leading-6 text-[#52665b]">{report.details}</p>
              </article>
            );
          })}
          {result.rows.length === 0 && <div className="rounded-[1.7rem] border border-dashed border-[#183126]/20 bg-white/70 p-10 text-center"><h2 className="font-bold">No bug reports yet</h2><p className="mt-2 text-sm text-[#718078]">Reports submitted while signed in will appear here.</p></div>}
        </div>
      </div>
    </main>
  );
}
