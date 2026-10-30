import { redirect } from "next/navigation";

function values(value: string | string[] | undefined) {
  return Array.isArray(value) ? value : value === undefined ? [] : [value];
}

export default async function ServicesPage({ searchParams }: PageProps<"/services">) {
  const incoming = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(incoming)) {
    for (const item of values(value)) query.append(key, item);
  }
  redirect(`/${query.size ? `?${query.toString()}` : ""}#nearby-listings`);
}
