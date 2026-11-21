import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CenteredMessage, HostScreen } from "@/components/HostScreen";
import { normalizeCode } from "@/lib/codes";
import { isPhone } from "@/lib/device";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  return { title: `Karaoke · ${(await params).code.toUpperCase().slice(0, 6)}` };
}

export default async function SessionPage({ params }: { params: Promise<{ code: string }> }) {
  const code = normalizeCode(decodeURIComponent((await params).code));
  if (!code) return <CenteredMessage title="That session code doesn't look right" />;
  // Phones never get the main screen, only the page for adding songs.
  if (isPhone(await headers())) redirect(`/join/${code}`);
  return <HostScreen code={code} />;
}
