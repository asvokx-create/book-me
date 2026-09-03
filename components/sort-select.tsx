"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function SortSelect({ value }: { value: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function changeSort(nextSort: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextSort === "newest") params.delete("sort");
    else params.set("sort", nextSort);
    router.push(`/services?${params.toString()}`, { scroll: false });
  }

  return (
    <label className="flex items-center gap-2 rounded-full border border-[#183126]/12 bg-white px-4 py-2.5 text-sm">
      <span className="font-semibold text-[#6b7c73]">Sort</span>
      <select value={value} onChange={(event) => changeSort(event.target.value)} className="bg-transparent font-bold outline-none" aria-label="Sort services">
        <option value="nearest">Nearest</option>
        <option value="price-low">Lowest price</option>
        <option value="price-high">Highest price</option>
        <option value="newest">Newest</option>
      </select>
    </label>
  );
}
