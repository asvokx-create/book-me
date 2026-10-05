"use client";

import { useRouter, useSearchParams } from "next/navigation";
import CustomSelect from "@/components/custom-select";

export default function SortSelect({ value, remote = false }: { value: string; remote?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function changeSort(nextSort: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextSort === "newest") params.delete("sort");
    else params.set("sort", nextSort);
    router.push(`/services?${params.toString()}#service-listings`);
  }

  return (
    <label className="sort-control flex min-h-11 max-w-full items-center gap-2 rounded-full border border-[#183126]/12 bg-white px-4 py-2.5 text-sm">
      <span className="font-semibold text-[#6b7c73]">Sort</span>
      <CustomSelect ariaLabel="Sort services" value={value} onChange={changeSort} className="min-w-0 flex-1" buttonClassName="sort-control-select min-w-0 min-h-8 border-0 bg-transparent px-1 py-0 font-bold outline-none">
        {!remote && <option value="nearest">Nearest</option>}
        <option value="newest">Newest</option>
        <option value="price-low">Lowest displayed price/rate</option>
        <option value="price-high">Highest displayed price/rate</option>
      </CustomSelect>
    </label>
  );
}
