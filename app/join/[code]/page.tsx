import type { Metadata } from "next";
import { CenteredMessage } from "@/components/CenteredMessage";
import { GuestScreen } from "@/components/guest/GuestScreen";
import { normalizeSessionCode, SESSION_CODE_LENGTH } from "@/lib/domain/session-code";

export const metadata: Metadata = { title: "Add a song · YouOke" };

export default async function GuestPage({ params }: { params: Promise<{ code: string }> }) {
  const code = normalizeSessionCode((await params).code);
  if (!code) {
    return (
      <CenteredMessage title="That code doesn't look right">
        Session codes are {SESSION_CODE_LENGTH} letters and numbers. Scan the QR code on the karaoke screen to join.
      </CenteredMessage>
    );
  }
  return <GuestScreen code={code} />;
}
