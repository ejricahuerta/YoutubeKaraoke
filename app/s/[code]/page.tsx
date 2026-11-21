import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CenteredMessage } from "@/components/CenteredMessage";
import { HostScreen } from "@/components/host/HostScreen";
import { normalizeSessionCode, SESSION_CODE_LENGTH } from "@/lib/domain/session-code";
import { isPhone } from "@/lib/server/device";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  return { title: `YouOke · ${(await params).code.toUpperCase().slice(0, SESSION_CODE_LENGTH)}` };
}

export default async function HostPage({ params }: { params: Promise<{ code: string }> }) {
  const code = normalizeSessionCode((await params).code);
  if (!code) return <CenteredMessage title="That session code doesn't look right" />;
  // Phones never get the main screen, only the page for adding songs.
  if (isPhone(await headers())) redirect(`/join/${code}`);
  return <HostScreen code={code} />;
}
