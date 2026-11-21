import { redirect } from "next/navigation";
import { normalizeCode } from "@/lib/codes";

/** Target of the "enter a code" form on the start page. */
export default async function JoinByCode({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const raw = (await searchParams).code ?? "";
  redirect(`/join/${normalizeCode(raw) ?? encodeURIComponent(raw.trim().toUpperCase() || "UNKNOWN")}`);
}
