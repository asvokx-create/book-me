type CategoryIconProps = {
  category: string;
  className?: string;
};

const styles: Record<string, { background: string; foreground: string }> = {
  "Home cleaning": { background: "from-[#dff1e5] to-[#f6f3c7]", foreground: "#286047" },
  "Car detailing": { background: "from-[#dcecf1] to-[#e5efd8]", foreground: "#245a69" },
  "Lawn & garden": { background: "from-[#e2f0d2] to-[#f5efc1]", foreground: "#48702f" },
  Handyman: { background: "from-[#eee5d9] to-[#f7efc8]", foreground: "#7a542d" },
  Photography: { background: "from-[#e8e3f0] to-[#f4e5dc]", foreground: "#5f4a72" },
};

function Illustration({ category }: { category: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, strokeWidth: 1.8 };

  switch (category) {
    case "Home cleaning":
      return <svg viewBox="0 0 48 48" aria-hidden="true" className="h-12 w-12"><path {...common} d="M19 15h11l3 5v18H15V20l4-5Z" /><path {...common} d="M21 15v-4h9l4 3M16 24h16" /><path {...common} d="m36 9 1.2 2.8L40 13l-2.8 1.2L36 17l-1.2-2.8L32 13l2.8-1.2L36 9Z" /><path {...common} d="m10 17 .8 1.8 1.8.8-1.8.8L10 21l-.8-1.6-1.8-.8 1.8-.8L10 17Z" /><path {...common} d="M20 29h8" /></svg>;
    case "Car detailing":
      return <svg viewBox="0 0 48 48" aria-hidden="true" className="h-12 w-12"><path {...common} d="m11 29 3.5-9h19l4.5 9v7H10v-5.5c0-.8.4-1.3 1-1.5Z" /><path {...common} d="M16 20 19 14h11l3.5 6M14 29h20" /><circle {...common} cx="17" cy="36" r="3" /><circle {...common} cx="32" cy="36" r="3" /><path {...common} d="M13 26h5m13 0h5M22 16v4" /><path {...common} d="m39 10 1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1 1-2.2Z" /></svg>;
    case "Lawn & garden":
      return <svg viewBox="0 0 48 48" aria-hidden="true" className="h-12 w-12"><path {...common} d="M24 39V20" /><path {...common} d="M24 27c-7 0-11-4-11-11 7 0 11 4 11 11ZM24 22c0-7 4-11 11-11 0 7-4 11-11 11Z" /><path {...common} d="M24 34c5.5 0 9-3.2 9-8.5-5.5 0-9 3.2-9 8.5Z" /><path {...common} d="M10 39h28M15 39c1.5-3 3.5-4.5 6-4.5M33 39c-1-2.2-2.5-3.4-4.5-3.4" /></svg>;
    case "Handyman":
      return <svg viewBox="0 0 48 48" aria-hidden="true" className="h-12 w-12"><path {...common} d="m14 34 17-17M29 14l3-3 5 5-3 3" /><path {...common} d="m12 31 5 5-3 3a2.8 2.8 0 0 1-4-4l2-4Z" /><path {...common} d="M29 27 39 37l-4 4-10-10" /><path {...common} d="m25 31 6-6M11 12l7 2 4 7-4 4-7-4-3-6 3-3Z" /></svg>;
    case "Photography":
      return <svg viewBox="0 0 48 48" aria-hidden="true" className="h-12 w-12"><path {...common} d="M10 18h8l3-5h8l3 5h6v21H10V18Z" /><circle {...common} cx="24" cy="28" r="7" /><circle cx="24" cy="28" r="2.5" fill="currentColor" /><path {...common} d="M34 22h.1" /><path {...common} d="m39 8 1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1L39 8Z" /></svg>;
    default:
      return <svg viewBox="0 0 48 48" aria-hidden="true" className="h-12 w-12"><path {...common} d="m24 8 3.2 8.8L36 20l-8.8 3.2L24 32l-3.2-8.8L12 20l8.8-3.2L24 8Z" /><path {...common} d="m36 29 1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5 1.5-4Z" /></svg>;
  }
}

export default function ServiceCategoryIcon({ category, className = "" }: CategoryIconProps) {
  const style = styles[category] ?? { background: "from-[#e5eee4] to-[#f6efc8]", foreground: "#315c47" };
  return (
    <span
      className={`relative grid h-16 w-16 place-items-center overflow-hidden rounded-[1.35rem] bg-gradient-to-br shadow-[inset_0_0_0_1px_rgba(24,49,38,.06),0_8px_18px_rgba(24,49,38,.08)] ${style.background} ${className}`}
      style={{ color: style.foreground }}
    >
      <span className="absolute -right-3 -top-3 h-10 w-10 rounded-full bg-white/45" />
      <span className="relative transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-2"><Illustration category={category} /></span>
    </span>
  );
}
