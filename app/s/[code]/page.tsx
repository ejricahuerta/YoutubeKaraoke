import type { Metadata } from "next";
import { CenteredMessage, HostScreen } from "@/components/HostScreen";
import { normalizeCode } from "@/lib/codes";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  return { title: `Karaoke · ${(await params).code.toUpperCase().slice(0, 6)}` };
}

export default async function SessionPage({ params }: { params: Promise<{ code: string }> }) {
  const code = normalizeCode(decodeURIComponent((await params).code));
  if (!code) return <CenteredMessage title="That session code doesn't look right" />;
  return <HostScreen code={code} />;
}
