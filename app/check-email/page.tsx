import Link from "next/link";

export default function CheckEmailPage() {
  return <main className="grid min-h-screen place-items-center bg-[#f5f4ef] px-5 text-[#183126]"><section className="w-full max-w-md rounded-[2rem] border border-[#183126]/10 bg-white p-8 text-center shadow-[0_24px_70px_rgba(24,49,38,.12)]"><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#e7f3e8] text-3xl">✉</span><h1 className="mt-5 text-3xl font-bold">Check your email</h1><p className="mt-3 text-sm leading-6 text-[#687970]">Open the verification link we sent to activate your BookMe account. The link expires in one hour.</p><Link href="/login" className="mt-7 inline-flex rounded-full bg-[#183126] px-6 py-3 font-bold text-white">Return to login</Link></section></main>;
}
