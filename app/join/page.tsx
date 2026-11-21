import { redirect } from "next/navigation";
import { normalizeSessionCode } from "@/lib/domain/session-code";

/** Target of the "enter a code" form on the start page. */
export default async function JoinByCodePage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const raw = (await searchParams).code ?? "";
  // A code that cannot be one still goes to /join/..., which explains what a code looks like.
  redirect(`/join/${normalizeSessionCode(raw) ?? encodeURIComponent(raw.trim().toUpperCase() || "UNKNOWN")}`);
}
